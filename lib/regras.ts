/**
 * As cinco regras do blueprint, no codigo.
 *
 * 1. Tudo converte para a unidade base
 * 2. Custo medio ponderado, recalculado so na entrada
 * 3. Custo congelado no item da venda
 * 4. Caixa e lucro sao coisas diferentes
 * 5. O vasilhame sai junto com o produto
 */

import type {
  Cliente,
  Produto,
  TipoPreco,
  Venda,
  VendaItem,
} from "./tipos";

// ---------------------------------------------------------------- regra 1

/** Converte quantidade da unidade de compra para a unidade base. */
export function paraBase(qtdCompra: number, fatorConversao: number): number {
  return qtdCompra * fatorConversao;
}

/**
 * Custo por unidade base, em 1/10000 de real.
 * O custo de compra chega em centavos por unidade de compra.
 */
export function custoUnitBase(
  custoUnitCompraCentavos: number,
  fatorConversao: number,
): number {
  return Math.round((custoUnitCompraCentavos * 100) / fatorConversao);
}

// ---------------------------------------------------------------- regra 2

/**
 * Custo medio ponderado.
 *
 *   CMP = (saldo x CMP_atual + qtd_entrada x custo_entrada) / (saldo + qtd_entrada)
 *
 * Tudo em unidade base. Resultado em 1/10000 de real.
 * Saldo negativo ou zerado: o custo novo vira o custo do produto.
 */
export function novoCustoMedio(
  saldoAtual: number,
  custoMedioAtual: number,
  qtdEntrada: number,
  custoEntrada: number,
): number {
  if (saldoAtual <= 0 || custoMedioAtual <= 0) return custoEntrada;
  const total = saldoAtual + qtdEntrada;
  if (total <= 0) return custoEntrada;
  return Math.round(
    (saldoAtual * custoMedioAtual + qtdEntrada * custoEntrada) / total,
  );
}

// ---------------------------------------------------------------- preco

/**
 * Decide entre atacado e varejo, na ordem do blueprint:
 *   1. cliente marcado como ATACADO
 *   2. quantidade atinge o minimo do produto
 *   caso contrario, VAREJO
 */
export function precoAplicavel(
  produto: Produto,
  qtd: number,
  cliente?: Cliente | null,
): { tipo: TipoPreco; preco: number; motivo: string } {
  if (cliente?.tipoPreco === "ATACADO") {
    return {
      tipo: "ATACADO",
      preco: produto.precoAtacado,
      motivo: "cliente com tabela de atacado",
    };
  }
  if (qtd >= produto.qtdMinimaAtacado) {
    return {
      tipo: "ATACADO",
      preco: produto.precoAtacado,
      motivo: `a partir de ${produto.qtdMinimaAtacado} un`,
    };
  }
  return { tipo: "VAREJO", preco: produto.precoVarejo, motivo: "venda no varejo" };
}

/** Margem sobre o preco de venda. (preco - custo) / preco */
export function margem(precoCentavos: number, custo: number): number {
  if (precoCentavos <= 0) return 0;
  const custoCentavos = custo / 100;
  return (precoCentavos - custoCentavos) / precoCentavos;
}

/** Markup sobre o custo. (preco / custo) - 1 */
export function markup(precoCentavos: number, custo: number): number {
  const custoCentavos = custo / 100;
  if (custoCentavos <= 0) return 0;
  return precoCentavos / custoCentavos - 1;
}

// ---------------------------------------------------------------- regra 3

/** Valor da linha, em centavos. */
export function totalItem(qtd: number, precoUnitCentavos: number): number {
  return Math.round(qtd * precoUnitCentavos);
}

/** Custo da linha em centavos, a partir do custo congelado (1/10000 de real). */
export function custoItem(qtd: number, custoUnit: number): number {
  return Math.round((qtd * custoUnit) / 100);
}

/** Lucro bruto de um item, em centavos. */
export function lucroItem(item: VendaItem): number {
  return item.total - custoItem(item.qtd, item.custoUnit);
}

/** Lucro bruto de uma venda, em centavos. Ja desconta o desconto do cabecalho. */
export function lucroVenda(venda: Venda): number {
  if (venda.status === "CANCELADA") return 0;
  return venda.total - venda.custoTotal;
}

// ---------------------------------------------------------------- regra 4

/** Uma venda so entra no caixa se o dinheiro entrou. Fiado nao entra. */
export function entraNoCaixa(venda: Venda): boolean {
  return venda.status === "FECHADA" && venda.formaPagamento !== "FIADO";
}

// ---------------------------------------------------------------- estoque

/** Valor do estoque: soma de saldo x custo medio. Retorna centavos. */
export function estoqueValorizado(produtos: Produto[]): number {
  return produtos.reduce(
    (acc, p) => acc + Math.round((p.saldoAtual * p.custoMedio) / 100),
    0,
  );
}

export function abaixoDoMinimo(produtos: Produto[]): Produto[] {
  return produtos.filter(
    (p) => p.ativo && p.tipo === "NORMAL" && p.saldoAtual <= p.estoqueMinimo,
  );
}
