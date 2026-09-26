"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PackagePlus, Pencil, Plus } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { FormFornecedor } from "@/components/form-fornecedor";
import { moeda, numero, data } from "@/lib/formato";
import { Lista, SubLista, type ColunaLista, type ColunaSub } from "@/components/lista";
import type { Entrada, Fornecedor } from "@/lib/tipos";
import { Botao, Cabecalho, Cartao } from "@/components/ui";

export default function Fornecedores() {
  const { estado } = useEstado();
  const { podeCadastrarFornecedor } = usePerfil();
  const [form, setForm] = useState<{ fornecedor: Fornecedor | null } | null>(null);
  const [verInativos, setVerInativos] = useState(false);
  const inativos = estado.fornecedores.filter((f) => f.ativo === false).length;

  const resumo = useMemo(() => {
    const acc = new Map<
      string,
      { cargas: number; total: number; ultima: string; itens: number }
    >();
    for (const e of estado.entradas) {
      const a =
        acc.get(e.fornecedorId) ??
        { cargas: 0, total: 0, ultima: e.data, itens: 0 };
      a.cargas += 1;
      a.total += e.valorTotal;
      a.itens += e.itens.reduce((s, i) => s + i.qtdBase, 0);
      if (e.data > a.ultima) a.ultima = e.data;
      acc.set(e.fornecedorId, a);
    }
    return acc;
  }, [estado.entradas]);

  const ordenados = useMemo(
    () =>
      estado.fornecedores
        .filter((f) => (verInativos ? f.ativo === false : f.ativo !== false))
        .sort(
        (a, b) => (resumo.get(b.id)?.total ?? 0) - (resumo.get(a.id)?.total ?? 0),
      ),
    [estado.fornecedores, resumo, verInativos],
  );

  const colunas: ColunaLista<Fornecedor>[] = [
    {
      chave: "razao",
      titulo: "Fornecedor",
      papel: "titulo",
      render: (f) => (
        <span className="block max-w-[300px]">
          <span className="block truncate">{f.razaoSocial}</span>
          <span className="hidden truncate text-[11.5px] font-normal text-suave md:block">
            {f.endereco}
          </span>
        </span>
      ),
    },
    {
      chave: "endereco",
      titulo: "Endereço",
      papel: "sóCartao",
      render: (f) => <>{f.endereco}</>,
    },
    {
      chave: "cnpj",
      titulo: "CNPJ",
      render: (f) => <span className="mono text-suave">{f.cnpj}</span>,
    },
    {
      chave: "contato",
      titulo: "Contato",
      render: (f) => (
        <span className="block min-w-0 text-suave">
          <span className="block truncate">{f.telefone}</span>
          <span className="block truncate text-[11.5px]">{f.email}</span>
        </span>
      ),
    },
    {
      chave: "cargas",
      titulo: "Cargas",
      alinha: "right",
      render: (f) => <>{resumo.get(f.id)?.cargas ?? 0}</>,
    },
    {
      chave: "total",
      titulo: "Total comprado",
      alinha: "right",
      papel: "destaque",
      render: (f) => (
        <span className="font-semibold text-tinta">
          {moeda(resumo.get(f.id)?.total ?? 0)}
        </span>
      ),
    },
    {
      chave: "ultima",
      titulo: "Última carga",
      alinha: "right",
      render: (f) => {
        const r = resumo.get(f.id);
        return <span className="text-suave">{r ? data(r.ultima) : "—"}</span>;
      },
    },
  ];

  function cargasDe(f: Fornecedor) {
    const cargas = estado.entradas
      .filter((e) => e.fornecedorId === f.id)
      .slice(0, 6);

    if (cargas.length === 0) {
      return (
        <p className="text-[13px] text-suave">
          Nenhuma carga registrada deste fornecedor no período.
        </p>
      );
    }

    return (
      <div>
        <SubLista
          itens={cargas}
          chave={(e) => e.id}
          colunas={
            [
              {
                chave: "documento",
                titulo: "Documento",
                papel: "titulo",
                render: (e) => (
                  <>
                    {e.documentoFornecedor}
                    <span className="ml-2 font-normal text-suave">
                      nº {String(e.numero).padStart(4, "0")}
                    </span>
                  </>
                ),
              },
              {
                chave: "data",
                titulo: "Data",
                papel: "apoio",
                render: (e) => data(e.data),
              },
              {
                chave: "itens",
                titulo: "Itens",
                alinha: "right",
                render: (e) => (
                  <>
                    {e.itens.length} ·{" "}
                    {numero(e.itens.reduce((a, i) => a + i.qtdBase, 0))} un
                  </>
                ),
              },
              {
                chave: "valor",
                titulo: "Valor",
                alinha: "right",
                papel: "destaque",
                render: (e) => (
                  <span className="font-semibold text-tinta">
                    {moeda(e.valorTotal)}
                  </span>
                ),
              },
            ] as ColunaSub<Entrada>[]
          }
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-3">
          <span className="text-[12px] text-suave">
            {numero(resumo.get(f.id)?.itens ?? 0)} unidades compradas no total
          </span>
          <Link
            href="/entradas/nova"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
          >
            <PackagePlus size={13} /> Lançar nova carga
          </Link>
        </div>
      </div>
    );
  }

  function detalhe(f: Fornecedor) {
    return (
      <div>
        {cargasDe(f)}
        {podeCadastrarFornecedor && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setForm({ fornecedor: f });
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
          >
            <Pencil size={13} /> Editar cadastro
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Fornecedores"
        descricao="Cadastro deliberadamente enxuto. Toque num fornecedor para ver as últimas cargas — é de onde vem o custo."
        acoes={
          podeCadastrarFornecedor && (
            <Botao
              variante="primario"
              onClick={() => setForm({ fornecedor: null })}
              className="w-full sm:w-auto"
            >
              <Plus size={15} /> Novo fornecedor
            </Botao>
          )
        }
      />

      {(inativos > 0 || verInativos) && (
        <button
          onClick={() => setVerInativos((v) => !v)}
          className="nao-imprime mb-3 text-[12.5px] font-semibold text-marca hover:underline"
        >
          {verInativos ? "Voltar aos fornecedores ativos" : `Ver desativados (${inativos})`}
        </button>
      )}

      <Lista
        colunas={colunas}
        linhas={ordenados}
        chave={(f) => f.id}
        detalhe={detalhe}
        vazio="Nenhum fornecedor cadastrado."
      />

      <Cartao className="mt-4">
        <p className="text-[13px] leading-relaxed text-tinta2">
          Na hora da carga inicial, é o histórico de compras destes fornecedores
          que faz o custo médio nascer verdadeiro. Sem as notas deles, o custo de
          cada produto vira chute — e chute no custo estraga o relatório de lucro
          para sempre.
        </p>
      </Cartao>
      <FormFornecedor
        aberto={form !== null}
        fornecedor={form?.fornecedor}
        onFechar={() => setForm(null)}
      />
    </>
  );
}
