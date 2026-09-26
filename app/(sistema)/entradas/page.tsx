"use client";

import Link from "next/link";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useEstado } from "@/lib/store";
import { moeda, numero, dataHora, diaCurto, custoCurto } from "@/lib/formato";
import {
  Lista,
  SubLista,
  type ColunaLista,
  type ColunaSub,
} from "@/components/lista";
import type { Entrada } from "@/lib/tipos";
import {
  Botao,
  Cabecalho,
  Cartao,
  Entrada as CampoEntrada,
} from "@/components/ui";

function ListaEntradas() {
  const { estado } = useEstado();
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca);

  // o extrato de estoque manda para ca com ?abrir=<id> quando o movimento
  // veio de uma compra: a carga ja abre expandida, mostrando o que entrou
  const parametros = useSearchParams();
  const abrirParam = parametros.get("abrir");
  useEffect(() => {
    if (!abrirParam) return;
    const alvo =
      document.getElementById(`linha-${abrirParam}`) ??
      document.getElementById(`item-${abrirParam}`);
    alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [abrirParam]);

  const fornPorId = useMemo(
    () => new Map(estado.fornecedores.map((f) => [f.id, f])),
    [estado.fornecedores],
  );
  const prodPorId = useMemo(
    () => new Map(estado.produtos.map((p) => [p.id, p])),
    [estado.produtos],
  );

  const lista = useMemo(() => {
    const t = buscaAdiada.trim().toLowerCase();
    return estado.entradas.filter((e) => {
      if (!t) return true;
      const f = fornPorId.get(e.fornecedorId);
      return (
        e.documentoFornecedor.toLowerCase().includes(t) ||
        (f?.razaoSocial.toLowerCase().includes(t) ?? false)
      );
    });
  }, [estado.entradas, buscaAdiada, fornPorId]);

  const total = lista.reduce((a, e) => a + e.valorTotal, 0);

  const colunas: ColunaLista<Entrada>[] = [
    {
      chave: "numero",
      titulo: "Nº",
      papel: "apoio",
      render: (e) => (
        <span className="font-medium">{String(e.numero).padStart(4, "0")}</span>
      ),
    },
    {
      chave: "data",
      titulo: "Data",
      papel: "apoio",
      render: (e) => (
        <>
          <span className="hidden whitespace-nowrap text-suave md:inline">
            {dataHora(e.data)}
          </span>
          <span className="md:hidden">{diaCurto(e.data)}</span>
        </>
      ),
    },
    {
      chave: "fornecedor",
      titulo: "Fornecedor",
      papel: "titulo",
      render: (e) => (
        <span className="block max-w-[260px] truncate">
          {fornPorId.get(e.fornecedorId)?.razaoSocial}
        </span>
      ),
    },
    {
      chave: "documento",
      titulo: "Documento",
      render: (e) => (
        <span className="mono text-suave">{e.documentoFornecedor}</span>
      ),
    },
    {
      chave: "itens",
      titulo: "Itens",
      alinha: "right",
      render: (e) => (
        <>
          {e.itens.length}
          <span className="text-suave md:hidden">
            {" "}
            · {numero(e.itens.reduce((a, i) => a + i.qtdBase, 0))} un
          </span>
        </>
      ),
    },
    {
      chave: "total",
      titulo: "Total",
      alinha: "right",
      papel: "destaque",
      render: (e) => (
        <span className="font-semibold text-tinta">{moeda(e.valorTotal)}</span>
      ),
    },
  ];

  function detalhe(e: Entrada) {
    return (
      <div>
        <SubLista
          itens={e.itens}
          chave={(i) => i.id}
          colunas={
            [
              {
                chave: "produto",
                titulo: "Produto",
                papel: "titulo",
                render: (i) => prodPorId.get(i.produtoId)?.nome ?? i.produtoId,
              },
              {
                chave: "comprada",
                titulo: "Qtd comprada",
                alinha: "right",
                render: (i) => (
                  <span className="font-semibold text-tinta">
                    {numero(i.qtdCompra)} {i.unidadeCompra}
                  </span>
                ),
              },
              {
                chave: "unidades",
                titulo: "Em unidades",
                alinha: "right",
                render: (i) => (
                  <span className="text-suave">{numero(i.qtdBase)} un</span>
                ),
              },
              {
                chave: "custo",
                titulo: "Custo por un.",
                alinha: "right",
                render: (i) => custoCurto(i.custoUnitBase),
              },
              {
                chave: "total",
                titulo: "Total",
                alinha: "right",
                papel: "destaque",
                render: (i) => (
                  <span className="font-semibold text-tinta">
                    {moeda(i.valorTotal)}
                  </span>
                ),
              },
            ] as ColunaSub<(typeof e.itens)[number]>[]
          }
        />
        <p className="mt-3 border-t border-borda pt-3 text-[12px] text-suave">
          Entraram {numero(e.itens.reduce((a, i) => a + i.qtdBase, 0))} unidades
          no estoque. A compra foi digitada em caixa, fardo ou engradado — o
          sistema converteu para unidade.
        </p>
      </div>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Entradas de mercadoria"
        descricao={`${estado.entradas.length} cargas · ${moeda(total)} em compras no período.`}
        acoes={
          <Link href="/entradas/nova" className="w-full sm:w-auto">
            <Botao variante="primario" className="w-full sm:w-auto">
              <Plus size={15} /> Nova entrada
            </Botao>
          </Link>
        }
      />

      <div className="nao-imprime mb-4">
        <CampoEntrada
          placeholder="Buscar por fornecedor ou documento…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Lista
        colunas={colunas}
        linhas={lista}
        chave={(e) => e.id}
        detalhe={detalhe}
        abertaInicial={abrirParam}
        vazio="Nenhuma entrada encontrada."
      />

      <Cartao className="mt-4">
        <p className="text-[13px] leading-relaxed text-tinta2">
          Toque numa carga para ver o que entrou. Repare na coluna{" "}
          <b>Em unidades</b>: a compra é digitada em caixa, fardo ou engradado, e
          o sistema guarda tudo em unidade. É o que permite vender uma lata
          avulsa no varejo e a caixa fechada no atacado sem o estoque se perder.
        </p>
      </Cartao>
    </>
  );
}

export default function Entradas() {
  // useSearchParams precisa de fronteira de Suspense para a rota seguir estatica
  return (
    <Suspense fallback={<p className="text-sm text-suave">Carregando…</p>}>
      <ListaEntradas />
    </Suspense>
  );
}
