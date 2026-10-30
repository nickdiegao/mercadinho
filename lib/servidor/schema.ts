/**
 * As quinze tabelas do blueprint, no SQLite.
 *
 * Os nomes em JavaScript sao os mesmos do dominio (lib/tipos.ts), para a
 * leitura virar objeto do sistema sem traducao campo a campo. No banco, as
 * colunas ficam em snake_case.
 *
 * Unidades, iguais as do mockup:
 *   dinheiro     integer em centavos
 *   custo medio  integer em 1/10000 de real
 *   quantidade   integer em milesimos no banco, numero normal no sistema
 *   momento      texto ISO 8601 em UTC, sempre com toISOString()
 *
 * As constraints sao a ultima linha de defesa: mesmo com bug na aplicacao,
 * o banco recusa preco negativo, quantidade zero e dois caixas abertos. As
 * tabelas sao STRICT (ver drizzle/0000): sem isso o SQLite aceitaria texto
 * em coluna de numero. Migration nova que criar tabela precisa do STRICT a mao.
 */

import { sql } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
  type SQLiteColumn,
} from "drizzle-orm/sqlite-core";
import type { Cliente, Empresa } from "../tipos";

// ---------------------------------------------------------------- tipos

/** Em milesimos: inteiro nao acumula erro de arredondamento a cada soma. */
const quantidade = customType<{ data: number; driverData: number }>({
  dataType: () => "integer",
  toDriver: (v) => Math.round(v * 1000),
  fromDriver: (v) => v / 1000,
});
const momento = (nome: string) => text(nome);
const sim = (nome: string) => integer(nome, { mode: "boolean" });

/** Ordem de gravacao: dois movimentos no mesmo milissegundo saem na ordem certa. */
const ordem = () => integer("ordem").primaryKey({ autoIncrement: true });

/** O SQLite nao tem enum: a lista de valores validos vira CHECK. */
const umDe = (nome: string, coluna: SQLiteColumn, valores: readonly string[]) =>
  check(nome, sql`${coluna} in ${sql.raw(`(${valores.map((v) => `'${v}'`).join(", ")})`)}`);

const PERFIS = ["ADMIN", "CAIXA", "ESTOQUE"] as const;
const TIPOS_PRECO = ["VAREJO", "ATACADO"] as const;
const TIPOS_PRODUTO = ["NORMAL", "VASILHAME"] as const;
const UNIDADES_BASE = ["UN", "L"] as const;
const UNIDADES_COMPRA = ["UN", "CX", "FD", "ENG", "BARRIL"] as const;
const TIPOS_MOVIMENTO = ["ENTRADA", "SAIDA", "AJUSTE", "PERDA", "DEVOLUCAO", "INVENTARIO_INICIAL"] as const;
const ORIGENS_MOVIMENTO = ["ENTRADA", "VENDA", "AJUSTE", "CARGA_INICIAL"] as const;
const FORMAS_PAGAMENTO = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "FIADO"] as const;
const TIPOS_CAIXA_MOV = ["VENDA", "SANGRIA", "SUPRIMENTO", "DESPESA", "RECEBIMENTO", "ESTORNO"] as const;
const STATUS_VENDA = ["FECHADA", "CANCELADA"] as const;
const STATUS_CAIXA = ["ABERTA", "FECHADA"] as const;
const TIPOS_DOCUMENTO = ["RECIBO", "PEDIDO", "NFE", "NFCE"] as const;
const TIPOS_CLIENTE = ["PF", "PJ"] as const;

// ---------------------------------------------------------------- cadastro

/** Emitente. Uma linha so — o id e sempre 1. */
export const empresa = sqliteTable(
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

export const usuarios = sqliteTable(
  "usuarios",
  {
    id: text("id").primaryKey(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    /** Nunca a senha: so o hash bcrypt. */
    senhaHash: text("senha_hash").notNull(),
    /** Hash do codigo que recupera a senha sem depender de e-mail. So a administracao tem. */
    recuperacaoHash: text("recuperacao_hash"),
    perfil: text("perfil", { enum: PERFIS }).notNull(),
    ativo: sim("ativo").notNull().default(true),
    /** 5 erros seguidos travam o login por 15 minutos. */
    tentativasFalhas: integer("tentativas_falhas").notNull().default(0),
    bloqueadoAte: momento("bloqueado_ate"),
  },
  (t) => [
    uniqueIndex("usuarios_email_unico").on(sql`lower(${t.email})`),
    umDe("usuarios_perfil_valido", t.perfil, PERFIS),
  ],
);

export const categorias = sqliteTable("categorias", {
  id: text("id").primaryKey(),
  nome: text("nome").notNull(),
  categoriaPaiId: text("categoria_pai_id").references((): AnySQLiteColumn => categorias.id),
});

export const fornecedores = sqliteTable("fornecedores", {
  id: text("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  cnpj: text("cnpj").notNull(),
  telefone: text("telefone").notNull().default(""),
  email: text("email").notNull().default(""),
  endereco: text("endereco").notNull().default(""),
  ativo: sim("ativo").notNull().default(true),
});

export const clientes = sqliteTable(
  "clientes",
  {
    id: text("id").primaryKey(),
    tipo: text("tipo", { enum: TIPOS_CLIENTE }).notNull(),
    nomeRazao: text("nome_razao").notNull(),
    cpfCnpj: text("cpf_cnpj").notNull().default(""),
    inscricaoEstadual: text("inscricao_estadual"),
    telefone: text("telefone").notNull().default(""),
    email: text("email"),
    endereco: text("endereco").notNull().default(""),
    tipoPreco: text("tipo_preco", { enum: TIPOS_PRECO }).notNull().default("VAREJO"),
    limiteCredito: integer("limite_credito").notNull().default(0),
    ativo: sim("ativo").notNull().default(true),
  },
  (t) => [
    check("clientes_limite_positivo", sql`${t.limiteCredito} >= 0`),
    umDe("clientes_tipo_valido", t.tipo, TIPOS_CLIENTE),
    umDe("clientes_tipo_preco_valido", t.tipoPreco, TIPOS_PRECO),
  ],
);

export const produtos = sqliteTable(
  "produtos",
  {
    id: text("id").primaryKey(),
    sku: text("sku").notNull().unique(),
    codigoBarras: text("codigo_barras").notNull().default(""),
    nome: text("nome").notNull(),
    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categorias.id),
    tipo: text("tipo", { enum: TIPOS_PRODUTO }).notNull().default("NORMAL"),
    vasilhameId: text("vasilhame_id").references((): AnySQLiteColumn => produtos.id),
    unidadeBase: text("unidade_base", { enum: UNIDADES_BASE }).notNull().default("UN"),
    unidadeCompra: text("unidade_compra", { enum: UNIDADES_COMPRA }).notNull(),
    fatorConversao: integer("fator_conversao").notNull(),
    custoMedio: integer("custo_medio").notNull().default(0),
    custoUltimaCompra: integer("custo_ultima_compra").notNull().default(0),
    precoVarejo: integer("preco_varejo").notNull().default(0),
    precoAtacado: integer("preco_atacado").notNull().default(0),
    precoGelado: integer("preco_gelado"),
    vendeGelado: sim("vende_gelado"),
    qtdMinimaAtacado: quantidade("qtd_minima_atacado").notNull(),
    estoqueMinimo: quantidade("estoque_minimo").notNull().default(0),
    /** Cache: a verdade e a soma dos movimentos. */
    saldoAtual: quantidade("saldo_atual").notNull().default(0),
    ncm: text("ncm").notNull().default(""),
    // campos fiscais da fase 3 (NF-e), ja reservados
    cest: text("cest"),
    cfop: text("cfop"),
    origem: text("origem"),
    ativo: sim("ativo").notNull().default(true),
  },
  (t) => [
    check("produtos_precos_positivos", sql`${t.precoVarejo} >= 0 and ${t.precoAtacado} >= 0`),
    check("produtos_gelado_positivo", sql`${t.precoGelado} is null or ${t.precoGelado} > 0`),
    check("produtos_fator_minimo", sql`${t.fatorConversao} >= 1`),
    check("produtos_custo_positivo", sql`${t.custoMedio} >= 0 and ${t.custoUltimaCompra} >= 0`),
    umDe("produtos_tipo_valido", t.tipo, TIPOS_PRODUTO),
    umDe("produtos_unidade_base_valida", t.unidadeBase, UNIDADES_BASE),
    umDe("produtos_unidade_compra_valida", t.unidadeCompra, UNIDADES_COMPRA),
    uniqueIndex("produtos_codigo_barras_unico")
      .on(t.codigoBarras)
      .where(sql`${t.codigoBarras} <> ''`),
  ],
);

// ---------------------------------------------------------------- entrada

export const entradas = sqliteTable("entradas", {
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

export const entradaItens = sqliteTable(
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
    unidadeCompra: text("unidade_compra", { enum: UNIDADES_COMPRA }).notNull(),
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
    umDe("entrada_itens_unidade_valida", t.unidadeCompra, UNIDADES_COMPRA),
  ],
);

// ---------------------------------------------------------------- caixa

export const caixaSessoes = sqliteTable(
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
    status: text("status", { enum: STATUS_CAIXA }).notNull(),
  },
  (t) => [
    check("caixa_fundo_positivo", sql`${t.fundoTroco} >= 0`),
    umDe("caixa_status_valido", t.status, STATUS_CAIXA),
    // dois caixas abertos ao mesmo tempo bagunçam a conferencia
    uniqueIndex("caixa_um_aberto").on(t.status).where(sql`${t.status} = 'ABERTA'`),
  ],
);

// ---------------------------------------------------------------- venda

export const vendas = sqliteTable(
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
    tipoPreco: text("tipo_preco", { enum: TIPOS_PRECO }).notNull(),
    subtotal: integer("subtotal").notNull(),
    desconto: integer("desconto").notNull().default(0),
    total: integer("total").notNull(),
    custoTotal: integer("custo_total").notNull(),
    formaPagamento: text("forma_pagamento", { enum: FORMAS_PAGAMENTO }).notNull(),
    status: text("status", { enum: STATUS_VENDA }).notNull(),
    canceladaEm: momento("cancelada_em"),
    canceladaPor: text("cancelada_por").references(() => usuarios.id),
    motivoCancelamento: text("motivo_cancelamento"),
    /** Duplo clique no "Finalizar" devolve a mesma venda, nao cria outra. */
    chaveIdempotencia: text("chave_idempotencia").unique(),
  },
  (t) => [
    index("vendas_data").on(t.data),
    check("vendas_valores_positivos", sql`${t.desconto} >= 0 and ${t.total} >= 0`),
    umDe("vendas_tipo_preco_valido", t.tipoPreco, TIPOS_PRECO),
    umDe("vendas_forma_valida", t.formaPagamento, FORMAS_PAGAMENTO),
    umDe("vendas_status_valido", t.status, STATUS_VENDA),
  ],
);

export const vendaItens = sqliteTable(
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
    tipoPrecoAplicado: text("tipo_preco_aplicado", { enum: TIPOS_PRECO }).notNull(),
    embalagemUnidade: text("embalagem_unidade", { enum: UNIDADES_COMPRA }),
    embalagemFator: integer("embalagem_fator"),
    gelado: sim("gelado").notNull().default(false),
    adicionalGelado: integer("adicional_gelado"),
    total: integer("total").notNull(),
  },
  (t) => [
    index("venda_itens_venda").on(t.vendaId),
    check("venda_itens_qtd_positiva", sql`${t.qtd} > 0`),
    check("venda_itens_preco_positivo", sql`${t.precoUnit} > 0`),
    umDe("venda_itens_tipo_preco_valido", t.tipoPrecoAplicado, TIPOS_PRECO),
    umDe("venda_itens_embalagem_valida", t.embalagemUnidade, UNIDADES_COMPRA),
  ],
);

// ---------------------------------------------------------------- razao

/** Livro-razao do estoque: so insere, nunca altera nem apaga. */
export const movimentosEstoque = sqliteTable(
  "movimentos_estoque",
  {
    ordem: ordem(),
    id: text("id").notNull().unique(),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produtos.id),
    data: momento("data").notNull(),
    tipo: text("tipo", { enum: TIPOS_MOVIMENTO }).notNull(),
    qtd: quantidade("qtd").notNull(),
    saldoApos: quantidade("saldo_apos").notNull(),
    custoUnitNoMomento: integer("custo_unit_no_momento").notNull(),
    origemTipo: text("origem_tipo", { enum: ORIGENS_MOVIMENTO }).notNull(),
    origemId: text("origem_id"),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    motivo: text("motivo"),
  },
  (t) => [
    index("movimentos_produto").on(t.produtoId),
    check("movimentos_qtd_nao_zero", sql`${t.qtd} <> 0`),
    umDe("movimentos_tipo_valido", t.tipo, TIPOS_MOVIMENTO),
    umDe("movimentos_origem_valida", t.origemTipo, ORIGENS_MOVIMENTO),
  ],
);

export const caixaMovimentos = sqliteTable(
  "caixa_movimentos",
  {
    ordem: ordem(),
    id: text("id").notNull().unique(),
    caixaSessaoId: text("caixa_sessao_id")
      .notNull()
      .references(() => caixaSessoes.id),
    data: momento("data").notNull(),
    tipo: text("tipo", { enum: TIPOS_CAIXA_MOV }).notNull(),
    formaPagamento: text("forma_pagamento", { enum: FORMAS_PAGAMENTO }),
    valor: integer("valor").notNull(),
    vendaId: text("venda_id").references(() => vendas.id),
    descricao: text("descricao").notNull(),
  },
  (t) => [
    index("caixa_movimentos_sessao").on(t.caixaSessaoId),
    umDe("caixa_movimentos_tipo_valido", t.tipo, TIPOS_CAIXA_MOV),
    umDe("caixa_movimentos_forma_valida", t.formaPagamento, FORMAS_PAGAMENTO),
  ],
);

// ---------------------------------------------------------------- documento

export const documentos = sqliteTable(
  "documentos",
  {
    id: text("id").primaryKey(),
    vendaId: text("venda_id")
      .notNull()
      .references(() => vendas.id),
    tipo: text("tipo", { enum: TIPOS_DOCUMENTO }).notNull(),
    numero: integer("numero").notNull().unique(),
    emitidoEm: momento("emitido_em").notNull(),
    /** Copia congelada: corrigir o cadastro depois nao muda o recibo emitido. */
    emitenteSnapshot: text("emitente_snapshot", { mode: "json" }).$type<Empresa>().notNull(),
    destinatarioSnapshot: text("destinatario_snapshot", { mode: "json" }).$type<Cliente | null>(),
    // NF-e (fase 3), ja reservado
    serie: text("serie"),
    chaveAcesso: text("chave_acesso"),
    protocolo: text("protocolo"),
    statusSefaz: text("status_sefaz"),
    xmlUrl: text("xml_url"),
    pdfUrl: text("pdf_url"),
  },
  (t) => [umDe("documentos_tipo_valido", t.tipo, TIPOS_DOCUMENTO)],
);

// ---------------------------------------------------------------- auditoria

/** Quem fez o que. So insere, nunca altera nem apaga. */
export const logAuditoria = sqliteTable(
  "log_auditoria",
  {
    ordem: ordem(),
    id: text("id").notNull().unique(),
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
