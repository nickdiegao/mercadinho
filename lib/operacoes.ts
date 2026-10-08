/**
 * As operacoes do sistema como funcoes puras.
 *
 * Cada operacao le o estado atual e devolve o que precisa ser gravado (os
 * Efeitos) — nunca grava nada sozinha. Quem grava e o adaptador:
 *
 *   modo demonstracao  o navegador aplica os efeitos no localStorage
 *   modo banco         o servidor aplica no Postgres, numa transacao so
 *
 * Assim cada regra de negocio (preco, gelado, embalagem, custo medio, casco,
 * estorno) existe num lugar so, e as duas versoes nunca discordam.
 *
 * Nada aqui confia em quem chama: preco de venda e recalculado, custo e saldo
 * nunca vem do formulario, e o que o perfil nao pode mudar e mantido.
 */

import { custoItem, custoUnitBase, novoCustoMedio, paraBase, precoAplicavel } from "./regras";
import { temEmbalagem } from "./embalagem";
import { apenasDigitos, validarCNPJ, validarCPF } from "./documentos";
import { permissoes, type Permissoes } from "./permissoes";
import type {
  CaixaMovimento,
  CaixaSessao,
  Cliente,
  Documento,
  Entrada,
  EntradaItem,
  Estado,
  FormaPagamento,
  Fornecedor,
  LogAuditoria,
  MovimentoEstoque,
  Perfil,
  Produto,
  TipoMovimento,
  Venda,
  VendaItem,
} from "./tipos";

// ---------------------------------------------------------------- tipos

/** Listas do estado que uma operacao pode acrescentar. */
export type Lista =
  | "produtos"
  | "clientes"
  | "fornecedores"
  | "entradas"
  | "vendas"
  | "movimentos"
  | "caixaSessoes"
  | "caixaMovimentos"
  | "documentos"
  | "logs";

/** Listas cujas linhas uma operacao pode alterar. */
export type ListaAlteravel = "produtos" | "clientes" | "fornecedores" | "vendas" | "caixaSessoes";

type Linha<K extends Lista> = Estado[K][number];

export interface Efeitos {
  inserir: { [K in Lista]?: Linha<K>[] };
  atualizar: { [K in ListaAlteravel]?: (Partial<Linha<K>> & { id: string })[] };
}

export interface Contexto {
  agora: string; // ISO
  usuarioId: string;
  perfil: Perfil;
  novoId: (prefixo: string) => string;
}

export interface Resultado<T> {
  efeitos: Efeitos;
  valor: T;
}

/** Erro de regra de negocio: a mensagem vai para a tela como esta. */
export class ErroOperacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroOperacao";
  }
}

function falha(mensagem: string): never {
  throw new ErroOperacao(mensagem);
}

// ---------------------------------------------------------------- apoio

const arredonda = (n: number) => Math.round(n * 1000) / 1000;
const inteiro = (n: unknown) => typeof n === "number" && Number.isInteger(n);
const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const texto = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const rotuloVenda = (numero: number) => `venda ${String(numero).padStart(5, "0")}`;

function registro(
  ctx: Contexto,
  acao: string,
  entidade: string,
  entidadeId: string,
  detalhe: string,
): LogAuditoria {
  return {
    id: ctx.novoId("lg"),
    ocorridoEm: ctx.agora,
    usuarioId: ctx.usuarioId,
    acao,
    entidade,
    entidadeId,
    detalhe,
  };
}

/**
 * Copia de trabalho dos produtos que a operacao mexe. Um produto que aparece
 * duas vezes na mesma venda ou entrada acumula certo; no fim, cada produto
 * mexido vira uma atualizacao so.
 */
function mexidos(estado: Estado) {
  const copias = new Map<string, Produto>();
  return {
    pega(id: string): Produto {
      let p = copias.get(id);
      if (!p) {
        const original = estado.produtos.find((x) => x.id === id);
        if (!original) falha("Produto não encontrado.");
        p = { ...original };
        copias.set(id, p);
      }
      return p;
    },
    atualizacoes<K extends keyof Produto>(campos: K[]) {
      return [...copias.values()].map((p) => {
        const parcial: Partial<Produto> & { id: string } = { id: p.id };
        for (const c of campos) parcial[c] = p[c];
        return parcial;
      });
    },
  };
}

const proximoNumero = (lista: { numero: number }[]) =>
  lista.reduce((m, x) => Math.max(m, x.numero), 0) + 1;

const sessaoAberta = (estado: Estado) =>
  estado.caixaSessoes.find((c) => c.status === "ABERTA");

const FORMAS: FormaPagamento[] = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "FIADO"];

// ================================================================ venda

export interface DadosVenda {
  clienteId?: string;
  itens: { produtoId: string; qtd: number; gelado?: boolean; emEmbalagem?: boolean }[];
  desconto: number;
  formaPagamento: FormaPagamento;
  emitirRecibo: boolean;
  /** Gerada pela tela a cada venda: o duplo clique devolve a mesma venda. */
  chaveIdempotencia?: string;
}

export function registrarVenda(estado: Estado, ctx: Contexto, d: DadosVenda): Resultado<Venda> {
  const repetida = d.chaveIdempotencia
    ? estado.vendas.find((v) => v.chaveIdempotencia === d.chaveIdempotencia)
    : undefined;
  if (repetida) return { valor: repetida, efeitos: { inserir: {}, atualizar: {} } };

  if (!Array.isArray(d.itens) || d.itens.length === 0) falha("A venda não tem itens.");
  if (!FORMAS.includes(d.formaPagamento)) falha("Forma de pagamento inválida.");

  const cliente = d.clienteId
    ? (estado.clientes.find((c) => c.id === d.clienteId) ?? falha("Cliente não encontrado."))
    : null;
  if (cliente && !cliente.ativo) falha(`${cliente.nomeRazao} está desativado.`);

  const vendaId = ctx.novoId("vd");
  const numero = proximoNumero(estado.vendas);
  const produtos = mexidos(estado);
  const itens: VendaItem[] = [];
  const movimentos: MovimentoEstoque[] = [];

  for (const i of d.itens) {
    const p = produtos.pega(i.produtoId);
    if (!p.ativo || p.tipo !== "NORMAL") falha(`${p.nome} não está à venda.`);
    if (p.precoVarejo <= 0)
      falha(`${p.nome} está sem preço: a administradora precisa definir antes de vender.`);
    if (!finito(i.qtd) || i.qtd <= 0) falha(`Quantidade inválida para ${p.nome}.`);
    if (i.emEmbalagem && (!temEmbalagem(p) || i.qtd % p.fatorConversao !== 0))
      falha(`${p.nome}: a quantidade não fecha embalagens inteiras.`);

    // regra de preco no servidor: o valor que veio da tela nao conta
    const preco = precoAplicavel(p, i.qtd, cliente, i.gelado === true);
    itens.push({
      id: ctx.novoId("vi"),
      produtoId: p.id,
      descricao: p.nome,
      qtd: i.qtd,
      precoUnit: preco.preco,
      custoUnit: p.custoMedio, // regra 3: congela o custo aqui
      tipoPrecoAplicado: preco.tipo,
      ...(i.emEmbalagem
        ? { embalagem: { unidade: p.unidadeCompra, fator: p.fatorConversao } }
        : {}),
      ...(preco.gelado ? { gelado: true, adicionalGelado: preco.preco - preco.natural } : {}),
      total: Math.round(i.qtd * preco.preco),
    });

    // baixa de estoque + casco junto (regra 5)
    p.saldoAtual = arredonda(p.saldoAtual - i.qtd);
    movimentos.push({
      id: ctx.novoId("mv"),
      produtoId: p.id,
      data: ctx.agora,
      tipo: "SAIDA",
      qtd: -i.qtd,
      saldoApos: p.saldoAtual,
      custoUnitNoMomento: p.custoMedio,
      origemTipo: "VENDA",
      origemId: vendaId,
      usuarioId: ctx.usuarioId,
    });
    if (p.vasilhameId) {
      const casco = produtos.pega(p.vasilhameId);
      casco.saldoAtual = arredonda(casco.saldoAtual + i.qtd);
      movimentos.push({
        id: ctx.novoId("mv"),
        produtoId: casco.id,
        data: ctx.agora,
        tipo: "ENTRADA",
        qtd: i.qtd,
        saldoApos: casco.saldoAtual,
        custoUnitNoMomento: casco.custoMedio,
        origemTipo: "VENDA",
        origemId: vendaId,
        usuarioId: ctx.usuarioId,
        motivo: "Casco com o cliente",
      });
    }
  }

  const subtotal = itens.reduce((a, i) => a + i.total, 0);
  const desconto = d.desconto || 0;
  if (!inteiro(desconto) || desconto < 0) falha("Desconto inválido.");
  if (desconto > subtotal) falha("O desconto é maior que o valor da venda.");

  const venda: Venda = {
    id: vendaId,
    numero,
    clienteId: cliente?.id,
    data: ctx.agora,
    usuarioId: ctx.usuarioId,
    caixaSessaoId: sessaoAberta(estado)?.id,
    tipoPreco: itens[0].tipoPrecoAplicado,
    itens,
    subtotal,
    desconto,
    total: subtotal - desconto,
    custoTotal: itens.reduce((a, i) => a + custoItem(i.qtd, i.custoUnit), 0),
    formaPagamento: d.formaPagamento,
    status: "FECHADA",
    ...(d.chaveIdempotencia ? { chaveIdempotencia: d.chaveIdempotencia } : {}),
  };

  // regra 4: fiado nao entra no caixa
  const sessao = sessaoAberta(estado);
  const caixaMovimentos: CaixaMovimento[] =
    sessao && d.formaPagamento !== "FIADO"
      ? [
          {
            id: ctx.novoId("cm"),
            caixaSessaoId: sessao.id,
            data: ctx.agora,
            tipo: "VENDA",
            formaPagamento: d.formaPagamento,
            valor: venda.total,
            vendaId,
            descricao: `Venda ${String(numero).padStart(5, "0")}`,
          },
        ]
      : [];

  const documentos: Documento[] = d.emitirRecibo
    ? [
        {
          id: ctx.novoId("dc"),
          vendaId,
          tipo: "RECIBO",
          numero: proximoNumero(estado.documentos),
          emitidoEm: ctx.agora,
          emitenteSnapshot: { ...estado.empresa },
          destinatarioSnapshot: cliente ? { ...cliente } : null,
        },
      ]
    : [];

  return {
    valor: venda,
    efeitos: {
      inserir: {
        vendas: [venda],
        movimentos,
        caixaMovimentos,
        documentos,
        logs: [registro(ctx, "REGISTRAR_VENDA", "venda", vendaId, `Venda ${numero}`)],
      },
      atualizar: { produtos: produtos.atualizacoes(["saldoAtual"]) },
    },
  };
}

export function cancelarVenda(
  estado: Estado,
  ctx: Contexto,
  d: { vendaId: string; motivo: string },
): Resultado<Venda> {
  const motivo = texto(d.motivo);
  if (motivo.length < 3) falha("Escreva o motivo do cancelamento.");
  const v = estado.vendas.find((x) => x.id === d.vendaId) ?? falha("Venda não encontrada.");
  if (v.status === "CANCELADA") falha("Esta venda já foi cancelada.");

  const rotulo = rotuloVenda(v.numero);
  const produtos = mexidos(estado);
  const movimentos: MovimentoEstoque[] = [];

  // nada e apagado: cada item volta por um movimento novo de devolucao, e o
  // custo medio nao muda (so a entrada mexe no custo)
  for (const it of v.itens) {
    if (!estado.produtos.some((x) => x.id === it.produtoId)) continue;
    const p = produtos.pega(it.produtoId);
    p.saldoAtual = arredonda(p.saldoAtual + it.qtd);
    movimentos.push({
      id: ctx.novoId("mv"),
      produtoId: p.id,
      data: ctx.agora,
      tipo: "DEVOLUCAO",
      qtd: it.qtd,
      saldoApos: p.saldoAtual,
      custoUnitNoMomento: p.custoMedio,
      origemTipo: "VENDA",
      origemId: v.id,
      usuarioId: ctx.usuarioId,
      motivo: `Cancelamento da ${rotulo}`,
    });
    if (p.vasilhameId && estado.produtos.some((x) => x.id === p.vasilhameId)) {
      const casco = produtos.pega(p.vasilhameId);
      casco.saldoAtual = arredonda(casco.saldoAtual - it.qtd);
      movimentos.push({
        id: ctx.novoId("mv"),
        produtoId: casco.id,
        data: ctx.agora,
        tipo: "DEVOLUCAO",
        qtd: -it.qtd,
        saldoApos: casco.saldoAtual,
        custoUnitNoMomento: casco.custoMedio,
        origemTipo: "VENDA",
        origemId: v.id,
        usuarioId: ctx.usuarioId,
        motivo: `Casco volta com o cancelamento da ${rotulo}`,
      });
    }
  }

  // o dinheiro volta pelo caixa aberto; fiado nunca entrou no caixa
  const sessao = sessaoAberta(estado);
  const caixaMovimentos: CaixaMovimento[] =
    sessao && v.formaPagamento !== "FIADO"
      ? [
          {
            id: ctx.novoId("cm"),
            caixaSessaoId: sessao.id,
            data: ctx.agora,
            tipo: "ESTORNO",
            formaPagamento: v.formaPagamento,
            valor: -v.total,
            vendaId: v.id,
            descricao: `Estorno da ${rotulo}`,
          },
        ]
      : [];

  const cancelada: Venda = {
    ...v,
    status: "CANCELADA",
    canceladaEm: ctx.agora,
    canceladaPor: ctx.usuarioId,
    motivoCancelamento: motivo,
  };

  return {
    valor: cancelada,
    efeitos: {
      inserir: {
        movimentos,
        caixaMovimentos,
        logs: [registro(ctx, "CANCELAR_VENDA", "venda", v.id, `${rotulo}: ${motivo}`)],
      },
      atualizar: {
        vendas: [
          {
            id: v.id,
            status: "CANCELADA",
            canceladaEm: ctx.agora,
            canceladaPor: ctx.usuarioId,
            motivoCancelamento: motivo,
          },
        ],
        produtos: produtos.atualizacoes(["saldoAtual"]),
      },
    },
  };
}

// ================================================================ entrada

export interface DadosEntrada {
  fornecedorId: string;
  documentoFornecedor: string;
  itens: {
    produtoId: string;
    /** Na embalagem do produto, ou em unidade quando `porUnidade`. */
    qtdCompra: number;
    /** Centavos por embalagem — ou por unidade, quando `porUnidade`. */
    custoUnitCompra: number;
    porUnidade?: boolean;
  }[];
  observacao?: string;
}

export function registrarEntrada(estado: Estado, ctx: Contexto, d: DadosEntrada): Resultado<Entrada> {
  const fornecedor =
    estado.fornecedores.find((f) => f.id === d.fornecedorId) ?? falha("Escolha o fornecedor.");
  if (fornecedor.ativo === false) falha(`${fornecedor.razaoSocial} está desativado.`);
  if (!Array.isArray(d.itens) || d.itens.length === 0) falha("A entrada não tem itens.");

  const entradaId = ctx.novoId("en");
  const produtos = mexidos(estado);
  const itens: EntradaItem[] = [];
  const movimentos: MovimentoEstoque[] = [];

  for (const i of d.itens) {
    const p = produtos.pega(i.produtoId);
    if (p.tipo !== "NORMAL") falha(`${p.nome} não entra por compra.`);
    if (!finito(i.qtdCompra) || i.qtdCompra <= 0) falha(`Quantidade inválida para ${p.nome}.`);
    if (!inteiro(i.custoUnitCompra) || i.custoUnitCompra <= 0)
      falha(`Informe o custo de ${p.nome}.`);

    // avulso: cada "embalagem" e uma unidade so
    const fator = i.porUnidade ? 1 : p.fatorConversao;
    const qtdBase = paraBase(i.qtdCompra, fator);
    const cBase = custoUnitBase(i.custoUnitCompra, fator);

    // regra 2: o custo medio so muda aqui
    p.custoMedio = novoCustoMedio(p.saldoAtual, p.custoMedio, qtdBase, cBase);
    p.custoUltimaCompra = cBase;
    p.saldoAtual = arredonda(p.saldoAtual + qtdBase);

    itens.push({
      id: ctx.novoId("ei"),
      produtoId: p.id,
      qtdCompra: i.qtdCompra,
      unidadeCompra: i.porUnidade ? "UN" : p.unidadeCompra,
      fatorConversao: fator,
      qtdBase,
      custoUnitCompra: i.custoUnitCompra,
      custoUnitBase: cBase,
      valorTotal: Math.round(i.qtdCompra * i.custoUnitCompra),
    });
    movimentos.push({
      id: ctx.novoId("mv"),
      produtoId: p.id,
      data: ctx.agora,
      tipo: "ENTRADA",
      qtd: qtdBase,
      saldoApos: p.saldoAtual,
      custoUnitNoMomento: p.custoMedio,
      origemTipo: "ENTRADA",
      origemId: entradaId,
      usuarioId: ctx.usuarioId,
    });
  }

  const documento = texto(d.documentoFornecedor) || "sem documento";
  const entrada: Entrada = {
    id: entradaId,
    numero: proximoNumero(estado.entradas),
    fornecedorId: fornecedor.id,
    data: ctx.agora,
    documentoFornecedor: documento,
    itens,
    valorTotal: itens.reduce((a, i) => a + i.valorTotal, 0),
    usuarioId: ctx.usuarioId,
    ...(texto(d.observacao) ? { observacao: texto(d.observacao) } : {}),
  };

  return {
    valor: entrada,
    efeitos: {
      inserir: {
        entradas: [entrada],
        movimentos,
        logs: [registro(ctx, "LANCAR_ENTRADA", "entrada", entradaId, documento)],
      },
      atualizar: {
        produtos: produtos.atualizacoes(["saldoAtual", "custoMedio", "custoUltimaCompra"]),
      },
    },
  };
}

// ================================================================ estoque

const TIPOS_AJUSTE: TipoMovimento[] = ["AJUSTE", "PERDA", "INVENTARIO_INICIAL"];

export interface DadosAjuste {
  produtoId: string;
  novaQtd: number;
  tipo: TipoMovimento;
  motivo: string;
}

/**
 * Ajuste de contagem, perda ou inventario de abertura. Varios de uma vez (a
 * carga inicial grava a contagem inteira numa transacao so).
 */
export function ajustarEstoque(
  estado: Estado,
  ctx: Contexto,
  d: { ajustes: DadosAjuste[] },
): Resultado<number> {
  if (!Array.isArray(d.ajustes) || d.ajustes.length === 0) falha("Nada para ajustar.");
  const produtos = mexidos(estado);
  const movimentos: MovimentoEstoque[] = [];
  const logs: LogAuditoria[] = [];

  for (const a of d.ajustes) {
    const motivo = texto(a.motivo);
    if (!motivo) falha("Escreva o motivo do ajuste.");
    if (!TIPOS_AJUSTE.includes(a.tipo)) falha("Tipo de ajuste inválido.");
    if (!finito(a.novaQtd) || a.novaQtd < 0) falha("A quantidade contada não pode ser negativa.");
    const p = produtos.pega(a.produtoId);
    const novaQtd = arredonda(a.novaQtd);
    const delta = arredonda(novaQtd - p.saldoAtual);
    if (delta === 0) continue;
    p.saldoAtual = novaQtd;
    movimentos.push({
      id: ctx.novoId("mv"),
      produtoId: p.id,
      data: ctx.agora,
      tipo: a.tipo,
      qtd: delta,
      saldoApos: novaQtd,
      custoUnitNoMomento: p.custoMedio,
      origemTipo: a.tipo === "INVENTARIO_INICIAL" ? "CARGA_INICIAL" : "AJUSTE",
      usuarioId: ctx.usuarioId,
      motivo,
    });
    logs.push(registro(ctx, "AJUSTE_ESTOQUE", "produto", p.id, `${p.nome}: ${motivo}`));
  }

  return {
    valor: movimentos.length,
    efeitos: {
      inserir: { movimentos, logs },
      atualizar: { produtos: produtos.atualizacoes(["saldoAtual"]) },
    },
  };
}

// ================================================================ produto

const CAMPOS_DE_PRECO = [
  "precoVarejo",
  "precoAtacado",
  "precoGelado",
  "vendeGelado",
  "qtdMinimaAtacado",
] as const;

function validarProduto(estado: Estado, p: Produto) {
  if (!texto(p.nome)) falha("Informe o nome do produto.");
  if (!inteiro(p.fatorConversao) || p.fatorConversao < 1)
    falha("Quantas unidades vêm em cada embalagem?");
  for (const c of ["precoVarejo", "precoAtacado"] as const)
    if (!inteiro(p[c]) || p[c] < 0) falha("Preço inválido.");
  if (p.vendeGelado && (!inteiro(p.precoGelado) || (p.precoGelado ?? 0) <= 0))
    falha("Informe o preço gelado ou desmarque a opção.");
  if (!estado.categorias.some((c) => c.id === p.categoriaId)) falha("Categoria inválida.");
  if (p.vasilhameId && !estado.produtos.some((x) => x.id === p.vasilhameId && x.tipo === "VASILHAME"))
    falha("Casco inválido.");
  const codigo = texto(p.codigoBarras);
  const repetido = codigo
    ? estado.produtos.find((x) => x.id !== p.id && x.codigoBarras === codigo)
    : undefined;
  if (repetido) falha(`Código de barras já usado em ${repetido.nome}.`);
}

/** O que o formulario pode mexer. Custo e saldo so mudam por entrada e ajuste. */
function camposEditaveis(p: Produto) {
  return {
    sku: texto(p.sku),
    codigoBarras: texto(p.codigoBarras),
    nome: texto(p.nome),
    categoriaId: p.categoriaId,
    vasilhameId: p.vasilhameId || undefined,
    unidadeCompra: p.unidadeCompra,
    fatorConversao: p.unidadeCompra === "UN" ? 1 : p.fatorConversao,
    precoVarejo: p.precoVarejo,
    precoAtacado: p.precoAtacado,
    precoGelado: p.vendeGelado ? p.precoGelado : undefined,
    vendeGelado: p.vendeGelado === true,
    qtdMinimaAtacado: p.qtdMinimaAtacado,
    estoqueMinimo: p.estoqueMinimo,
    ncm: texto(p.ncm),
  } satisfies Partial<Produto>;
}

export function salvarProduto(estado: Estado, ctx: Contexto, d: { produto: Produto }): Resultado<Produto> {
  const pode = permissoes(ctx.perfil);
  const atual = estado.produtos.find((x) => x.id === d.produto.id) ?? falha("Produto não encontrado.");
  const editado = camposEditaveis(d.produto);
  // so a dona mexe em preco: dos outros perfis, o preco que veio e ignorado
  if (!pode.podeDefinirPreco) for (const c of CAMPOS_DE_PRECO) delete (editado as Partial<Produto>)[c];
  const final: Produto = { ...atual, ...editado, ...(editado.vendeGelado === false ? { precoGelado: undefined } : {}) };
  validarProduto(estado, final);

  const mudouPreco = CAMPOS_DE_PRECO.some((c) => final[c] !== atual[c]);
  const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const logs = [registro(ctx, "ALTERAR_PRODUTO", "produto", final.id, final.nome)];
  if (mudouPreco)
    logs.push(
      registro(
        ctx,
        "ALTERAR_PRECO",
        "produto",
        final.id,
        `${final.nome}: varejo ${reais(atual.precoVarejo)} → ${reais(final.precoVarejo)}, ` +
          `atacado ${reais(atual.precoAtacado)} → ${reais(final.precoAtacado)}` +
          (final.vendeGelado ? `, gelado ${reais(atual.precoGelado ?? 0)} → ${reais(final.precoGelado ?? 0)}` : ""),
      ),
    );

  return {
    valor: final,
    efeitos: { inserir: { logs }, atualizar: { produtos: [{ ...editado, id: final.id, precoGelado: final.precoGelado }] } },
  };
}

export function cadastrarProduto(
  estado: Estado,
  ctx: Contexto,
  d: { produto: Produto; estoqueInicial?: { qtdCompra: number; custoUnitCompra: number } },
): Resultado<Produto> {
  const pode = permissoes(ctx.perfil);
  const id = ctx.novoId("p");
  const editado = camposEditaveis(d.produto);
  if (!pode.podeDefinirPreco) {
    // o estoque cadastra sem preco: o produto fica "sem preco" ate a dona definir
    Object.assign(editado, { precoVarejo: 0, precoAtacado: 0, precoGelado: undefined, vendeGelado: false });
  }

  const ini = d.estoqueInicial;
  const temEstoque = !!ini && finito(ini.qtdCompra) && ini.qtdCompra > 0 && inteiro(ini.custoUnitCompra) && ini.custoUnitCompra > 0;
  if (ini && !temEstoque && (ini.qtdCompra || ini.custoUnitCompra))
    falha("Informe a quantidade e o custo do que já está no depósito.");
  const qtdBase = temEstoque ? paraBase(ini!.qtdCompra, editado.fatorConversao) : 0;
  const cBase = temEstoque ? custoUnitBase(ini!.custoUnitCompra, editado.fatorConversao) : 0;

  // so os codigos SKU0001..: o casco "V-600" nao pode virar o SKU0601
  const proximo =
    estado.produtos.reduce((m, p) => {
      const achou = /^SKU(\d+)$/.exec(p.sku);
      return achou ? Math.max(m, Number(achou[1])) : m;
    }, 0) + 1;

  const produto: Produto = {
    ...editado,
    id,
    sku: editado.sku || `SKU${String(proximo).padStart(4, "0")}`,
    tipo: "NORMAL",
    unidadeBase: "UN",
    custoMedio: cBase,
    custoUltimaCompra: cBase,
    saldoAtual: qtdBase,
    ativo: true,
  };
  validarProduto(estado, produto);
  if (estado.produtos.some((x) => x.sku === produto.sku)) falha(`O código ${produto.sku} já existe.`);

  // regra 2: o custo so nasce de uma entrada — aqui, o estoque de abertura
  const movimentos: MovimentoEstoque[] = temEstoque
    ? [
        {
          id: ctx.novoId("mv"),
          produtoId: id,
          data: ctx.agora,
          tipo: "INVENTARIO_INICIAL",
          qtd: qtdBase,
          saldoApos: qtdBase,
          custoUnitNoMomento: cBase,
          origemTipo: "CARGA_INICIAL",
          usuarioId: ctx.usuarioId,
          motivo: "Estoque informado no cadastro",
        },
      ]
    : [];

  return {
    valor: produto,
    efeitos: {
      inserir: {
        produtos: [produto],
        movimentos,
        logs: [registro(ctx, "CRIAR_PRODUTO", "produto", id, produto.nome)],
      },
      atualizar: {},
    },
  };
}

// ================================================================ cadastros

function exigirPermissaoDeDesativar(pode: Permissoes, mudou: boolean) {
  if (mudou && !pode.podeDesativarCadastro) falha("Só a administradora desativa cadastro.");
}

export function salvarCliente(estado: Estado, ctx: Contexto, d: { cliente: Cliente }): Resultado<Cliente> {
  const pode = permissoes(ctx.perfil);
  const c = d.cliente;
  const atual = c.id ? estado.clientes.find((x) => x.id === c.id) : undefined;
  if (c.id && !atual) falha("Cliente não encontrado.");

  const nome = texto(c.nomeRazao);
  if (!nome) falha(c.tipo === "PJ" ? "Informe a razão social." : "Informe o nome.");
  if (c.tipo !== "PF" && c.tipo !== "PJ") falha("Tipo de cliente inválido.");
  const doc = apenasDigitos(c.cpfCnpj ?? "");
  if (c.tipo === "PJ" && !validarCNPJ(doc)) falha("CNPJ inválido — confira os números.");
  if (c.tipo === "PF" && doc && !validarCPF(doc)) falha("CPF inválido — confira os números.");
  const repetido = doc
    ? estado.clientes.find((x) => x.id !== c.id && apenasDigitos(x.cpfCnpj) === doc)
    : undefined;
  if (repetido) falha(`Já existe um cliente com este documento: ${repetido.nomeRazao}.`);

  const ativo = atual ? c.ativo !== false : true;
  exigirPermissaoDeDesativar(pode, !!atual && ativo !== atual.ativo);

  const limite = pode.podeDefinirPreco ? c.limiteCredito : (atual?.limiteCredito ?? 0);
  if (!inteiro(limite) || limite < 0) falha("Limite de crédito inválido.");

  const gravado: Cliente = {
    id: atual?.id ?? ctx.novoId("cl"),
    tipo: c.tipo,
    nomeRazao: nome,
    cpfCnpj: texto(c.cpfCnpj),
    ...(c.tipo === "PJ" && texto(c.inscricaoEstadual) ? { inscricaoEstadual: texto(c.inscricaoEstadual) } : {}),
    telefone: texto(c.telefone),
    ...(texto(c.email) ? { email: texto(c.email) } : {}),
    endereco: texto(c.endereco),
    // tabela de preco e limite de fiado: so a dona define
    tipoPreco: pode.podeDefinirPreco
      ? c.tipoPreco === "ATACADO" ? "ATACADO" : "VAREJO"
      : (atual?.tipoPreco ?? "VAREJO"),
    limiteCredito: limite,
    ativo,
  };

  const log = registro(ctx, atual ? "ALTERAR_CLIENTE" : "CRIAR_CLIENTE", "cliente", gravado.id, gravado.nomeRazao);
  return {
    valor: gravado,
    efeitos: atual
      ? { inserir: { logs: [log] }, atualizar: { clientes: [gravado] } }
      : { inserir: { clientes: [gravado], logs: [log] }, atualizar: {} },
  };
}

export function salvarFornecedor(
  estado: Estado,
  ctx: Contexto,
  d: { fornecedor: Fornecedor },
): Resultado<Fornecedor> {
  const pode = permissoes(ctx.perfil);
  const f = d.fornecedor;
  const atual = f.id ? estado.fornecedores.find((x) => x.id === f.id) : undefined;
  if (f.id && !atual) falha("Fornecedor não encontrado.");

  const nome = texto(f.razaoSocial);
  if (!nome) falha("Informe a razão social.");
  const doc = apenasDigitos(f.cnpj ?? "");
  if (!validarCNPJ(doc)) falha("CNPJ inválido — confira os números.");
  const repetido = estado.fornecedores.find((x) => x.id !== f.id && apenasDigitos(x.cnpj) === doc);
  if (repetido) falha(`Já existe um fornecedor com este CNPJ: ${repetido.razaoSocial}.`);

  const ativo = atual ? f.ativo !== false : true;
  exigirPermissaoDeDesativar(pode, !!atual && ativo !== (atual.ativo !== false));

  const gravado: Fornecedor = {
    id: atual?.id ?? ctx.novoId("f"),
    razaoSocial: nome,
    cnpj: texto(f.cnpj),
    telefone: texto(f.telefone),
    email: texto(f.email),
    endereco: texto(f.endereco),
    ativo,
  };
  const log = registro(
    ctx,
    atual ? "ALTERAR_FORNECEDOR" : "CRIAR_FORNECEDOR",
    "fornecedor",
    gravado.id,
    gravado.razaoSocial,
  );
  return {
    valor: gravado,
    efeitos: atual
      ? { inserir: { logs: [log] }, atualizar: { fornecedores: [gravado] } }
      : { inserir: { fornecedores: [gravado], logs: [log] }, atualizar: {} },
  };
}

// ================================================================ caixa

export function abrirCaixa(estado: Estado, ctx: Contexto, d: { fundoTroco: number }): Resultado<CaixaSessao> {
  if (sessaoAberta(estado)) falha("Já existe um caixa aberto.");
  if (!inteiro(d.fundoTroco) || d.fundoTroco < 0) falha("Fundo de troco inválido.");
  const sessao: CaixaSessao = {
    id: ctx.novoId("cs"),
    usuarioId: ctx.usuarioId,
    abertaEm: ctx.agora,
    fundoTroco: d.fundoTroco,
    status: "ABERTA",
  };
  return {
    valor: sessao,
    efeitos: {
      inserir: {
        caixaSessoes: [sessao],
        logs: [registro(ctx, "ABRIR_CAIXA", "caixa", sessao.id, "Abertura de caixa")],
      },
      atualizar: {},
    },
  };
}

export function lancarCaixa(
  estado: Estado,
  ctx: Contexto,
  d: { tipo: "SANGRIA" | "SUPRIMENTO" | "DESPESA"; valor: number; descricao: string },
): Resultado<CaixaMovimento> {
  const sessao = sessaoAberta(estado) ?? falha("Abra o caixa antes.");
  if (!["SANGRIA", "SUPRIMENTO", "DESPESA"].includes(d.tipo)) falha("Lançamento inválido.");
  const descricao = texto(d.descricao);
  if (!descricao) falha("Escreva a descrição do lançamento.");
  // suprimento entra na gaveta; sangria e despesa saem
  const sinalCerto = d.tipo === "SUPRIMENTO" ? d.valor > 0 : d.valor < 0;
  if (!inteiro(d.valor) || !sinalCerto) falha("Valor inválido.");
  const mov: CaixaMovimento = {
    id: ctx.novoId("cm"),
    caixaSessaoId: sessao.id,
    data: ctx.agora,
    tipo: d.tipo,
    valor: d.valor,
    descricao,
  };
  return {
    valor: mov,
    efeitos: {
      inserir: { caixaMovimentos: [mov], logs: [registro(ctx, d.tipo, "caixa", sessao.id, descricao)] },
      atualizar: {},
    },
  };
}

export function fecharCaixa(estado: Estado, ctx: Contexto, d: { valorContado: number }): Resultado<CaixaSessao> {
  const sessao = sessaoAberta(estado) ?? falha("Não há caixa aberto.");
  if (!inteiro(d.valorContado) || d.valorContado < 0) falha("Valor contado inválido.");
  const fechada: CaixaSessao = {
    ...sessao,
    fechadaEm: ctx.agora,
    valorContado: d.valorContado,
    status: "FECHADA",
  };
  return {
    valor: fechada,
    efeitos: {
      inserir: { logs: [registro(ctx, "FECHAR_CAIXA", "caixa", sessao.id, "Fechamento de caixa")] },
      atualizar: {
        caixaSessoes: [
          { id: sessao.id, fechadaEm: ctx.agora, valorContado: d.valorContado, status: "FECHADA" },
        ],
      },
    },
  };
}

// ================================================================ catalogo

/**
 * Todas as operacoes, com o que cada perfil pode fazer. O servidor so executa
 * o que esta aqui, e so para quem a permissao deixa.
 */
export const OPERACOES = {
  registrarVenda: { fn: registrarVenda, pode: (p: Permissoes) => p.podeVender },
  cancelarVenda: { fn: cancelarVenda, pode: (p: Permissoes) => p.podeCancelarVenda },
  registrarEntrada: { fn: registrarEntrada, pode: (p: Permissoes) => p.podeEstoque },
  ajustarEstoque: { fn: ajustarEstoque, pode: (p: Permissoes) => p.podeEstoque },
  salvarProduto: { fn: salvarProduto, pode: (p: Permissoes) => p.podeCadastrarProduto },
  cadastrarProduto: { fn: cadastrarProduto, pode: (p: Permissoes) => p.podeCadastrarProduto },
  salvarCliente: { fn: salvarCliente, pode: (p: Permissoes) => p.podeCadastrarCliente },
  salvarFornecedor: { fn: salvarFornecedor, pode: (p: Permissoes) => p.podeCadastrarFornecedor },
  abrirCaixa: { fn: abrirCaixa, pode: (p: Permissoes) => p.podeVender },
  lancarCaixa: { fn: lancarCaixa, pode: (p: Permissoes) => p.podeVender },
  fecharCaixa: { fn: fecharCaixa, pode: (p: Permissoes) => p.podeVender },
} as const;

export type NomeOperacao = keyof typeof OPERACOES;
export type DadosDe<N extends NomeOperacao> = Parameters<(typeof OPERACOES)[N]["fn"]>[2];
export type ValorDe<N extends NomeOperacao> = ReturnType<(typeof OPERACOES)[N]["fn"]>["valor"];

/** Executa a operacao checando a permissao do perfil — a mesma checagem nos dois modos. */
export function executarOperacao<N extends NomeOperacao>(
  nome: N,
  estado: Estado,
  ctx: Contexto,
  dados: DadosDe<N>,
): Resultado<ValorDe<N>> {
  const op = OPERACOES[nome];
  if (!op) falha("Operação desconhecida.");
  if (!op.pode(permissoes(ctx.perfil))) falha("Seu perfil não pode fazer isso.");
  const fn = op.fn as (e: Estado, c: Contexto, d: DadosDe<N>) => Resultado<ValorDe<N>>;
  return fn(estado, ctx, dados);
}

// ================================================================ aplicar

/** Listas guardadas da mais nova para a mais antiga. */
const NOVAS_PRIMEIRO: Lista[] = ["vendas", "entradas", "logs"];

/**
 * Aplica os efeitos num estado em memoria. E o que a demonstracao grava, e o
 * que a tela faz com a resposta do servidor no modo banco — os dois chegam ao
 * mesmo estado.
 */
export function aplicarEfeitos(estado: Estado, ef: Efeitos): Estado {
  const novo: Estado = { ...estado };
  const alvo = novo as unknown as Record<Lista, { id: string }[]>;

  for (const [lista, linhas] of Object.entries(ef.atualizar) as [ListaAlteravel, { id: string }[]][]) {
    if (!linhas?.length) continue;
    const porId = new Map(linhas.map((l) => [l.id, l]));
    alvo[lista] = alvo[lista].map((x) => {
      const mudanca = porId.get(x.id);
      return mudanca ? { ...x, ...mudanca } : x;
    });
  }
  for (const [lista, linhas] of Object.entries(ef.inserir) as [Lista, { id: string }[]][]) {
    if (!linhas?.length) continue;
    alvo[lista] = NOVAS_PRIMEIRO.includes(lista)
      ? [...[...linhas].reverse(), ...alvo[lista]]
      : [...alvo[lista], ...linhas];
  }
  return novo;
}
