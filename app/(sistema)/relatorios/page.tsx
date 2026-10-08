"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Printer, Snowflake } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import {
  inicioDoDia,
  porCanal,
  resumoGelado,
  porCategoria,
  rankingProdutos,
  totais,
  vendasEntre,
} from "@/lib/consultas";
import { baixarCsv, baixarExcel, imprimirPdf, type Relatorio } from "@/lib/exportar";
import { moeda, numero, porcento, data } from "@/lib/formato";
import { Lista, type ColunaLista } from "@/components/lista";
import {
  Barra,
  Botao,
  Cabecalho,
  Cartao,
  Etiqueta,
  Indicador,
  Campo,
  Entrada,
  Selecao,
  TituloCartao,
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

type LinhaAbc = LinhaRanking & { classe: string };
type LinhaCategoria = {
  nome: string;
  receita: number;
  lucro: number;
  qtd: number;
};

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
  const gelado = useMemo(() => resumoGelado(vendas), [vendas]);
  const [contaLuzTexto, setContaLuzTexto] = useState("");
  const contaLuz = Math.round(
    (parseFloat(contaLuzTexto.replace(/\./g, "").replace(",", ".")) || 0) * 100,
  );
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

  const colunasCategoria: ColunaLista<LinhaCategoria>[] = [
    {
      chave: "nome",
      titulo: "Categoria",
      papel: "titulo",
      render: (c) => <>{c.nome}</>,
    },
    {
      chave: "receita",
      titulo: "Receita",
      alinha: "right",
      papel: "destaque",
      render: (c) => <span className="font-semibold text-tinta">{moeda(c.receita)}</span>,
    },
    ...(podeVerLucro
      ? [
          {
            chave: "lucro",
            titulo: "Lucro",
            alinha: "right" as const,
            render: (c: LinhaCategoria) => (
              <span className="text-positivo">{moeda(c.lucro)}</span>
            ),
          },
          {
            chave: "margem",
            titulo: "Margem",
            alinha: "right" as const,
            render: (c: LinhaCategoria) => (
              <span className="text-suave">
                {porcento(c.receita > 0 ? c.lucro / c.receita : 0)}
              </span>
            ),
          },
        ]
      : []),
  ];

  const colunasProduto: ColunaLista<LinhaAbc>[] = [
    {
      chave: "nome",
      titulo: "Produto",
      papel: "titulo",
      render: (p) => <span className="block max-w-[260px] truncate">{p.nome}</span>,
    },
    {
      chave: "abc",
      titulo: "ABC",
      alinha: "center",
      papel: "apoio",
      render: (p) => (
        <Etiqueta
          tom={p.classe === "A" ? "positivo" : p.classe === "B" ? "marca" : "neutro"}
        >
          {p.classe}
        </Etiqueta>
      ),
    },
    {
      chave: "qtd",
      titulo: "Qtd",
      alinha: "right",
      render: (p) => <>{numero(p.qtd)} un</>,
    },
    {
      chave: "receita",
      titulo: "Receita",
      alinha: "right",
      papel: "destaque",
      render: (p) => <span className="font-semibold text-tinta">{moeda(p.receita)}</span>,
    },
    {
      chave: "participacao",
      titulo: "Participação",
      papel: "sóTabela",
      render: (p) => (
        <div className="w-[130px]">
          <Barra fracao={p.receita / maior} />
        </div>
      ),
    },
    ...(podeVerLucro
      ? [
          {
            chave: "lucro",
            titulo: "Lucro",
            alinha: "right" as const,
            render: (p: LinhaAbc) => (
              <span className="text-positivo">{moeda(p.lucro)}</span>
            ),
          },
          {
            chave: "margemProd",
            titulo: "Margem",
            alinha: "right" as const,
            render: (p: LinhaAbc) => (
              <span className="text-suave">
                {porcento(p.receita > 0 ? p.lucro / p.receita : 0)}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Cabecalho
        titulo="Relatórios"
        descricao="Todo relatório sai em três formatos, porque são três necessidades diferentes."
        acoes={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <Selecao
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="col-span-2 sm:w-[168px]"
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
          </div>
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

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
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

        <div>
          <div className="mb-3">
            <TituloCartao>Por categoria</TituloCartao>
          </div>
          <Lista
            colunas={colunasCategoria}
            linhas={cats}
            chave={(c) => c.nome}
            vazio="Sem vendas no período."
          />
        </div>
      </div>

      <Cartao className="mt-4">
        <TituloCartao
          extra={
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-marca">
              <Snowflake size={13} /> avulso e caixa
            </span>
          }
        >
          Gelado — a geladeira se paga?
        </TituloCartao>
        {gelado.unidades === 0 ? (
          <p className="text-sm text-suave">Nenhuma venda gelada no período.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.3fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
                Saiu gelado
              </p>
              <p className="tabular mt-1.5 text-[22px] font-semibold leading-none text-tinta">
                {numero(gelado.unidades)} un
              </p>
              <p className="mt-1.5 text-[12px] text-suave">
                {numero(gelado.avulsas)} avulsas · {numero(gelado.emCaixa)} em caixa ou fardo
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
                Rendeu a mais por ser gelado
              </p>
              <p className="tabular mt-1.5 text-[22px] font-semibold leading-none text-positivo">
                {moeda(gelado.adicional)}
              </p>
              <p className="mt-1.5 text-[12px] text-suave">
                diferença para o preço natural, em {moeda(gelado.receita)} vendidos
              </p>
            </div>
            <div className="rounded-md border border-borda bg-superficie2/50 px-3.5 py-3">
              <Campo
                rotulo="Conta de luz da geladeira no período (R$)"
                dica="Estimativa — só para comparar. Não é gravado."
              >
                <Entrada
                  inputMode="decimal"
                  value={contaLuzTexto}
                  onChange={(e) => setContaLuzTexto(e.target.value)}
                  placeholder="0,00"
                />
              </Campo>
              {contaLuz > 0 && (
                <p
                  className={`mt-2.5 text-[13px] font-semibold ${
                    gelado.adicional >= contaLuz ? "text-positivo" : "text-alerta"
                  }`}
                >
                  {gelado.adicional >= contaLuz
                    ? `Se paga: sobram ${moeda(gelado.adicional - contaLuz)}.`
                    : `Não se paga: faltam ${moeda(contaLuz - gelado.adicional)}.`}
                </p>
              )}
            </div>
          </div>
        )}
        <p className="mt-4 border-t border-borda pt-3 text-[12.5px] leading-relaxed text-suave">
          O custo de energia não entra no custo do produto — isso bagunçaria o
          custo médio. O sistema separa quanto o gelado cobrou a mais em cada
          venda, para você comparar com a conta de luz.
        </p>
      </Cartao>

      <div className="mt-6">
        <div className="mb-3">
          <TituloCartao
            extra={
              <span className="text-right text-[11px] text-suave">
                curva ABC · {abc.filter((a) => a.classe === "A").length} produtos
                fazem 80% da receita
              </span>
            }
          >
            Lucro por produto
          </TituloCartao>
        </div>
        <Lista
          colunas={colunasProduto}
          linhas={abc}
          chave={(p) => p.produtoId}
          vazio="Sem vendas no período selecionado."
        />
      </div>

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
