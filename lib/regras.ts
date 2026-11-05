/**
 * As cinco regras do blueprint, no codigo.
 *
 * 1. Tudo converte para a unidade base
 * 2. Custo medio ponderado, recalculado so na entrada
 * 3. Custo congelado no item da venda
 * 4. Caixa e lucro sao coisas diferentes
 * 5. O vasilhame sai junto com o produto
 */

import { temEmbalagem } from "./embalagem";
import type { Produto, TipoPreco, Venda, VendaItem } from "./tipos";

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

/** O produto tem preco gelado configurado. */
export function podeGelar(produto: Produto): boolean {
  return produto.vendeGelado === true && (produto.precoGelado ?? 0) > 0;
}

/**
 * Preco da embalagem fechada: as unidades menos o desconto da caixa. Por ser
 * calculado, acompanha quando o preco da unidade muda. Nunca negativo.
 */
export function precoCaixa(produto: Produto, gelado = false): number {
  const unidade = gelado ? (produto.precoGelado ?? 0) : produto.precoVarejo;
  const desconto = gelado ? (produto.descontoCaixaGelado ?? 0) : produto.descontoCaixa;
  return Math.max(0, unidade * produto.fatorConversao - desconto);
}

/**
 * O preco de um item da venda. Por unidade vale o preco da unidade; na
 * embalagem fechada, o preco da caixa. Doze latas soltas pagam doze unidades:
 * a caixa so vale quando o caixa escolhe vender a caixa (decisao da cliente).
 *
 * `adicionalGelado` e o que o gelado cobrou a mais por unidade sobre o natural
 * da mesma forma de venda. Vai congelado no item para o relatorio comparar com
 * a conta de luz; na caixa, e a diferenca das caixas dividida pelas unidades.
 */
export function precoDoItem(
  produto: Produto,
  qtd: number,
  emEmbalagem: boolean,
  querGelado: boolean,
): {
  tipo: TipoPreco;
  /** Por unidade. Na caixa, e o da caixa dividido, so para consulta: o total vem da caixa. */
  precoUnit: number;
  /** So na embalagem fechada. */
  precoEmbalagem?: number;
  total: number;
  gelado: boolean;
  adicionalGelado: number;
} {
  const gelado = querGelado && podeGelar(produto);

  if (emEmbalagem && temEmbalagem(produto)) {
    const fator = produto.fatorConversao;
    const preco = precoCaixa(produto, gelado);
    return {
      tipo: "ATACADO",
      precoUnit: Math.max(1, Math.round(preco / fator)),
      precoEmbalagem: preco,
      total: Math.round((qtd / fator) * preco),
      gelado,
      adicionalGelado: gelado ? Math.round((preco - precoCaixa(produto)) / fator) : 0,
    };
  }

  const preco = gelado ? produto.precoGelado! : produto.precoVarejo;
  return {
    tipo: "VAREJO",
    precoUnit: preco,
    total: Math.round(qtd * preco),
    gelado,
    adicionalGelado: gelado ? preco - produto.precoVarejo : 0,
  };
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

/**
 * Precisa repor. Minimo zero quer dizer que ninguem definiu um minimo, entao
 * o produto so acusa se o saldo ficar negativo — senao todo cadastro novo, que
 * nasce com saldo 0 e minimo 0, apareceria como "repor".
 */
export function precisaRepor(p: Produto): boolean {
  return p.saldoAtual < 0 || (p.estoqueMinimo > 0 && p.saldoAtual <= p.estoqueMinimo);
}

/**
 * Cadastrado e ainda sem nenhuma mercadoria. Nao e pendencia: o custo nasce
 * na primeira entrada (regra 2), e ate la nao ha o que vender.
 */
export function aguardandoEntrada(p: Produto): boolean {
  return p.custoMedio <= 0 && p.saldoAtual <= 0;
}

/**
 * Tem saldo mas nao tem custo. Esse sim e problema: toda venda dele sai com
 * lucro inflado, porque o custo entra como zero.
 */
export function semCusto(p: Produto): boolean {
  return p.custoMedio <= 0 && p.saldoAtual > 0;
}

export function abaixoDoMinimo(produtos: Produto[]): Produto[] {
  return produtos.filter((p) => p.ativo && p.tipo === "NORMAL" && precisaRepor(p));
}
