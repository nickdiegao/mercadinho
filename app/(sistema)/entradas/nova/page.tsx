"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Search, Trash2 } from "lucide-react";
import { useEstado } from "@/lib/store";
import { custoUnitBase, novoCustoMedio, paraBase } from "@/lib/regras";
import { moeda, numero, custoCurto } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Cartao,
  Entrada,
  Rolagem,
  Selecao,
  Tabela,
  Td,
  Th,
  TituloCartao,
} from "@/components/ui";

interface Linha {
  produtoId: string;
  qtdCompra: number;
  custoTexto: string;
}

export default function NovaEntrada() {
  const { estado, registrarEntrada } = useEstado();
  const router = useRouter();
  const buscaRef = useRef<HTMLInputElement>(null);

  const [fornecedorId, setFornecedorId] = useState(estado.fornecedores[0]?.id ?? "");
  const [documento, setDocumento] = useState("");
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const compraveis = useMemo(
    () => estado.produtos.filter((p) => p.tipo === "NORMAL" && p.ativo),
    [estado.produtos],
  );

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    return compraveis
      .filter((p) => p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t))
      .slice(0, 7);
  }, [busca, compraveis]);

  const itens = linhas.map((l) => {
    const p = estado.produtos.find((x) => x.id === l.produtoId)!;
    const custoUnitCompra = Math.round(
      (parseFloat(l.custoTexto.replace(",", ".")) || 0) * 100,
    );
    const qtdBase = paraBase(l.qtdCompra, p.fatorConversao);
    const cBase = custoUnitBase(custoUnitCompra, p.fatorConversao);
    const cmpDepois = novoCustoMedio(p.saldoAtual, p.custoMedio, qtdBase, cBase);
    return {
      ...l,
      produto: p,
      custoUnitCompra,
      qtdBase,
      custoUnitBase: cBase,
      cmpAntes: p.custoMedio,
      cmpDepois,
      total: Math.round(l.qtdCompra * custoUnitCompra),
    };
  });

  const total = itens.reduce((a, i) => a + i.total, 0);
  const valido = itens.length > 0 && itens.every((i) => i.custoUnitCompra > 0 && i.qtdCompra > 0);

  function adicionar(p: Produto) {
    setLinhas((ls) => {
      if (ls.some((l) => l.produtoId === p.id)) return ls;
      return [
        ...ls,
        {
          produtoId: p.id,
          qtdCompra: 1,
          custoTexto: (p.custoUltimaCompra * p.fatorConversao / 10000).toFixed(2).replace(".", ","),
        },
      ];
    });
    setBusca("");
    buscaRef.current?.focus();
  }

  function finalizar() {
    if (!valido) return;
    registrarEntrada({
      fornecedorId,
      documentoFornecedor: documento || "sem documento",
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        qtdCompra: i.qtdCompra,
        custoUnitCompra: i.custoUnitCompra,
      })),
    });
    router.push("/entradas");
  }

  return (
    <>
      <Cabecalho
        titulo="Entrada de mercadoria"
        descricao="Lance a carga em caixa, fardo ou engradado. O sistema converte para unidade e recalcula o custo médio."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Cartao>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Fornecedor">
                <Selecao
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                >
                  {estado.fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razaoSocial}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo rotulo="Documento do fornecedor" dica="Número da nota que veio com a carga">
                <Entrada
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="NF 48219"
                />
              </Campo>
            </div>
          </Cartao>

          <Cartao>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave"
              />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && resultados[0]) adicionar(resultados[0]);
                }}
                placeholder="Buscar produto para lançar…"
                className="w-full rounded-md border border-borda bg-superficie py-2.5 pl-9 pr-3 text-sm focus:border-marca focus:outline-none"
              />
            </div>
            {resultados.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-md border border-borda">
                {resultados.map((p, i) => (
                  <li key={p.id}>
                    <button
                      onClick={() => adicionar(p)}
                      className={`transicao flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-marca-clara ${i === 0 ? "bg-superficie2/60" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">
                          {p.nome}
                        </span>
                        <span className="text-[11.5px] text-suave">
                          saldo {numero(p.saldoAtual)} un · 1 {p.unidadeCompra} ={" "}
                          {p.fatorConversao} un
                        </span>
                      </span>
                      <span className="shrink-0 text-[11.5px] text-suave">
                        custo médio {custoCurto(p.custoMedio)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {itens.length > 0 && (
            <Cartao padding={false}>
              <Rolagem>
                <Tabela>
                  <thead>
                    <tr>
                      <Th>Produto</Th>
                      <Th alinha="right">Qtd</Th>
                      <Th alinha="right">Custo por {"embalagem"}</Th>
                      <Th alinha="right">Vira</Th>
                      <Th alinha="right">Total</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr key={i.produtoId}>
                        <Td className="max-w-[220px]">
                          <span className="block truncate font-medium text-tinta">
                            {i.produto.nome}
                          </span>
                          <span className="text-[11.5px] text-suave">
                            {i.produto.unidadeCompra} com {i.produto.fatorConversao} un
                          </span>
                        </Td>
                        <Td alinha="right">
                          <input
                            value={i.qtdCompra}
                            onChange={(e) =>
                              setLinhas((ls) =>
                                ls.map((l) =>
                                  l.produtoId === i.produtoId
                                    ? { ...l, qtdCompra: Number(e.target.value) || 0 }
                                    : l,
                                ),
                              )
                            }
                            className="tabular w-16 rounded border border-borda px-2 py-1 text-right text-sm focus:border-marca focus:outline-none"
                          />
                        </Td>
                        <Td alinha="right">
                          <input
                            value={i.custoTexto}
                            onChange={(e) =>
                              setLinhas((ls) =>
                                ls.map((l) =>
                                  l.produtoId === i.produtoId
                                    ? { ...l, custoTexto: e.target.value }
                                    : l,
                                ),
                              )
                            }
                            inputMode="decimal"
                            className="tabular w-24 rounded border border-borda px-2 py-1 text-right text-sm focus:border-marca focus:outline-none"
                          />
                        </Td>
                        <Td alinha="right" className="text-suave">
                          {numero(i.qtdBase)} un
                          <br />
                          <span className="text-[11px]">
                            {custoCurto(i.custoUnitBase)}/un
                          </span>
                        </Td>
                        <Td alinha="right" className="font-semibold text-tinta">
                          {moeda(i.total)}
                        </Td>
                        <Td>
                          <button
                            onClick={() =>
                              setLinhas((ls) => ls.filter((l) => l.produtoId !== i.produtoId))
                            }
                            className="transicao rounded p-1.5 text-suave hover:bg-alerta-claro hover:text-alerta"
                            aria-label="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </Rolagem>
            </Cartao>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Cartao>
            <TituloCartao>Resumo</TituloCartao>
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-suave">Itens</dt>
                <dd className="tabular">{itens.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-suave">Unidades que entram</dt>
                <dd className="tabular">
                  {numero(itens.reduce((a, i) => a + i.qtdBase, 0))}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-borda pt-2.5">
                <dt className="font-bold text-tinta">Total da carga</dt>
                <dd className="tabular text-xl font-semibold text-tinta">
                  {moeda(total)}
                </dd>
              </div>
            </dl>
            <Botao
              variante="primario"
              onClick={finalizar}
              disabled={!valido}
              className="mt-4 w-full py-2.5"
            >
              <Check size={16} /> Lançar entrada
            </Botao>
          </Cartao>

          {itens.length > 0 && (
            <Cartao>
              <TituloCartao>Custo médio antes e depois</TituloCartao>
              <ul className="space-y-3">
                {itens.map((i) => {
                  const subiu = i.cmpDepois > i.cmpAntes;
                  const mudou = i.cmpDepois !== i.cmpAntes;
                  return (
                    <li key={i.produtoId} className="border-b border-borda pb-3 last:border-b-0 last:pb-0">
                      <p className="truncate text-[12.5px] font-medium text-tinta">
                        {i.produto.nome}
                      </p>
                      <p className="tabular mt-1 flex items-center gap-1.5 text-[13px]">
                        <span className="text-suave">{custoCurto(i.cmpAntes)}</span>
                        <ArrowRight size={12} className="text-suave" />
                        <span
                          className={
                            !mudou
                              ? "font-semibold text-tinta"
                              : subiu
                                ? "font-semibold text-negativo"
                                : "font-semibold text-positivo"
                          }
                        >
                          {custoCurto(i.cmpDepois)}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[12px] leading-relaxed text-suave">
                Média ponderada entre o que já estava no estoque e o que está
                chegando. É o único momento em que o custo muda.
              </p>
            </Cartao>
          )}

          <Aviso titulo="Por que isso importa">
            O custo que aparece aqui é o que vai congelar dentro de cada venda
            futura. Se ele entrar errado, todo relatório de lucro sai errado — e
            não tem como corrigir depois sem refazer o histórico.
          </Aviso>
        </div>
      </div>
    </>
  );
}
