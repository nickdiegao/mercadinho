"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Beer, FileText, Plus } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { custoItem } from "@/lib/regras";
import { moeda, numero, dataHora, diaCurto, hora } from "@/lib/formato";
import {
  Lista,
  SubLista,
  type ColunaLista,
  type ColunaSub,
} from "@/components/lista";
import type { Venda } from "@/lib/tipos";
import {
  Botao,
  Cabecalho,
  Entrada,
  Etiqueta,
  Selecao,
} from "@/components/ui";

export default function Vendas() {
  const { estado } = useEstado();
  const { podeVerLucro, podeVender } = usePerfil();
  const [busca, setBusca] = useState("");
  const [canal, setCanal] = useState("");
  const [forma, setForma] = useState("");

  const clientePorId = useMemo(
    () => new Map(estado.clientes.map((c) => [c.id, c])),
    [estado.clientes],
  );
  const produtoPorId = useMemo(
    () => new Map(estado.produtos.map((p) => [p.id, p])),
    [estado.produtos],
  );

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return estado.vendas
      .filter((v) => {
        if (canal && v.tipoPreco !== canal) return false;
        if (forma && v.formaPagamento !== forma) return false;
        if (!t) return true;
        const c = clientePorId.get(v.clienteId ?? "");
        return (
          String(v.numero).padStart(5, "0").includes(t) ||
          (c?.nomeRazao.toLowerCase().includes(t) ?? false)
        );
      })
      .slice(0, 200);
  }, [estado.vendas, busca, canal, forma, clientePorId]);

  const colunas: ColunaLista<Venda>[] = [
    {
      chave: "numero",
      titulo: "Nº",
      papel: "apoio",
      render: (v) => (
        <span className="font-medium">{String(v.numero).padStart(5, "0")}</span>
      ),
    },
    {
      chave: "data",
      titulo: "Data",
      papel: "apoio",
      render: (v) => (
        <>
          <span className="hidden md:inline whitespace-nowrap text-suave">
            {dataHora(v.data)}
          </span>
          <span className="md:hidden">
            {diaCurto(v.data)} às {hora(v.data)}
          </span>
        </>
      ),
    },
    {
      chave: "cliente",
      titulo: "Cliente",
      papel: "titulo",
      render: (v) => {
        const c = clientePorId.get(v.clienteId ?? "");
        return c ? (
          <span className="block max-w-[240px] truncate">{c.nomeRazao}</span>
        ) : (
          <span className="text-suave">Consumidor final</span>
        );
      },
    },
    {
      chave: "canal",
      titulo: "Canal",
      render: (v) => (
        <Etiqueta tom={v.tipoPreco === "ATACADO" ? "marca" : "neutro"}>
          {v.tipoPreco}
        </Etiqueta>
      ),
    },
    {
      chave: "pagamento",
      titulo: "Pagamento",
      render: (v) => (
        <Etiqueta tom={v.formaPagamento === "FIADO" ? "negativo" : "neutro"}>
          {v.formaPagamento}
        </Etiqueta>
      ),
    },
    {
      chave: "itens",
      titulo: "Itens",
      alinha: "right",
      render: (v) => (
        <>
          {v.itens.length}
          <span className="text-suave md:hidden">
            {" "}
            · {numero(v.itens.reduce((a, i) => a + i.qtd, 0))} un
          </span>
        </>
      ),
    },
    {
      chave: "total",
      titulo: "Total",
      alinha: "right",
      papel: "destaque",
      render: (v) => (
        <span className="font-semibold text-tinta">{moeda(v.total)}</span>
      ),
    },
    ...(podeVerLucro
      ? [
          {
            chave: "lucro",
            titulo: "Lucro",
            alinha: "right" as const,
            render: (v: Venda) => (
              <span className="text-positivo">{moeda(v.total - v.custoTotal)}</span>
            ),
          },
        ]
      : []),
  ];

  function detalhe(v: Venda) {
    const cascos = v.itens.filter((i) => produtoPorId.get(i.produtoId)?.vasilhameId);
    const totalCascos = cascos.reduce((a, i) => a + i.qtd, 0);

    return (
      <div>
        <SubLista
          itens={v.itens}
          chave={(i) => i.id}
          colunas={
            [
              {
                chave: "produto",
                titulo: "Produto",
                papel: "titulo",
                render: (i) => i.descricao,
              },
              {
                chave: "tabela",
                titulo: "Tabela",
                papel: "apoio",
                render: (i) => {
                  const p = produtoPorId.get(i.produtoId);
                  return (
                    <>
                      {i.tipoPrecoAplicado === "ATACADO" ? "atacado" : "varejo"}
                      {p && p.fatorConversao > 1 && (
                        <> · {numero(i.qtd / p.fatorConversao)} {p.unidadeCompra}</>
                      )}
                    </>
                  );
                },
              },
              {
                chave: "qtd",
                titulo: "Qtd",
                alinha: "right",
                render: (i) => (
                  <span className="font-semibold text-tinta">
                    {numero(i.qtd)} un
                  </span>
                ),
              },
              {
                chave: "preco",
                titulo: "Preço un.",
                alinha: "right",
                render: (i) => moeda(i.precoUnit),
              },
              ...(podeVerLucro
                ? [
                    {
                      chave: "custo",
                      titulo: "Custo un.",
                      alinha: "right" as const,
                      render: (i: (typeof v.itens)[number]) => (
                        <span className="text-suave">
                          {moeda(Math.round(i.custoUnit / 100))}
                        </span>
                      ),
                    },
                  ]
                : []),
              {
                chave: "total",
                titulo: "Total",
                alinha: "right",
                papel: "destaque",
                render: (i) => (
                  <span className="font-semibold text-tinta">{moeda(i.total)}</span>
                ),
              },
              ...(podeVerLucro
                ? [
                    {
                      chave: "lucro",
                      titulo: "Lucro",
                      alinha: "right" as const,
                      render: (i: (typeof v.itens)[number]) => (
                        <span className="text-positivo">
                          {moeda(i.total - custoItem(i.qtd, i.custoUnit))}
                        </span>
                      ),
                    },
                  ]
                : []),
            ] as ColunaSub<(typeof v.itens)[number]>[]
          }
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-suave">
            <span>
              {numero(v.itens.reduce((a, i) => a + i.qtd, 0))} unidades no total
            </span>
            {v.desconto > 0 && (
              <span className="text-negativo">desconto {moeda(v.desconto)}</span>
            )}
            {totalCascos > 0 && (
              <span className="flex items-center gap-1 text-casco">
                <Beer size={12} /> {numero(totalCascos)} cascos com o cliente
              </span>
            )}
          </div>
          <Link
            href={`/vendas/${v.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
          >
            <FileText size={13} /> Ver recibo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Vendas"
        descricao="Toque numa venda para ver os itens e as quantidades."
        acoes={
          podeVender && (
            <Link href="/vendas/nova" className="w-full sm:w-auto">
              <Botao variante="primario" className="w-full sm:w-auto">
                <Plus size={15} /> Nova venda
              </Botao>
            </Link>
          )
        }
      />

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px]">
        <Entrada
          placeholder="Buscar por número ou cliente…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={canal} onChange={(e) => setCanal(e.target.value)}>
          <option value="">Todos os canais</option>
          <option value="ATACADO">Atacado</option>
          <option value="VAREJO">Varejo</option>
        </Selecao>
        <Selecao value={forma} onChange={(e) => setForma(e.target.value)}>
          <option value="">Toda forma</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="DEBITO">Débito</option>
          <option value="CREDITO">Crédito</option>
          <option value="FIADO">Fiado</option>
        </Selecao>
      </div>

      <p className="mb-3 text-[12.5px] text-suave">
        {lista.length} venda{lista.length === 1 ? "" : "s"}
        {lista.length === 200 && " (mostrando as 200 mais recentes)"}
      </p>

      <Lista
        colunas={colunas}
        linhas={lista}
        chave={(v) => v.id}
        detalhe={detalhe}
        vazio="Nenhuma venda encontrada com esses filtros."
      />
    </>
  );
}
