/**
 * Traducao entre o SQLite e o Estado que as telas usam.
 *
 *   lerEstado      monta o Estado inteiro a partir das tabelas
 *   gravarEfeitos  grava o que uma operacao produziu (lib/operacoes.ts)
 *   semear         carrega um Estado no banco novo (demonstracao ou vazio)
 *
 * Ler o Estado inteiro serve bem a uma loja so, com alguns milhares de
 * linhas. Quando o historico crescer, o caminho e paginar vendas e
 * movimentos — as telas ja pedem dados por lista, entao a troca fica aqui.
 *
 * O driver do SQLite e sincrono, e por isso nada aqui usa await: dentro de uma
 * transacao, nenhuma outra requisicao entra no meio.
 */

import { asc, desc, eq } from "drizzle-orm";
import type { Efeitos } from "../operacoes";
import type {
  CaixaMovimento,
  CaixaSessao,
  Cliente,
  Documento,
  Entrada,
  EntradaItem,
  Estado,
  Fornecedor,
  LogAuditoria,
  MovimentoEstoque,
  Produto,
  Venda,
  VendaItem,
} from "../tipos";
import type { Conexao } from "./db";
import * as t from "./schema";

// ---------------------------------------------------------------- apoio

/** Campo nulo no banco e campo ausente no dominio. */
function semNulos<T extends object>(o: T): { [K in keyof T]: Exclude<T[K], null> } {
  const r = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) if (v !== null) r[k] = v;
  return r as { [K in keyof T]: Exclude<T[K], null> };
}

/** Ausente no dominio vira nulo no banco — no update, e o que apaga o valor. */
function nulosNoLugar<T extends object>(o: T): T {
  const r = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) r[k] = v === undefined ? null : v;
  return r as T;
}

/** Insere em lotes: o SQLite aceita no maximo 32 mil parametros por comando. */
function inserirEmLotes<R>(db: Conexao, tabela: Parameters<Conexao["insert"]>[0], linhas: R[]) {
  for (let i = 0; i < linhas.length; i += 400) {
    db.insert(tabela).values(linhas.slice(i, i + 400) as never).run();
  }
}

// ================================================================ leitura

export function lerEstado(db: Conexao): Estado {
  const emp = db.select().from(t.empresa).limit(1).get();
  // a senha nunca sai do banco: o hash nao entra na leitura
  const usuarios = db
    .select({ id: t.usuarios.id, nome: t.usuarios.nome, email: t.usuarios.email, perfil: t.usuarios.perfil, ativo: t.usuarios.ativo })
    .from(t.usuarios)
    .orderBy(asc(t.usuarios.id))
    .all();
  const categorias = db.select({ id: t.categorias.id, nome: t.categorias.nome }).from(t.categorias).orderBy(asc(t.categorias.id)).all();
  const fornecedores = db.select().from(t.fornecedores).orderBy(asc(t.fornecedores.id)).all();
  const clientes = db.select().from(t.clientes).orderBy(asc(t.clientes.id)).all();
  const produtos = db.select().from(t.produtos).orderBy(asc(t.produtos.sku)).all();
  const entradas = db.select().from(t.entradas).orderBy(desc(t.entradas.data), desc(t.entradas.numero)).all();
  const entradaItens = db.select().from(t.entradaItens).orderBy(asc(t.entradaItens.entradaId), asc(t.entradaItens.posicao)).all();
  const vendas = db.select().from(t.vendas).orderBy(desc(t.vendas.data), desc(t.vendas.numero)).all();
  const vendaItens = db.select().from(t.vendaItens).orderBy(asc(t.vendaItens.vendaId), asc(t.vendaItens.posicao)).all();
  const movimentos = db.select().from(t.movimentosEstoque).orderBy(asc(t.movimentosEstoque.ordem)).all();
  const caixaSessoes = db.select().from(t.caixaSessoes).orderBy(asc(t.caixaSessoes.abertaEm)).all();
  const caixaMovimentos = db.select().from(t.caixaMovimentos).orderBy(asc(t.caixaMovimentos.ordem)).all();
  const documentos = db.select().from(t.documentos).orderBy(asc(t.documentos.numero)).all();
  // a tela mostra os ultimos 300; o banco guarda todos
  const logs = db.select().from(t.logAuditoria).orderBy(desc(t.logAuditoria.ordem)).limit(300).all();

  if (!emp) throw new Error("O banco está vazio: rode npm run banco:preparar.");

  const itensDaEntrada = new Map<string, EntradaItem[]>();
  for (const i of entradaItens) {
    const { entradaId, posicao: _p, ...item } = i;
    const lista = itensDaEntrada.get(entradaId) ?? [];
    lista.push(item);
    itensDaEntrada.set(entradaId, lista);
  }

  const itensDaVenda = new Map<string, VendaItem[]>();
  for (const i of vendaItens) {
    const { vendaId, posicao: _p, embalagemUnidade, embalagemFator, gelado, adicionalGelado, ...resto } = i;
    const item: VendaItem = {
      ...resto,
      ...(embalagemUnidade && embalagemFator ? { embalagem: { unidade: embalagemUnidade, fator: embalagemFator } } : {}),
      ...(gelado ? { gelado: true, adicionalGelado: adicionalGelado ?? 0 } : {}),
    };
    const lista = itensDaVenda.get(vendaId) ?? [];
    lista.push(item);
    itensDaVenda.set(vendaId, lista);
  }

  const { id: _id, ...empresa } = emp;

  return {
    versao: 2,
    empresa,
    usuarios,
    usuarioAtualId: null,
    categorias,
    fornecedores: fornecedores as Fornecedor[],
    clientes: clientes.map((c) => semNulos(c) as Cliente),
    produtos: produtos.map(({ cest: _c, cfop: _f, origem: _o, ...p }) => semNulos(p) as Produto),
    entradas: entradas.map((e) => ({ ...semNulos(e), itens: itensDaEntrada.get(e.id) ?? [] }) as Entrada),
    vendas: vendas.map((v) => ({ ...semNulos(v), itens: itensDaVenda.get(v.id) ?? [] }) as Venda),
    movimentos: movimentos.map(({ ordem: _o, ...m }) => semNulos(m) as MovimentoEstoque),
    caixaSessoes: caixaSessoes.map((c) => semNulos(c) as CaixaSessao),
    caixaMovimentos: caixaMovimentos.map(({ ordem: _o, ...m }) => semNulos(m) as CaixaMovimento),
    documentos: documentos.map(
      (d) =>
        ({
          id: d.id,
          vendaId: d.vendaId,
          tipo: d.tipo,
          numero: d.numero,
          emitidoEm: d.emitidoEm,
          emitenteSnapshot: d.emitenteSnapshot,
          destinatarioSnapshot: d.destinatarioSnapshot ?? null,
        }) as Documento,
    ),
    logs: logs.map(
      (l): LogAuditoria => ({
        id: l.id,
        ocorridoEm: l.ocorridoEm,
        usuarioId: l.usuarioId ?? "",
        acao: l.acao,
        entidade: l.entidade,
        entidadeId: l.entidadeId,
        detalhe: l.detalhe,
      }),
    ),
  };
}

// ================================================================ gravacao

const linhaProduto = (p: Produto) => nulosNoLugar({ ...p });

const linhaVenda = ({ itens: _i, ...v }: Venda) => nulosNoLugar({ ...v });

const linhasItensVenda = (v: Venda) =>
  v.itens.map(({ embalagem, gelado, adicionalGelado, ...i }, posicao) =>
    nulosNoLugar({
      ...i,
      vendaId: v.id,
      posicao,
      embalagemUnidade: embalagem?.unidade,
      embalagemFator: embalagem?.fator,
      gelado: gelado === true,
      adicionalGelado: gelado ? (adicionalGelado ?? 0) : undefined,
    }),
  );

const linhaEntrada = ({ itens: _i, ...e }: Entrada) => nulosNoLugar({ ...e });

const linhasItensEntrada = (e: Entrada) =>
  e.itens.map((i, posicao) => ({ ...i, entradaId: e.id, posicao }));

/**
 * Grava os efeitos de uma operacao. Chamado dentro da transacao: se qualquer
 * linha falhar (constraint, chave repetida), nada do que veio antes fica.
 * A ordem respeita as chaves estrangeiras: cadastro, depois alteracoes,
 * depois o que aponta para eles.
 */
export function gravarEfeitos(db: Conexao, ef: Efeitos) {
  const { inserir: ins, atualizar: alt } = ef;

  // casco antes do produto que aponta para ele
  const produtos = [...(ins.produtos ?? [])].sort(
    (a, b) => Number(b.tipo === "VASILHAME") - Number(a.tipo === "VASILHAME"),
  );
  if (produtos.length) inserirEmLotes(db, t.produtos, produtos.map(linhaProduto));
  if (ins.clientes?.length) inserirEmLotes(db, t.clientes, ins.clientes.map((c) => nulosNoLugar({ ...c })));
  if (ins.fornecedores?.length)
    inserirEmLotes(db, t.fornecedores, ins.fornecedores.map((f) => ({ ...f, ativo: f.ativo !== false })));
  if (ins.caixaSessoes?.length)
    inserirEmLotes(db, t.caixaSessoes, ins.caixaSessoes.map((c) => nulosNoLugar({ ...c })));

  for (const p of alt.produtos ?? []) {
    const { id, ...campos } = nulosNoLugar(p);
    db.update(t.produtos).set(campos).where(eq(t.produtos.id, id)).run();
  }
  for (const c of alt.clientes ?? []) {
    const { id, ...campos } = nulosNoLugar(c);
    db.update(t.clientes).set(campos).where(eq(t.clientes.id, id)).run();
  }
  for (const f of alt.fornecedores ?? []) {
    const { id, ...campos } = nulosNoLugar(f);
    db.update(t.fornecedores).set(campos).where(eq(t.fornecedores.id, id)).run();
  }
  for (const v of alt.vendas ?? []) {
    const { id, itens: _i, ...campos } = nulosNoLugar(v);
    db.update(t.vendas).set(campos).where(eq(t.vendas.id, id)).run();
  }
  for (const c of alt.caixaSessoes ?? []) {
    const { id, ...campos } = nulosNoLugar(c);
    db.update(t.caixaSessoes).set(campos).where(eq(t.caixaSessoes.id, id)).run();
  }

  if (ins.vendas?.length) {
    inserirEmLotes(db, t.vendas, ins.vendas.map(linhaVenda));
    inserirEmLotes(db, t.vendaItens, ins.vendas.flatMap(linhasItensVenda));
  }
  if (ins.entradas?.length) {
    inserirEmLotes(db, t.entradas, ins.entradas.map(linhaEntrada));
    inserirEmLotes(db, t.entradaItens, ins.entradas.flatMap(linhasItensEntrada));
  }
  if (ins.documentos?.length) inserirEmLotes(db, t.documentos, ins.documentos);
  if (ins.caixaMovimentos?.length)
    inserirEmLotes(db, t.caixaMovimentos, ins.caixaMovimentos.map((m) => nulosNoLugar({ ...m })));
  if (ins.movimentos?.length)
    inserirEmLotes(db, t.movimentosEstoque, ins.movimentos.map((m) => nulosNoLugar({ ...m })));
  if (ins.logs?.length)
    inserirEmLotes(
      db,
      t.logAuditoria,
      ins.logs.map((l) => ({ ...l, usuarioId: l.usuarioId || null })),
    );
}

// ================================================================ semente

/**
 * Carrega um Estado no banco novo: o da demonstracao (npm run banco:semear) ou
 * o vazio, pronto para os dados reais (npm run banco:zerar). Quem chama ja
 * apagou o arquivo: os gatilhos de so-insercao nao deixariam limpar por DELETE.
 */
export function semear(db: Conexao, estado: Estado, senhaHash: string) {
  db.insert(t.empresa).values({ id: 1, ...estado.empresa }).run();
  db.insert(t.usuarios).values(estado.usuarios.map((u) => ({ ...u, senhaHash }))).run();
  db.insert(t.categorias).values(estado.categorias).run();

  // movimentos do seed ja vem em ordem de data: a coluna "ordem" segue igual
  gravarEfeitos(db, {
    inserir: {
      fornecedores: estado.fornecedores,
      clientes: estado.clientes,
      produtos: estado.produtos,
      caixaSessoes: estado.caixaSessoes,
      vendas: estado.vendas,
      entradas: estado.entradas,
      documentos: estado.documentos,
      caixaMovimentos: estado.caixaMovimentos,
      movimentos: estado.movimentos,
      logs: [...estado.logs].reverse(),
    },
    atualizar: {},
  });
}
