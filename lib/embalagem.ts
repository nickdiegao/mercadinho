/**
 * Unidade ou embalagem fechada (caixa, fardo, engradado, barril).
 *
 * O estoque mora sempre em unidade (regra 1). A embalagem e so o jeito de
 * escolher a quantidade na hora de vender ou de comprar: 2 caixas de 12 sao
 * 24 unidades saindo do saldo.
 */

import type { Produto, UnidadeCompra, VendaItem } from "./tipos";

const NOMES: Record<UnidadeCompra, [singular: string, plural: string]> = {
  UN: ["unidade", "unidades"],
  CX: ["caixa", "caixas"],
  FD: ["fardo", "fardos"],
  ENG: ["engradado", "engradados"],
  BARRIL: ["barril", "barris"],
};

/** "caixa", "fardos"… — minusculo, para meio de frase. */
export function nomeEmbalagem(u: UnidadeCompra, qtd = 1): string {
  return NOMES[u][qtd === 1 ? 0 : 1];
}

/** "Caixa", "Fardo"… — para botao e titulo. */
export function rotuloEmbalagem(u: UnidadeCompra): string {
  const n = NOMES[u][0];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** O produto tem embalagem fechada para oferecer alem da unidade avulsa. */
export function temEmbalagem(p: Produto): boolean {
  return p.unidadeCompra !== "UN" && p.fatorConversao > 1;
}

/** Quantas embalagens fechadas cabem no saldo, e quantas unidades sobram. */
export function emEmbalagens(qtdBase: number, fator: number) {
  const inteiras = fator > 1 ? Math.floor(Math.max(0, qtdBase) / fator) : 0;
  return { inteiras, avulsas: Math.max(0, qtdBase) - inteiras * fator };
}

/**
 * O saldo do jeito que se conta no deposito: "74 cx + 7 un".
 * Saldo zerado ou negativo volta em unidade, para nao esconder o problema.
 */
export function saldoContado(p: Produto): string {
  const un = (n: number) => `${n.toLocaleString("pt-BR")} un`;
  if (!temEmbalagem(p) || p.saldoAtual <= 0) return un(p.saldoAtual);
  const { inteiras, avulsas } = emEmbalagens(p.saldoAtual, p.fatorConversao);
  const sigla = p.unidadeCompra.toLowerCase();
  if (inteiras === 0) return un(avulsas);
  return avulsas > 0 ? `${inteiras} ${sigla} + ${un(avulsas)}` : `${inteiras} ${sigla}`;
}

/** Da para tirar ao menos uma embalagem fechada do estoque. */
export function fechaEmbalagem(p: Produto): boolean {
  return temEmbalagem(p) && p.saldoAtual >= p.fatorConversao;
}

/**
 * Como o item foi vendido, para recibo e lista: 2 CX a R$ 54,00, ou 24 UN a
 * R$ 4,50. O total nao muda — so a forma de mostrar.
 */
export function comoVendido(i: VendaItem) {
  if (!i.embalagem) return { qtd: i.qtd, unidade: "UN", fator: 1, precoUnit: i.precoUnit };
  return {
    qtd: i.qtd / i.embalagem.fator,
    unidade: i.embalagem.unidade as string,
    fator: i.embalagem.fator,
    precoUnit: i.precoUnit * i.embalagem.fator,
  };
}
