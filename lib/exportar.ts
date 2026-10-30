/**
 * Exportacao em tres formatos, porque sao tres necessidades diferentes.
 *
 *   PDF    para enviar e imprimir  -> window.print() sobre a folha A4 da tela
 *   Excel  para o dono mexer       -> exceljs, formatado de verdade
 *   CSV    para outro sistema ler  -> cru de proposito, mas correto
 *
 * Sobre o CSV: ele nao tem como ser bonito, e essa e a funcao dele. O formato
 * nao guarda cor, largura nem formula. O que ele precisa e estar CORRETO em
 * portugues do Brasil, que e onde quase todo sistema erra:
 *
 *   1. BOM no comeco, senao o Excel pt-BR le "Agua" como "Ãgua"
 *   2. separador ponto e virgula, porque a virgula ja e o separador decimal
 *   3. decimal com virgula, senao o valor entra como texto e nao soma
 */

import { eletron } from "./eletron";

export type Alinhamento = "texto" | "moeda" | "numero" | "percentual" | "data";

export interface Coluna<T> {
  chave: string;
  titulo: string;
  tipo: Alinhamento;
  /** valor cru: centavos para moeda, fracao para percentual */
  valor: (linha: T) => string | number;
}

export interface Relatorio<T> {
  nomeArquivo: string;
  titulo: string;
  periodo: string;
  emitente: { nomeFantasia: string; razaoSocial: string; cnpj: string };
  geradoPor: string;
  colunas: Coluna<T>[];
  linhas: T[];
  /** chaves que ganham linha de total no rodape */
  somar?: string[];
}

// ---------------------------------------------------------------- CSV
const SEPARADOR = ";";
const BOM = "﻿";

function celulaCsv(valor: string | number, tipo: Alinhamento, internacional: boolean) {
  let txt: string;

  if (typeof valor === "number") {
    if (tipo === "moeda") txt = (valor / 100).toFixed(2);
    else if (tipo === "percentual") txt = (valor * 100).toFixed(2);
    else txt = String(valor);
    if (!internacional) txt = txt.replace(".", ",");
  } else {
    txt = valor ?? "";
  }

  const sep = internacional ? "," : SEPARADOR;
  if (txt.includes(sep) || txt.includes('"') || txt.includes("\n")) {
    return `"${txt.replace(/"/g, '""')}"`;
  }
  return txt;
}

export function baixarCsv<T>(rel: Relatorio<T>, internacional = false) {
  const sep = internacional ? "," : SEPARADOR;
  const linhas: string[] = [];

  linhas.push(rel.colunas.map((c) => c.titulo).join(sep));
  for (const l of rel.linhas) {
    linhas.push(
      rel.colunas.map((c) => celulaCsv(c.valor(l), c.tipo, internacional)).join(sep),
    );
  }

  // BOM so na versao pt-BR; a internacional segue RFC 4180 limpa
  const conteudo = (internacional ? "" : BOM) + linhas.join("\r\n") + "\r\n";
  baixar(
    new Blob([conteudo], { type: "text/csv;charset=utf-8" }),
    `${rel.nomeArquivo}${internacional ? "-internacional" : ""}.csv`,
  );
}

// ---------------------------------------------------------------- Excel
const FORMATO = {
  moeda: 'R$ #,##0.00',
  numero: "#,##0.###",
  percentual: "0.0%",
  data: "dd/mm/yyyy",
  texto: "@",
} as const;

export async function baixarExcel<T>(rel: Relatorio<T>) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = rel.emitente.nomeFantasia;
  wb.created = new Date();

  const ws = wb.addWorksheet("Relatório", {
    views: [{ state: "frozen", ySplit: 6 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  const nCols = rel.colunas.length;
  const ultima = String.fromCharCode(64 + Math.min(nCols, 26));

  // ---- cabecalho de identificacao: o arquivo tem que se explicar sozinho
  // seis meses depois, sem depender de quem mandou
  ws.mergeCells(`A1:${ultima}1`);
  ws.getCell("A1").value = rel.emitente.nomeFantasia;
  ws.getCell("A1").font = { size: 15, bold: true, color: { argb: "FF0F141C" } };

  ws.mergeCells(`A2:${ultima}2`);
  ws.getCell("A2").value = `${rel.emitente.razaoSocial} — CNPJ ${rel.emitente.cnpj}`;
  ws.getCell("A2").font = { size: 9, color: { argb: "FF6B7685" } };

  ws.mergeCells(`A3:${ultima}3`);
  ws.getCell("A3").value = rel.titulo;
  ws.getCell("A3").font = { size: 12, bold: true, color: { argb: "FF1E3F8F" } };

  ws.mergeCells(`A4:${ultima}4`);
  ws.getCell("A4").value =
    `${rel.periodo}  ·  gerado em ${new Date().toLocaleString("pt-BR")} por ${rel.geradoPor}`;
  ws.getCell("A4").font = { size: 9, color: { argb: "FF6B7685" } };

  ws.getRow(5).height = 6;

  // ---- cabecalho da tabela
  const linhaTitulos = ws.getRow(6);
  rel.colunas.forEach((c, i) => {
    const cel = linhaTitulos.getCell(i + 1);
    cel.value = c.titulo;
    cel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3F8F" } };
    cel.alignment = {
      vertical: "middle",
      horizontal: c.tipo === "texto" ? "left" : "right",
    };
  });
  linhaTitulos.height = 20;

  // ---- dados, com zebra discreta
  rel.linhas.forEach((l, idx) => {
    const linha = ws.getRow(7 + idx);
    rel.colunas.forEach((c, i) => {
      const cel = linha.getCell(i + 1);
      const bruto = c.valor(l);
      cel.value =
        typeof bruto === "number"
          ? c.tipo === "moeda"
            ? bruto / 100
            : bruto
          : bruto;
      cel.numFmt = FORMATO[c.tipo];
      cel.font = { size: 10 };
      cel.alignment = { horizontal: c.tipo === "texto" ? "left" : "right" };
      if (idx % 2 === 1) {
        cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FB" } };
      }
      cel.border = { bottom: { style: "hair", color: { argb: "FFDBE2EA" } } };
    });
  });

  // ---- totais com SUBTOTAL, nao valor fixo: quando o dono filtra por
  // categoria o total acompanha, que e o que separa export bom de inutil
  if (rel.somar?.length && rel.linhas.length) {
    const primeira = 7;
    const ultimaLinha = 6 + rel.linhas.length;
    const linhaTotal = ws.getRow(ultimaLinha + 1);
    rel.colunas.forEach((c, i) => {
      const cel = linhaTotal.getCell(i + 1);
      const letra = String.fromCharCode(65 + i);
      if (i === 0) cel.value = "TOTAL";
      else if (rel.somar!.includes(c.chave)) {
        cel.value = { formula: `SUBTOTAL(109,${letra}${primeira}:${letra}${ultimaLinha})` };
        cel.numFmt = FORMATO[c.tipo];
      }
      cel.font = { bold: true, size: 10 };
      cel.alignment = { horizontal: c.tipo === "texto" ? "left" : "right" };
      cel.border = { top: { style: "thin", color: { argb: "FF0F141C" } } };
    });
  }

  // filtro automatico e largura por conteudo
  ws.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6 + rel.linhas.length, column: nCols },
  };
  rel.colunas.forEach((c, i) => {
    const maior = rel.linhas.reduce((m, l) => {
      const v = c.valor(l);
      return Math.max(m, String(typeof v === "number" ? v / 100 : v).length);
    }, c.titulo.length);
    ws.getColumn(i + 1).width = Math.min(46, Math.max(11, maior + 4));
  });

  const buf = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${rel.nomeArquivo}.xlsx`,
  );
}

// ---------------------------------------------------------------- PDF
/**
 * Na fase 1 o PDF sai pelo dialogo de impressao do navegador sobre a folha
 * A4 que ja esta na tela — zero dependencia, e o resultado e um PDF de
 * verdade. Na fase 2 isso vira @react-pdf/renderer no servidor, para
 * aguentar relatorio de 20 mil linhas sem travar a aba.
 */
export function imprimirPdf() {
  window.print();
}

/**
 * Recibo na impressora de bobina. A pagina fica com a altura exata do recibo:
 * papel continuo nao tem folha, e uma pagina maior sairia com sobra em branco.
 * No programa instalado sai direto na impressora, sem a janela de impressao.
 */
export async function imprimirBobina() {
  const recibo = document.getElementById("recibo-bobina");
  if (!recibo) return;
  const html = document.documentElement;
  html.classList.add("bobina");

  const mm = 25.4 / 96;
  const altura = Math.ceil(recibo.getBoundingClientRect().height * mm) + 2;
  const pagina = document.createElement("style");
  pagina.textContent = `@page { size: 80mm ${altura}mm; margin: 0; }`;
  document.head.append(pagina);

  const limpar = () => {
    pagina.remove();
    html.classList.remove("bobina");
  };

  const direto = await eletron()?.imprimirRecibo(altura);
  if (direto?.ok) {
    limpar();
    return;
  }
  // navegador, ou programa sem impressora definida: a janela deixa escolher
  window.addEventListener("afterprint", limpar, { once: true });
  window.print();
}

// ---------------------------------------------------------------- util
function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
