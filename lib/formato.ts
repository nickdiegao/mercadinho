/** Formatacao pt-BR. Toda exibicao de numero passa por aqui. */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brl4 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

const pct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** centavos -> "R$ 3,20" */
export const moeda = (centavos: number) => brl.format(centavos / 100);

/** 1/10000 de real -> "R$ 3,3125" */
export const moeda4 = (custo: number) => brl4.format(custo / 10000);

/** 1/10000 de real -> "R$ 3,31" (arredondado, para telas compactas) */
export const custoCurto = (custo: number) => brl.format(custo / 10000);

export const numero = (n: number) => num.format(n);

export const porcento = (fracao: number) => pct.format(fracao);

export const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const diaCurto = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Valor por extenso, para o recibo. */
export function porExtenso(centavos: number): string {
  const un = ["", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const dez = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function ate999(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const partes: string[] = [];
    if (c) partes.push(centenas[c]);
    if (d === 1) partes.push(dez[u]);
    else {
      if (d) partes.push(dezenas[d]);
      if (u) partes.push(un[u]);
    }
    return partes.join(" e ");
  }

  const reais = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const blocos: string[] = [];

  const milhar = Math.floor(reais / 1000);
  const resto = reais % 1000;
  if (milhar === 1) blocos.push("mil");
  else if (milhar > 1) blocos.push(`${ate999(milhar)} mil`);
  if (resto) blocos.push(ate999(resto));

  let txt = blocos.join(" e ") || "zero";
  txt += reais === 1 ? " real" : " reais";
  if (cents) {
    txt += ` e ${ate999(cents)} ${cents === 1 ? "centavo" : "centavos"}`;
  }
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
