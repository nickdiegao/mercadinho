/**
 * Tipos do dominio.
 *
 * CONVENCAO DE UNIDADES — leia antes de mexer em qualquer numero:
 *
 *   Dinheiro          inteiro em CENTAVOS (1/100 de real).  R$ 3,20 => 320
 *   Custo medio       inteiro em 1/10000 de real (4 casas).  R$ 3,3125 => 33125
 *   Quantidade        numero em unidade base, ate 3 casas.   12 latas => 12
 *
 * Nada de float para dinheiro: 0.1 + 0.2 nao da 0.3, e depois de mil vendas
 * o caixa nao fecha por centavos. Toda multiplicacao volta para inteiro com
 * Math.round na hora de virar valor de linha.
 */

export type Perfil = "ADMIN" | "CAIXA" | "ESTOQUE";
export type TipoPreco = "VAREJO" | "ATACADO";
export type TipoProduto = "NORMAL" | "VASILHAME";
export type UnidadeBase = "UN" | "L";
export type UnidadeCompra = "UN" | "CX" | "FD" | "ENG" | "BARRIL";

export type TipoMovimento =
  | "ENTRADA"
  | "SAIDA"
  | "AJUSTE"
  | "PERDA"
  | "DEVOLUCAO"
  | "INVENTARIO_INICIAL";

export type FormaPagamento = "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO" | "FIADO";

export type TipoCaixaMov =
  | "VENDA"
  | "SANGRIA"
  | "SUPRIMENTO"
  | "DESPESA"
  | "RECEBIMENTO"
  /** devolucao de dinheiro de uma venda cancelada */
  | "ESTORNO";

export interface Empresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  regimeTributario: string;
  endereco: string;
  telefone: string;
  email: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
}

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  /** ausente = ativo. Fornecedor nunca e apagado: as entradas apontam para ele. */
  ativo?: boolean;
}

export interface Cliente {
  id: string;
  tipo: "PF" | "PJ";
  nomeRazao: string;
  cpfCnpj: string;
  inscricaoEstadual?: string;
  telefone: string;
  email?: string;
  endereco: string;
  tipoPreco: TipoPreco;
  limiteCredito: number; // centavos
  ativo: boolean;
}

export interface Produto {
  id: string;
  sku: string;
  codigoBarras: string;
  nome: string;
  categoriaId: string;
  tipo: TipoProduto;
  /** Casco que sai junto quando este produto e vendido. */
  vasilhameId?: string;
  unidadeBase: UnidadeBase;
  unidadeCompra: UnidadeCompra;
  /** Quantas unidades base cabem em uma unidade de compra. */
  fatorConversao: number;
  custoMedio: number; // 1/10000 de real
  custoUltimaCompra: number; // 1/10000 de real
  precoVarejo: number; // centavos
  precoAtacado: number; // centavos
  /**
   * Preco do produto gelado no varejo, em centavos. Preco fixo por decisao do
   * cliente — o formulario avisa quando fica igual ou abaixo do varejo natural.
   * Na caixa gelada (atacado), soma-se ao atacado a diferenca gelado - varejo:
   * ver `acrescimoGelado` em regras.ts.
   */
  precoGelado?: number;
  /** Carvao, gelo e refresco em po nao gelam. Ausente = nao vende gelado. */
  vendeGelado?: boolean;
  qtdMinimaAtacado: number;
  estoqueMinimo: number;
  saldoAtual: number; // cache — a verdade e a soma dos movimentos
  ncm: string;
  ativo: boolean;
}

export interface EntradaItem {
  id: string;
  produtoId: string;
  qtdCompra: number;
  unidadeCompra: UnidadeCompra;
  fatorConversao: number;
  qtdBase: number;
  custoUnitCompra: number; // centavos, por unidade de compra
  custoUnitBase: number; // 1/10000 de real, por unidade base
  valorTotal: number; // centavos
}

export interface Entrada {
  id: string;
  numero: number;
  fornecedorId: string;
  data: string; // ISO
  documentoFornecedor: string;
  itens: EntradaItem[];
  valorTotal: number; // centavos
  usuarioId: string;
  observacao?: string;
}

export interface VendaItem {
  id: string;
  produtoId: string;
  descricao: string; // snapshot do nome
  qtd: number;
  precoUnit: number; // centavos
  /** Custo medio congelado no instante da venda. Nunca recalcular. */
  custoUnit: number; // 1/10000 de real
  tipoPrecoAplicado: TipoPreco;
  /**
   * Vendido em embalagem fechada (2 caixas de 12). `qtd` continua em unidade;
   * isto so diz como a quantidade foi escolhida, para o recibo mostrar
   * "2 CX" em vez de "24 UN". Ausente = vendido por unidade.
   */
  embalagem?: { unidade: UnidadeCompra; fator: number };
  /** Saiu gelado — lata avulsa ou caixa fechada. */
  gelado?: boolean;
  /**
   * Quanto o gelado cobrou a mais por unidade, congelado no instante da venda
   * (preco gelado - preco natural). E o que o relatorio soma para comparar com
   * a conta de luz — recalcular pelo preco de hoje daria numero errado.
   */
  adicionalGelado?: number; // centavos
  total: number; // centavos
}

export interface Venda {
  id: string;
  numero: number;
  clienteId?: string;
  data: string; // ISO
  usuarioId: string;
  caixaSessaoId?: string;
  tipoPreco: TipoPreco;
  itens: VendaItem[];
  subtotal: number; // centavos
  desconto: number; // centavos
  total: number; // centavos
  custoTotal: number; // centavos — soma dos custos congelados
  formaPagamento: FormaPagamento;
  status: "FECHADA" | "CANCELADA";
  canceladaEm?: string;
  canceladaPor?: string;
  motivoCancelamento?: string;
}

export interface MovimentoEstoque {
  id: string;
  produtoId: string;
  data: string; // ISO
  tipo: TipoMovimento;
  qtd: number; // positivo ou negativo, em unidade base
  saldoApos: number;
  custoUnitNoMomento: number; // 1/10000 de real
  origemTipo: "ENTRADA" | "VENDA" | "AJUSTE" | "CARGA_INICIAL";
  origemId?: string;
  usuarioId: string;
  motivo?: string;
}

export interface CaixaMovimento {
  id: string;
  caixaSessaoId: string;
  data: string;
  tipo: TipoCaixaMov;
  formaPagamento?: FormaPagamento;
  valor: number; // centavos, positivo ou negativo
  vendaId?: string;
  descricao: string;
}

export interface CaixaSessao {
  id: string;
  usuarioId: string;
  abertaEm: string;
  fundoTroco: number; // centavos
  fechadaEm?: string;
  valorContado?: number; // centavos
  status: "ABERTA" | "FECHADA";
}

export interface Documento {
  id: string;
  vendaId: string;
  tipo: "RECIBO" | "PEDIDO";
  numero: number;
  emitidoEm: string;
  emitenteSnapshot: Empresa;
  destinatarioSnapshot: Cliente | null;
}

export interface LogAuditoria {
  id: string;
  ocorridoEm: string;
  usuarioId: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  detalhe: string;
}

/** Tudo o que o mockup guarda no localStorage. */
export interface Estado {
  versao: number;
  empresa: Empresa;
  usuarios: Usuario[];
  usuarioAtualId: string | null;
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  clientes: Cliente[];
  produtos: Produto[];
  entradas: Entrada[];
  vendas: Venda[];
  movimentos: MovimentoEstoque[];
  caixaSessoes: CaixaSessao[];
  caixaMovimentos: CaixaMovimento[];
  documentos: Documento[];
  logs: LogAuditoria[];
}
