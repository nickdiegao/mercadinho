"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import {
  inicioDoDia,
  porCanal,
  porCategoria,
  rankingProdutos,
  totais,
  vendasEntre,
} from "@/lib/consultas";
import { baixarCsv, baixarExcel, imprimirPdf, type Relatorio } from "@/lib/exportar";
import { moeda, numero, porcento, data } from "@/lib/formato";
import {
  Barra,
  Botao,
  Cabecalho,
  Cartao,
  Etiqueta,
  Indicador,
  Rolagem,
  Selecao,
  Tabela,
  Td,
  Th,
  TituloCartao,
  Vazio,
} from "@/components/ui";

const DIA = 86400000;
const PERIODOS = [
  { valor: "7", rotulo: "Últimos 7 dias" },
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "60", rotulo: "Últimos 60 dias" },
];

interface LinhaRanking {
  produtoId: string;
  nome: string;
  qtd: number;
  receita: number;
  lucro: number;
}

export default function Relatorios() {
  const { estado } = useEstado();
  const { usuario, podeVerLucro } = usePerfil();
  const [dias, setDias] = useState("30");
  const [exportando, setExportando] = useState(false);

  const { vendas, inicio, fim } = useMemo(() => {
    const fimD = new Date();
    const inicioD = new Date(inicioDoDia().getTime() - (Number(dias) - 1) * DIA);
    return { vendas: vendasEntre(estado, inicioD, fimD), inicio: inicioD, fim: fimD };
  }, [estado, dias]);

  const t = useMemo(() => totais(vendas), [vendas]);
  const canais = useMemo(() => porCanal(vendas), [vendas]);
  const cats = useMemo(() => porCategoria(estado, vendas), [estado, vendas]);
  const ranking = useMemo(() => rankingProdutos(estado, vendas), [estado, vendas]);

  // curva ABC: A ate 80% da receita acumulada, B ate 95%, C o resto
  const abc = useMemo(() => {
    let acumulado = 0;
    return ranking.map((r) => {
      acumulado += r.receita;
      const frac = t.receita > 0 ? acumulado / t.receita : 0;
      return { ...r, classe: frac <= 0.8 ? "A" : frac <= 0.95 ? "B" : "C" };
    });
  }, [ranking, t.receita]);

  const periodoTexto = `${data(inicio.toISOString())} a ${data(fim.toISOString())}`;

  const relatorio: Relatorio<LinhaRanking> = {
    nomeArquivo: `lucro-por-produto-${dias}-dias`,
    titulo: "Lucro por produto",
    periodo: `Período: ${periodoTexto}`,
    emitente: estado.empresa,
    geradoPor: usuario?.nome ?? "—",
    colunas: [
      { chave: "nome", titulo: "Produto", tipo: "texto", valor: (l) => l.nome },
      { chave: "qtd", titulo: "Qtd vendida", tipo: "numero", valor: (l) => l.qtd },
      { chave: "receita", titulo: "Receita", tipo: "moeda", valor: (l) => l.receita },
      { chave: "custo", titulo: "Custo", tipo: "moeda", valor: (l) => l.receita - l.lucro },
      { chave: "lucro", titulo: "Lucro bruto", tipo: "moeda", valor: (l) => l.lucro },
      {
        chave: "margem",
        titulo: "Margem",
        tipo: "percentual",
        valor: (l) => (l.receita > 0 ? l.lucro / l.receita : 0),
      },
    ],
    linhas: ranking,
    somar: ["qtd", "receita", "custo", "lucro"],
  };

  async function exportarExcel() {
    setExportando(true);
    try {
      await baixarExcel(relatorio);
    } finally {
      setExportando(false);
    }
  }

  const maior = ranking[0]?.receita ?? 1;
  const receitaCanais = canais.ATACADO.receita + canais.VAREJO.receita;

  return (
    <>
      <Cabecalho
        titulo="Relatórios"
        descricao="Todo relatório sai em três formatos, porque são três necessidades diferentes."
        acoes={
          <>
            <Selecao
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="w-[168px]"
            >
              {PERIODOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </Selecao>
            <Botao onClick={imprimirPdf} title="Abre o diálogo de impressão; escolha Salvar como PDF">
              <Printer size={15} /> PDF
            </Botao>
            <Botao onClick={exportarExcel} disabled={exportando}>
              <FileSpreadsheet size={15} /> {exportando ? "Gerando…" : "Excel"}
            </Botao>
            <Botao onClick={() => baixarCsv(relatorio)}>
              <FileText size={15} /> CSV
            </Botao>
          </>
        }
      />

      <div className="so-imprime mb-6">
        <p className="text-lg font-bold">{estado.empresa.nomeFantasia}</p>
        <p className="text-[12px]">
          {estado.empresa.razaoSocial} — CNPJ {estado.empresa.cnpj}
        </p>
        <p className="mt-2 text-[13px] font-bold">Lucro por produto</p>
        <p className="text-[12px]">
          {periodoTexto} · gerado por {usuario?.nome}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Receita" valor={moeda(t.receita)} detalhe={`${t.quantidade} vendas`} />
        <Indicador
          rotulo="Custo da mercadoria"
          valor={moeda(t.custo)}
          detalhe="pelo custo congelado em cada venda"
          tom="negativo"
        />
        <Indicador rotulo="Lucro bruto" valor={moeda(t.lucro)} tom="positivo" detalhe={`margem de ${porcento(t.margem)}`} />
        <Indicador rotulo="Ticket médio" valor={moeda(t.ticket)} detalhe="por venda no período" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao>
          <TituloCartao>Atacado × varejo</TituloCartao>
          {receitaCanais === 0 ? (
            <p className="text-sm text-suave">Sem vendas no período.</p>
          ) : (
            <div className="space-y-4">
              {(["ATACADO", "VAREJO"] as const).map((c) => {
                const v = canais[c];
                const margemCanal = v.receita > 0 ? v.lucro / v.receita : 0;
                return (
                  <div key={c}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <Etiqueta tom={c === "ATACADO" ? "marca" : "neutro"}>{c}</Etiqueta>
                      <span className="tabular text-[13.5px] font-semibold">
                        {moeda(v.receita)}
                        <span className="ml-2 font-normal text-suave">
                          {porcento(v.receita / receitaCanais)}
                        </span>
                      </span>
                    </div>
                    <Barra fracao={v.receita / receitaCanais} tom={c === "ATACADO" ? "marca" : "positivo"} />
                    <p className="mt-1.5 text-[11.5px] text-suave">
                      {v.itens} itens · lucro {moeda(v.lucro)} · margem {porcento(margemCanal)}
                    </p>
                  </div>
                );
              })}
              <p className="border-t border-borda pt-3 text-[12.5px] leading-relaxed text-suave">
                O atacado costuma girar mais volume com margem menor. Separar os
                dois canais é o que mostra se vale a pena empurrar caixa fechada
                ou vender no balcão.
              </p>
            </div>
          )}
        </Cartao>

        <Cartao padding={false}>
          <div className="p-5 pb-3">
            <TituloCartao>Por categoria</TituloCartao>
          </div>
          <Rolagem>
            <Tabela>
              <thead>
                <tr>
                  <Th>Categoria</Th>
                  <Th alinha="right">Receita</Th>
                  {podeVerLucro && <Th alinha="right">Lucro</Th>}
                  {podeVerLucro && <Th alinha="right">Margem</Th>}
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.nome} className="transicao hover:bg-superficie2/60">
                    <Td className="font-medium text-tinta">{c.nome}</Td>
                    <Td alinha="right">{moeda(c.receita)}</Td>
                    {podeVerLucro && (
                      <Td alinha="right" className="text-positivo">
                        {moeda(c.lucro)}
                      </Td>
                    )}
                    {podeVerLucro && (
                      <Td alinha="right" className="text-suave">
                        {porcento(c.receita > 0 ? c.lucro / c.receita : 0)}
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Tabela>
            {cats.length === 0 && <Vazio>Sem vendas no período.</Vazio>}
          </Rolagem>
        </Cartao>
      </div>

      <Cartao className="mt-4" padding={false}>
        <div className="p-5 pb-3">
          <TituloCartao
            extra={
              <span className="text-[11px] text-suave">
                curva ABC · {abc.filter((a) => a.classe === "A").length} produtos
                fazem 80% da receita
              </span>
            }
          >
            Lucro por produto
          </TituloCartao>
        </div>
        <Rolagem>
          <Tabela>
            <thead>
              <tr>
                <Th>Produto</Th>
                <Th alinha="center">ABC</Th>
                <Th alinha="right">Qtd</Th>
                <Th alinha="right">Receita</Th>
                <Th>Participação</Th>
                {podeVerLucro && <Th alinha="right">Lucro</Th>}
                {podeVerLucro && <Th alinha="right">Margem</Th>}
              </tr>
            </thead>
            <tbody>
              {abc.map((p) => (
                <tr key={p.produtoId} className="transicao hover:bg-superficie2/60">
                  <Td className="max-w-[260px] truncate font-medium text-tinta">
                    {p.nome}
                  </Td>
                  <Td alinha="center">
                    <Etiqueta
                      tom={p.classe === "A" ? "positivo" : p.classe === "B" ? "marca" : "neutro"}
                    >
                      {p.classe}
                    </Etiqueta>
                  </Td>
                  <Td alinha="right">{numero(p.qtd)}</Td>
                  <Td alinha="right" className="font-semibold text-tinta">
                    {moeda(p.receita)}
                  </Td>
                  <Td className="w-[130px]">
                    <Barra fracao={p.receita / maior} />
                  </Td>
                  {podeVerLucro && (
                    <Td alinha="right" className="text-positivo">
                      {moeda(p.lucro)}
                    </Td>
                  )}
                  {podeVerLucro && (
                    <Td alinha="right" className="text-suave">
                      {porcento(p.receita > 0 ? p.lucro / p.receita : 0)}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabela>
          {abc.length === 0 && <Vazio>Sem vendas no período selecionado.</Vazio>}
        </Rolagem>
      </Cartao>

      <div className="nao-imprime mt-6 grid gap-3 lg:grid-cols-3">
        <Cartao>
          <Etiqueta tom="marca">PDF</Etiqueta>
          <p className="mt-2 text-[13px] leading-relaxed text-tinta2">
            Para enviar por WhatsApp, imprimir ou anexar em e-mail. Layout
            fechado, com cabeçalho e CNPJ — ninguém edita. Sai pelo diálogo de
            impressão do navegador, escolhendo <b>Salvar como PDF</b>.
          </p>
        </Cartao>
        <Cartao>
          <Etiqueta tom="positivo">Excel — o bonito</Etiqueta>
          <p className="mt-2 text-[13px] leading-relaxed text-tinta2">
            Moeda em R$, painel congelado, zebra, filtro automático e total com{" "}
            <code className="mono text-[12px]">SUBTOTAL</code> — quando você filtra
            por categoria, o total acompanha. É o arquivo que o dono vai mexer.
          </p>
        </Cartao>
        <Cartao>
          <Etiqueta>CSV — o correto</Etiqueta>
          <p className="mt-2 text-[13px] leading-relaxed text-tinta2">
            Cru de propósito, para outro sistema ler. Sai com BOM, separador{" "}
            <code className="mono text-[12px]">;</code> e decimal com vírgula —
            abre limpo no Excel brasileiro, sem acento quebrado nem tudo numa
            coluna só.
          </p>
        </Cartao>
      </div>
    </>
  );
}
