/**
 * Planilha de produtos e precos: le o Excel (.xlsx) que o sistema mesmo gera
 * em "Baixar modelo" e devolve as linhas prontas para a importacao.
 *
 * A pessoa edita no Excel, o que deixar em branco nao muda no sistema. Valores
 * em reais; aqui viram centavos (preco) e 1/10000 de real (custo por unidade).
 */

import { baixar } from "./exportar";
import type { LinhaImportada } from "./operacoes";
import type { Produto } from "./tipos";

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

type Campo = keyof LinhaImportada;

/** Regras em ordem: a primeira que bate com o titulo da coluna vence. */
const REGRAS: Array<[Campo, (t: string) => boolean]> = [
  ["qtdMinimaAtacado", (t) => t.includes("atacado a partir")],
  ["fator", (t) => t.includes("unidades na embalagem")],
  ["unidadeCompra", (t) => t.includes("embalagem")],
  ["custoUnit", (t) => t.startsWith("custo")],
  ["precoVarejo", (t) => t.includes("varejo")],
  ["precoAtacado", (t) => t.includes("preco atacado")],
  ["precoGelado", (t) => t.includes("gelado")],
  ["estoqueMinimo", (t) => t.includes("estoque minimo")],
  ["categoria", (t) => t.includes("categoria")],
  ["sku", (t) => t.startsWith("codigo")],
  ["nome", (t) => t === "produto" || t === "nome" || t.startsWith("produto")],
];

function valorDaCelula(v: unknown): string | number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: Array<{ text: string }>; text?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return valorDaCelula(o.result);
    if (typeof o.text === "string") return o.text;
  }
  return undefined;
}

/** "R$ 1.234,56", "12,5" e 12.5 viram numero; vazio vira undefined. */
function numero(v: string | number | undefined, linha: number, titulo: string): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number") return v;
  const t = v.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!t) return undefined;
  const limpo = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(limpo);
  if (!Number.isFinite(n)) throw new Error(`Linha ${linha}, "${titulo}": "${v}" não é um número.`);
  return n;
}

export async function lerPlanilha(arquivo: File): Promise<LinhaImportada[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await arquivo.arrayBuffer());
  } catch {
    throw new Error("Não consegui abrir o arquivo. Use uma planilha do Excel (.xlsx).");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("A planilha está vazia.");

  // acha a linha de titulos: a primeira que tem uma coluna "Produto"
  let cab = 0;
  const colunas = new Map<number, Campo>();
  for (let r = 1; r <= Math.min(ws.rowCount, 30) && !cab; r++) {
    const achadas = new Map<number, Campo>();
    ws.getRow(r).eachCell((c, n) => {
      const t = semAcento(String(valorDaCelula(c.value) ?? ""));
      const regra = REGRAS.find(([campo, ok]) => ok(t) && ![...achadas.values()].includes(campo));
      if (regra) achadas.set(n, regra[0]);
    });
    if ([...achadas.values()].includes("nome")) {
      cab = r;
      achadas.forEach((v, k) => colunas.set(k, v));
    }
  }
  if (!cab) throw new Error('Não achei a coluna "Produto". Baixe o modelo e preencha nele.');

  const titulos = new Map<Campo, string>();
  ws.getRow(cab).eachCell((c, n) => {
    const campo = colunas.get(n);
    if (campo) titulos.set(campo, String(valorDaCelula(c.value) ?? ""));
  });

  const linhas: LinhaImportada[] = [];
  for (let r = cab + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const bruto = new Map<Campo, string | number | undefined>();
    colunas.forEach((campo, n) => bruto.set(campo, valorDaCelula(row.getCell(n).value)));
    const nome = String(bruto.get("nome") ?? "").trim();
    if (!nome) continue;

    const num = (campo: Campo) => numero(bruto.get(campo), r, titulos.get(campo) ?? campo);
    const dinheiro = (campo: Campo, casas: number) => {
      const n = num(campo);
      return n === undefined ? undefined : Math.round(n * casas);
    };
    const inteiro = (campo: Campo) => {
      const n = num(campo);
      return n === undefined ? undefined : Math.round(n);
    };
    const texto = (campo: Campo) => {
      const t = String(bruto.get(campo) ?? "").trim();
      return t || undefined;
    };

    linhas.push({
      nome,
      sku: texto("sku"),
      categoria: texto("categoria"),
      unidadeCompra: texto("unidadeCompra"),
      fator: inteiro("fator"),
      custoUnit: dinheiro("custoUnit", 10000),
      precoVarejo: dinheiro("precoVarejo", 100),
      precoAtacado: dinheiro("precoAtacado", 100),
      qtdMinimaAtacado: inteiro("qtdMinimaAtacado"),
      precoGelado: dinheiro("precoGelado", 100),
      estoqueMinimo: inteiro("estoqueMinimo"),
    });
  }
  if (linhas.length === 0) throw new Error("Não achei nenhum produto abaixo dos títulos.");
  return linhas;
}

/** Baixa o modelo: os produtos de hoje, na mesma ordem de colunas que a importacao le. */
export async function baixarModelo(produtos: Produto[], categorias: Array<{ id: string; nome: string }>) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Produtos", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const cat = new Map(categorias.map((c) => [c.id, c.nome]));
  ws.columns = [
    { header: "Código", width: 11 },
    { header: "Produto", width: 38 },
    { header: "Categoria", width: 15 },
    { header: "Embalagem de compra", width: 14 },
    { header: "Unidades na embalagem", width: 13 },
    { header: "Custo por unidade (R$)", width: 15 },
    { header: "Preço varejo (R$)", width: 15 },
    { header: "Preço atacado (R$)", width: 15 },
    { header: "Atacado a partir de (un)", width: 15 },
    { header: "Preço gelado (R$)", width: 15 },
    { header: "Estoque mínimo (un)", width: 14 },
  ];
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16244A" } };
  cab.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cab.height = 34;

  const ordem = [...cat.keys()];
  const lista = produtos
    .filter((p) => p.tipo === "NORMAL")
    .sort((a, b) => ordem.indexOf(a.categoriaId) - ordem.indexOf(b.categoriaId) || a.nome.localeCompare(b.nome, "pt-BR"));
  for (const p of lista) {
    ws.addRow([
      p.sku,
      p.nome,
      cat.get(p.categoriaId) ?? "",
      p.unidadeCompra,
      p.fatorConversao,
      p.custoMedio > 0 ? p.custoMedio / 10000 : null,
      p.precoVarejo > 0 ? p.precoVarejo / 100 : null,
      p.precoAtacado > 0 ? p.precoAtacado / 100 : null,
      p.qtdMinimaAtacado,
      p.precoGelado ? p.precoGelado / 100 : null,
      p.estoqueMinimo,
    ]);
  }
  for (const c of [6, 7, 8, 10]) ws.getColumn(c).numFmt = "R$ #,##0.00";
  ws.getColumn(6).numFmt = "R$ #,##0.0000";

  const buf = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "produtos-e-precos.xlsx",
  );
}
