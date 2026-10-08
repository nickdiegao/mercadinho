/**
 * Traducao entre o Postgres e o Estado que as telas usam.
 *
 *   lerEstado      monta o Estado inteiro a partir das tabelas
 *   gravarEfeitos  grava o que uma operacao produziu (lib/operacoes.ts)
 *   semear         recomeca o banco com um Estado (demonstracao ou vazio)
 *
 * Ler o Estado inteiro serve bem a uma loja so, com alguns milhares de
 * linhas. Quando o historico crescer, o caminho e paginar vendas e
 * movimentos — as telas ja pedem dados por lista, entao a troca fica aqui.
 */

import { asc, desc, eq, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
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

/** "2026-10-08 22:39:00.123+00" (Postgres) -> ISO, que e o que as telas usam. */
export const iso = (s: string) =>
  new Date(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00")).toISOString();
const isoOuNada = (s: string | null) => (s ? iso(s) : undefined);

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

/** Insere em lotes: o Postgres aceita no maximo 65 mil parametros por comando. */
async function inserirEmLotes<R>(db: Conexao, tabela: Parameters<Conexao["insert"]>[0], linhas: R[]) {
  for (let i = 0; i < linhas.length; i += 400) {
    await db.insert(tabela).values(linhas.slice(i, i + 400) as never);
  }
}

// ================================================================ leitura

export async function lerEstado(db: Conexao): Promise<Estado> {
  const [
    [emp],
    usuarios,
    categorias,
    fornecedores,
    clientes,
    produtos,
    entradas,
    entradaItens,
    vendas,
    vendaItens,
    movimentos,
    caixaSessoes,
    caixaMovimentos,
    documentos,
    logs,
  ] = await Promise.all([
    db.select().from(t.empresa).limit(1),
    // a senha nunca sai do banco: o hash nao entra na leitura
    db
      .select({ id: t.usuarios.id, nome: t.usuarios.nome, email: t.usuarios.email, perfil: t.usuarios.perfil, ativo: t.usuarios.ativo })
      .from(t.usuarios)
      .orderBy(asc(t.usuarios.id)),
    db.select({ id: t.categorias.id, nome: t.categorias.nome }).from(t.categorias).orderBy(asc(t.categorias.id)),
    db.select().from(t.fornecedores).orderBy(asc(t.fornecedores.id)),
    db.select().from(t.clientes).orderBy(asc(t.clientes.id)),
    db.select().from(t.produtos).orderBy(asc(t.produtos.sku)),
    db.select().from(t.entradas).orderBy(desc(t.entradas.data), desc(t.entradas.numero)),
    db.select().from(t.entradaItens).orderBy(asc(t.entradaItens.entradaId), asc(t.entradaItens.posicao)),
    db.select().from(t.vendas).orderBy(desc(t.vendas.data), desc(t.vendas.numero)),
    db.select().from(t.vendaItens).orderBy(asc(t.vendaItens.vendaId), asc(t.vendaItens.posicao)),
    db.select().from(t.movimentosEstoque).orderBy(asc(t.movimentosEstoque.ordem)),
    db.select().from(t.caixaSessoes).orderBy(asc(t.caixaSessoes.abertaEm)),
    db.select().from(t.caixaMovimentos).orderBy(asc(t.caixaMovimentos.ordem)),
    db.select().from(t.documentos).orderBy(asc(t.documentos.numero)),
    // a tela mostra os ultimos 300; o banco guarda todos
    db.select().from(t.logAuditoria).orderBy(desc(t.logAuditoria.ordem)).limit(300),
  ]);

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
    fornecedores,
    clientes: clientes.map((c) => semNulos(c) as Cliente),
    produtos: produtos.map(({ cest: _c, cfop: _f, origem: _o, ...p }) => semNulos(p) as Produto),
    entradas: entradas.map(
      (e) => ({ ...semNulos(e), data: iso(e.data), itens: itensDaEntrada.get(e.id) ?? [] }) as Entrada,
    ),
    vendas: vendas.map(
      (v) =>
        ({
          ...semNulos(v),
          data: iso(v.data),
          canceladaEm: isoOuNada(v.canceladaEm),
          itens: itensDaVenda.get(v.id) ?? [],
        }) as Venda,
    ),
    movimentos: movimentos.map(
      ({ ordem: _o, ...m }) => ({ ...semNulos(m), data: iso(m.data) }) as MovimentoEstoque,
    ),
    caixaSessoes: caixaSessoes.map(
      (c) => ({ ...semNulos(c), abertaEm: iso(c.abertaEm), fechadaEm: isoOuNada(c.fechadaEm) }) as CaixaSessao,
    ),
    caixaMovimentos: caixaMovimentos.map(
      ({ ordem: _o, ...m }) => ({ ...semNulos(m), data: iso(m.data) }) as CaixaMovimento,
    ),
    documentos: documentos.map(
      (d) =>
        ({
          id: d.id,
          vendaId: d.vendaId,
          tipo: d.tipo,
          numero: d.numero,
          emitidoEm: iso(d.emitidoEm),
          emitenteSnapshot: d.emitenteSnapshot,
          destinatarioSnapshot: d.destinatarioSnapshot ?? null,
        }) as Documento,
    ),
    logs: logs.map(
      (l): LogAuditoria => ({
        id: l.id,
        ocorridoEm: iso(l.ocorridoEm),
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
export async function gravarEfeitos(db: Conexao, ef: Efeitos) {
  const { inserir: ins, atualizar: alt } = ef;

  // casco antes do produto que aponta para ele
  const produtos = [...(ins.produtos ?? [])].sort(
    (a, b) => Number(b.tipo === "VASILHAME") - Number(a.tipo === "VASILHAME"),
  );
  if (produtos.length) await inserirEmLotes(db, t.produtos, produtos.map(linhaProduto));
  if (ins.clientes?.length) await inserirEmLotes(db, t.clientes, ins.clientes.map((c) => nulosNoLugar({ ...c })));
  if (ins.fornecedores?.length)
    await inserirEmLotes(db, t.fornecedores, ins.fornecedores.map((f) => ({ ...f, ativo: f.ativo !== false })));
  if (ins.caixaSessoes?.length)
    await inserirEmLotes(db, t.caixaSessoes, ins.caixaSessoes.map((c) => nulosNoLugar({ ...c })));

  for (const p of alt.produtos ?? []) {
    const { id, ...campos } = nulosNoLugar(p);
    await db.update(t.produtos).set(campos).where(eq(t.produtos.id, id));
  }
  for (const c of alt.clientes ?? []) {
    const { id, ...campos } = nulosNoLugar(c);
    await db.update(t.clientes).set(campos).where(eq(t.clientes.id, id));
  }
  for (const f of alt.fornecedores ?? []) {
    const { id, ...campos } = nulosNoLugar(f);
    await db.update(t.fornecedores).set(campos).where(eq(t.fornecedores.id, id));
  }
  for (const v of alt.vendas ?? []) {
    const { id, itens: _i, ...campos } = nulosNoLugar(v);
    await db.update(t.vendas).set(campos).where(eq(t.vendas.id, id));
  }
  for (const c of alt.caixaSessoes ?? []) {
    const { id, ...campos } = nulosNoLugar(c);
    await db.update(t.caixaSessoes).set(campos).where(eq(t.caixaSessoes.id, id));
  }

  if (ins.vendas?.length) {
    await inserirEmLotes(db, t.vendas, ins.vendas.map(linhaVenda));
    await inserirEmLotes(db, t.vendaItens, ins.vendas.flatMap(linhasItensVenda));
  }
  if (ins.entradas?.length) {
    await inserirEmLotes(db, t.entradas, ins.entradas.map(linhaEntrada));
    await inserirEmLotes(db, t.entradaItens, ins.entradas.flatMap(linhasItensEntrada));
  }
  if (ins.documentos?.length) await inserirEmLotes(db, t.documentos, ins.documentos);
  if (ins.caixaMovimentos?.length)
    await inserirEmLotes(db, t.caixaMovimentos, ins.caixaMovimentos.map((m) => nulosNoLugar({ ...m })));
  if (ins.movimentos?.length)
    await inserirEmLotes(db, t.movimentosEstoque, ins.movimentos.map((m) => nulosNoLugar({ ...m })));
  if (ins.logs?.length)
    await inserirEmLotes(
      db,
      t.logAuditoria,
      ins.logs.map((l) => ({ ...l, usuarioId: l.usuarioId || null })),
    );
}

// ================================================================ semente

/**
 * Recomeca o banco com um Estado: o da demonstracao (npm run banco:semear) ou
 * o vazio, pronto para os dados reais (npm run banco:zerar). Os usuarios
 * ganham a senha inicial, com hash bcrypt de custo 12.
 */
export async function semear(db: Conexao, estado: Estado, senhaInicial: string) {
  if (senhaInicial.length < 8) throw new Error("SENHA_INICIAL precisa de pelo menos 8 caracteres.");

  await db.execute(sql`
    TRUNCATE log_auditoria, movimentos_estoque, caixa_movimentos, documentos,
      venda_itens, vendas, entrada_itens, entradas, caixa_sessoes,
      produtos, clientes, fornecedores, categorias, usuarios, empresa
    RESTART IDENTITY CASCADE
  `);

  const senhaHash = await hash(senhaInicial, 12);
  await db.insert(t.empresa).values({ id: 1, ...estado.empresa });
  await db.insert(t.usuarios).values(estado.usuarios.map((u) => ({ ...u, senhaHash })));
  await db.insert(t.categorias).values(estado.categorias);

  // movimentos do seed ja vem em ordem de data: a coluna "ordem" segue igual
  await gravarEfeitos(db, {
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
