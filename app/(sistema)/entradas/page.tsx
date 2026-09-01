"use client";

import Link from "next/link";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useEstado } from "@/lib/store";
import { moeda, numero, dataHora, custoCurto } from "@/lib/formato";
import {
  Botao,
  Cabecalho,
  Cartao,
  Entrada as CampoEntrada,
  Rolagem,
  Tabela,
  Td,
  Th,
  Vazio,
} from "@/components/ui";

function ListaEntradas() {
  const { estado } = useEstado();
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  // o extrato de estoque manda para ca com ?abrir=<id> quando o movimento
  // veio de uma compra: a carga ja abre expandida, mostrando o que entrou
  const parametros = useSearchParams();
  const abrirParam = parametros.get("abrir");
  useEffect(() => {
    if (!abrirParam) return;
    setAberta(abrirParam);
    const alvo = document.getElementById(`entrada-${abrirParam}`);
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
    const t = busca.trim().toLowerCase();
    return estado.entradas.filter((e) => {
      if (!t) return true;
      const f = fornPorId.get(e.fornecedorId);
      return (
        e.documentoFornecedor.toLowerCase().includes(t) ||
        (f?.razaoSocial.toLowerCase().includes(t) ?? false)
      );
    });
  }, [estado.entradas, busca, fornPorId]);

  const total = lista.reduce((a, e) => a + e.valorTotal, 0);

  return (
    <>
      <Cabecalho
        titulo="Entradas de mercadoria"
        descricao={`${estado.entradas.length} cargas lançadas · ${moeda(total)} em compras no período.`}
        acoes={
          <Link href="/entradas/nova">
            <Botao variante="primario">
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

      <Rolagem>
        <Tabela>
          <thead>
            <tr>
              <Th />
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Fornecedor</Th>
              <Th>Documento</Th>
              <Th alinha="right">Itens</Th>
              <Th alinha="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => {
              const f = fornPorId.get(e.fornecedorId);
              const expandida = aberta === e.id;
              return (
                <Fragment key={e.id}>
                  <tr
                    id={`entrada-${e.id}`}
                    className={`transicao cursor-pointer hover:bg-superficie2/60 ${
                      expandida ? "bg-marca-clara/40" : ""
                    }`}
                    onClick={() => setAberta(expandida ? null : e.id)}
                  >
                    <Td className="w-8 text-suave">
                      {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </Td>
                    <Td className="tabular font-medium">
                      {String(e.numero).padStart(4, "0")}
                    </Td>
                    <Td className="whitespace-nowrap text-suave">{dataHora(e.data)}</Td>
                    <Td className="max-w-[260px] truncate">{f?.razaoSocial}</Td>
                    <Td className="mono text-suave">{e.documentoFornecedor}</Td>
                    <Td alinha="right">{e.itens.length}</Td>
                    <Td alinha="right" className="font-semibold text-tinta">
                      {moeda(e.valorTotal)}
                    </Td>
                  </tr>
                  {expandida && (
                    <tr>
                      <Td colSpan={7} className="bg-superficie2/40 p-0">
                        <div className="px-6 py-4">
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="border-b border-borda2">
                                <th className="py-1.5 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                                  Produto
                                </th>
                                <th className="py-1.5 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                                  Qtd comprada
                                </th>
                                <th className="py-1.5 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                                  Em unidades
                                </th>
                                <th className="py-1.5 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                                  Custo por unidade
                                </th>
                                <th className="py-1.5 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.itens.map((i) => (
                                <tr key={i.id} className="border-b border-borda/70 last:border-b-0">
                                  <td className="py-1.5 text-tinta2">
                                    {prodPorId.get(i.produtoId)?.nome ?? i.produtoId}
                                  </td>
                                  <td className="tabular py-1.5 text-right">
                                    {numero(i.qtdCompra)} {i.unidadeCompra}
                                  </td>
                                  <td className="tabular py-1.5 text-right text-suave">
                                    {numero(i.qtdBase)} un
                                  </td>
                                  <td className="tabular py-1.5 text-right">
                                    {custoCurto(i.custoUnitBase)}
                                  </td>
                                  <td className="tabular py-1.5 text-right font-semibold">
                                    {moeda(i.valorTotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Tabela>
        {lista.length === 0 && <Vazio>Nenhuma entrada encontrada.</Vazio>}
      </Rolagem>

      <Cartao className="mt-4">
        <p className="text-[13px] leading-relaxed text-tinta2">
          Repare na coluna <b>Em unidades</b>: a compra é digitada em caixa,
          fardo ou engradado, e o sistema guarda tudo em unidade. É o que
          permite vender uma lata avulsa no varejo e a caixa fechada no atacado
          sem o estoque se perder.
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
