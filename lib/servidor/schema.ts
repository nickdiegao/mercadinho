/**
 * As quinze tabelas do blueprint, no Postgres.
 *
 * Os nomes em JavaScript sao os mesmos do dominio (lib/tipos.ts), para a
 * leitura virar objeto do sistema sem traducao campo a campo. No banco, as
 * colunas ficam em snake_case.
 *
 * Unidades, iguais as do mockup:
 *   dinheiro     integer em centavos
 *   custo medio  integer em 1/10000 de real
 *   quantidade   numeric(12,3), em unidade base
 *
 * As constraints sao a ultima linha de defesa: mesmo com bug na aplicacao,
 * o banco recusa preco negativo, quantidade zero e dois caixas abertos.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { Cliente, Empresa } from "../tipos";

// ---------------------------------------------------------------- tipos

const quantidade = (nome: string) => numeric(nome, { precision: 12, scale: 3, mode: "number" });
const momento = (nome: string) => timestamp(nome, { withTimezone: true, mode: "string" });
/** Ordem de gravacao: dois movimentos no mesmo milissegundo saem na ordem certa. */
const ordem = () => bigint("ordem", { mode: "number" }).generatedAlwaysAsIdentity();

export const perfil = pgEnum("perfil", ["ADMIN", "CAIXA", "ESTOQUE"]);
export const tipoPreco = pgEnum("tipo_preco", ["VAREJO", "ATACADO"]);
export const tipoProduto = pgEnum("tipo_produto", ["NORMAL", "VASILHAME"]);
export const unidadeBase = pgEnum("unidade_base", ["UN", "L"]);
export const unidadeCompra = pgEnum("unidade_compra", ["UN", "CX", "FD", "ENG", "BARRIL"]);
export const tipoMovimento = pgEnum("tipo_movimento", [
  "ENTRADA",
  "SAIDA",
  "AJUSTE",
  "PERDA",
  "DEVOLUCAO",
  "INVENTARIO_INICIAL",
]);
export const origemMovimento = pgEnum("origem_movimento", ["ENTRADA", "VENDA", "AJUSTE", "CARGA_INICIAL"]);
export const formaPagamento = pgEnum("forma_pagamento", ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "FIADO"]);
export const tipoCaixaMov = pgEnum("tipo_caixa_mov", [
  "VENDA",
  "SANGRIA",
  "SUPRIMENTO",
  "DESPESA",
  "RECEBIMENTO",
  "ESTORNO",
]);
export const statusVenda = pgEnum("status_venda", ["FECHADA", "CANCELADA"]);
export const statusCaixa = pgEnum("status_caixa", ["ABERTA", "FECHADA"]);
export const tipoDocumento = pgEnum("tipo_documento", ["RECIBO", "PEDIDO", "NFE", "NFCE"]);
export const tipoCliente = pgEnum("tipo_cliente", ["PF", "PJ"]);

// ---------------------------------------------------------------- cadastro

/** Emitente. Uma linha so — o id e sempre 1. */
export const empresa = pgTable(
  "empresa",
  {
    id: integer("id").primaryKey().default(1),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia").notNull(),
    cnpj: text("cnpj").notNull(),
    inscricaoEstadual: text("inscricao_estadual").notNull().default(""),
    regimeTributario: text("regime_tributario").notNull().default(""),
    endereco: text("endereco").notNull().default(""),
    telefone: text("telefone").notNull().default(""),
    email: text("email").notNull().default(""),
  },
  (t) => [check("empresa_uma_so", sql`${t.id} = 1`)],
);

export const usuarios = pgTable(
  "usuarios",
  {
    id: text("id").primaryKey(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    /** Nunca a senha: so o hash bcrypt. */
    senhaHash: text("senha_hash").notNull(),
    perfil: perfil("perfil").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    /** 5 erros seguidos travam o login por 15 minutos. */
    tentativasFalhas: integer("tentativas_falhas").notNull().default(0),
    bloqueadoAte: momento("bloqueado_ate"),
  },
  (t) => [uniqueIndex("usuarios_email_unico").on(sql`lower(${t.email})`)],
);

export const categorias = pgTable("categorias", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  categoriaPaiId: text("categoria_pai_id").references((): AnyPgColumn => categorias.id),
});

export const fornecedores = pgTable("fornecedores", {
  id: text("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  cnpj: text("cnpj").notNull(),
  telefone: text("telefone").notNull().default(""),
  email: text("email").notNull().default(""),
  endereco: text("endereco").notNull().default(""),
  ativo: boolean("ativo").notNull().default(true),
});

export const clientes = pgTable(
  "clientes",
  {
    id: text("id").primaryKey(),
    tipo: tipoCliente("tipo").notNull(),
    nomeRazao: text("nome_razao").notNull(),
    cpfCnpj: text("cpf_cnpj").notNull().default(""),
    inscricaoEstadual: text("inscricao_estadual"),
    telefone: text("telefone").notNull().default(""),
    email: text("email"),
    endereco: text("endereco").notNull().default(""),
    tipoPreco: tipoPreco("tipo_preco").notNull().default("VAREJO"),
    limiteCredito: integer("limite_credito").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [check("clientes_limite_positivo", sql`${t.limiteCredito} >= 0`)],
);

export const produtos = pgTable(
  "produtos",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    codigoBarras: text("codigo_barras").notNull().default(""),
    nome: text("nome").notNull(),
    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categorias.id),
    tipo: tipoProduto("tipo").notNull().default("NORMAL"),
    vasilhameId: text("vasilhame_id").references((): AnyPgColumn => produtos.id),
    unidadeBase: unidadeBase("unidade_base").notNull().default("UN"),
    unidadeCompra: unidadeCompra("unidade_compra").notNull(),
    fatorConversao: integer("fator_conversao").notNull(),
    custoMedio: integer("custo_medio").notNull().default(0),
    custoUltimaCompra: integer("custo_ultima_compra").notNull().default(0),
    precoVarejo: integer("preco_varejo").notNull().default(0),
    precoAtacado: integer("preco_atacado").notNull().default(0),
    precoGelado: integer("preco_gelado"),
    vendeGelado: boolean("vende_gelado"),
    qtdMinimaAtacado: quantidade("qtd_minima_atacado").notNull(),
    estoqueMinimo: quantidade("estoque_minimo").notNull().default(0),
    /** Cache: a verdade e a soma dos movimentos. */
    saldoAtual: quantidade("saldo_atual").notNull().default(0),
    ncm: text("ncm").notNull().default(""),
    // campos fiscais da fase 3 (NF-e), ja reservados
    cest: text("cest"),
    cfop: text("cfop"),
    origem: text("origem"),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [
    check("produtos_precos_positivos", sql`${t.precoVarejo} >= 0 and ${t.precoAtacado} >= 0`),
    check("produtos_gelado_positivo", sql`${t.precoGelado} is null or ${t.precoGelado} > 0`),
    check("produtos_fator_minimo", sql`${t.fatorConversao} >= 1`),
    check("produtos_custo_positivo", sql`${t.custoMedio} >= 0 and ${t.custoUltimaCompra} >= 0`),
    uniqueIndex("produtos_codigo_barras_unico")
      .on(t.codigoBarras)
      .where(sql`${t.codigoBarras} <> ''`),
  ],
);

// ---------------------------------------------------------------- entrada

export const entradas = pgTable("entradas", {
  id: text("id").primaryKey(),
  numero: integer("numero").notNull().unique(),
  fornecedorId: text("fornecedor_id")
    .notNull()
    .references(() => fornecedores.id),
  data: momento("data").notNull(),
  documentoFornecedor: text("documento_fornecedor").notNull(),
  valorTotal: integer("valor_total").notNull(),
  usuarioId: text("usuario_id")
    .notNull()
    .references(() => usuarios.id),
  observacao: text("observacao"),
});

export const entradaItens = pgTable(
  "entrada_itens",
  {
    id: text("id").primaryKey(),
    entradaId: text("entrada_id")
      .notNull()
      .references(() => entradas.id),
    /** Posicao do item na nota, para voltar na mesma ordem. */
    posicao: integer("posicao").notNull(),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produtos.id),
    qtdCompra: quantidade("qtd_compra").notNull(),
    unidadeCompra: unidadeCompra("unidade_compra").notNull(),
    fatorConversao: integer("fator_conversao").notNull(),
    qtdBase: quantidade("qtd_base").notNull(),
    custoUnitCompra: integer("custo_unit_compra").notNull(),
    custoUnitBase: integer("custo_unit_base").notNull(),
    valorTotal: integer("valor_total").notNull(),
  },
  (t) => [
    index("entrada_itens_entrada").on(t.entradaId),
    check("entrada_itens_qtd_positiva", sql`${t.qtdCompra} > 0`),
    check("entrada_itens_custo_positivo", sql`${t.custoUnitCompra} > 0`),
  ],
);

// ---------------------------------------------------------------- caixa

export const caixaSessoes = pgTable(
  "caixa_sessoes",
  {
    id: text("id").primaryKey(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    abertaEm: momento("aberta_em").notNull(),
    fundoTroco: integer("fundo_troco").notNull(),
    fechadaEm: momento("fechada_em"),
    valorContado: integer("valor_contado"),
    status: statusCaixa("status").notNull(),
  },
  (t) => [
    check("caixa_fundo_positivo", sql`${t.fundoTroco} >= 0`),
    // dois caixas abertos ao mesmo tempo bagunçam a conferencia
    uniqueIndex("caixa_um_aberto").on(t.status).where(sql`${t.status} = 'ABERTA'`),
  ],
);

// ---------------------------------------------------------------- venda

export const vendas = pgTable(
  "vendas",
  {
    id: text("id").primaryKey(),
    numero: integer("numero").notNull().unique(),
    clienteId: text("cliente_id").references(() => clientes.id),
    data: momento("data").notNull(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    caixaSessaoId: text("caixa_sessao_id").references(() => caixaSessoes.id),
    tipoPreco: tipoPreco("tipo_preco").notNull(),
    subtotal: integer("subtotal").notNull(),
    desconto: integer("desconto").notNull().default(0),
    total: integer("total").notNull(),
    custoTotal: integer("custo_total").notNull(),
    formaPagamento: formaPagamento("forma_pagamento").notNull(),
    status: statusVenda("status").notNull(),
    canceladaEm: momento("cancelada_em"),
    canceladaPor: text("cancelada_por").references(() => usuarios.id),
    motivoCancelamento: text("motivo_cancelamento"),
    /** Duplo clique no "Finalizar" devolve a mesma venda, nao cria outra. */
    chaveIdempotencia: text("chave_idempotencia").unique(),
  },
  (t) => [
    index("vendas_data").on(t.data),
    check("vendas_valores_positivos", sql`${t.desconto} >= 0 and ${t.total} >= 0`),
  ],
);

export const vendaItens = pgTable(
  "venda_itens",
  {
    id: text("id").primaryKey(),
    vendaId: text("venda_id")
      .notNull()
      .references(() => vendas.id),
    posicao: integer("posicao").notNull(),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produtos.id),
    /** Copia do nome no dia da venda. */
    descricao: text("descricao").notNull(),
    qtd: quantidade("qtd").notNull(),
    precoUnit: integer("preco_unit").notNull(),
    /** Custo medio congelado no instante da venda (regra 3). Nunca recalcular. */
    custoUnit: integer("custo_unit").notNull(),
    tipoPrecoAplicado: tipoPreco("tipo_preco_aplicado").notNull(),
    embalagemUnidade: unidadeCompra("embalagem_unidade"),
    embalagemFator: integer("embalagem_fator"),
    gelado: boolean("gelado").notNull().default(false),
    adicionalGelado: integer("adicional_gelado"),
    total: integer("total").notNull(),
  },
  (t) => [
    index("venda_itens_venda").on(t.vendaId),
    check("venda_itens_qtd_positiva", sql`${t.qtd} > 0`),
    check("venda_itens_preco_positivo", sql`${t.precoUnit} > 0`),
  ],
);

// ---------------------------------------------------------------- razao

/** Livro-razao do estoque: so insere, nunca altera nem apaga. */
export const movimentosEstoque = pgTable(
  "movimentos_estoque",
  {
    id: text("id").primaryKey(),
    ordem: ordem(),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produtos.id),
    data: momento("data").notNull(),
    tipo: tipoMovimento("tipo").notNull(),
    qtd: quantidade("qtd").notNull(),
    saldoApos: quantidade("saldo_apos").notNull(),
    custoUnitNoMomento: integer("custo_unit_no_momento").notNull(),
    origemTipo: origemMovimento("origem_tipo").notNull(),
    origemId: text("origem_id"),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    motivo: text("motivo"),
  },
  (t) => [
    index("movimentos_produto").on(t.produtoId),
    check("movimentos_qtd_nao_zero", sql`${t.qtd} <> 0`),
  ],
);

export const caixaMovimentos = pgTable(
  "caixa_movimentos",
  {
    id: text("id").primaryKey(),
    ordem: ordem(),
    caixaSessaoId: text("caixa_sessao_id")
      .notNull()
      .references(() => caixaSessoes.id),
    data: momento("data").notNull(),
    tipo: tipoCaixaMov("tipo").notNull(),
    formaPagamento: formaPagamento("forma_pagamento"),
    valor: integer("valor").notNull(),
    vendaId: text("venda_id").references(() => vendas.id),
    descricao: text("descricao").notNull(),
  },
  (t) => [index("caixa_movimentos_sessao").on(t.caixaSessaoId)],
);

// ---------------------------------------------------------------- documento

export const documentos = pgTable("documentos", {
  id: text("id").primaryKey(),
  vendaId: text("venda_id")
    .notNull()
    .references(() => vendas.id),
  tipo: tipoDocumento("tipo").notNull(),
  numero: integer("numero").notNull().unique(),
  emitidoEm: momento("emitido_em").notNull(),
  /** Copia congelada: corrigir o cadastro depois nao muda o recibo emitido. */
  emitenteSnapshot: jsonb("emitente_snapshot").$type<Empresa>().notNull(),
  destinatarioSnapshot: jsonb("destinatario_snapshot").$type<Cliente | null>(),
  // NF-e (fase 3), ja reservado
  serie: text("serie"),
  chaveAcesso: text("chave_acesso"),
  protocolo: text("protocolo"),
  statusSefaz: text("status_sefaz"),
  xmlUrl: text("xml_url"),
  pdfUrl: text("pdf_url"),
});

// ---------------------------------------------------------------- auditoria

/** Quem fez o que. So insere, nunca altera nem apaga. */
export const logAuditoria = pgTable(
  "log_auditoria",
  {
    id: text("id").primaryKey(),
    ordem: ordem(),
    ocorridoEm: momento("ocorrido_em").notNull(),
    /** Vazio na tentativa de login com e-mail que nao existe. */
    usuarioId: text("usuario_id").references(() => usuarios.id),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id").notNull().default(""),
    detalhe: text("detalhe").notNull().default(""),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("log_auditoria_ocorrido").on(t.ocorridoEm)],
);
