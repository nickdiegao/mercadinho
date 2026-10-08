"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, PackagePlus, Plus, Search, Trash2 } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { FormProduto } from "@/components/form-produto";
import { FormFornecedor } from "@/components/form-fornecedor";
import { custoUnitBase, novoCustoMedio, paraBase } from "@/lib/regras";
import { moeda, numero, custoCurto } from "@/lib/formato";
import { nomeEmbalagem, rotuloEmbalagem, saldoContado, temEmbalagem } from "@/lib/embalagem";
import type { Produto } from "@/lib/tipos";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Cartao,
  Entrada,
  Selecao,
  TituloCartao,
} from "@/components/ui";

interface Linha {
  produtoId: string;
  /** Na embalagem do produto, ou em unidade quando `porUnidade`. */
  qtdCompra: number;
  /** Custo de cada embalagem — ou de cada unidade, quando `porUnidade`. */
  custoTexto: string;
  /** Chegou avulso (6 garrafas), nao em caixa fechada. */
  porUnidade: boolean;
}

const paraTexto = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");
const paraCentavos = (t: string) => Math.round((parseFloat(t.replace(",", ".")) || 0) * 100);

export default function NovaEntrada() {
  const { estado, registrarEntrada } = useEstado();
  const router = useRouter();
  const buscaRef = useRef<HTMLInputElement>(null);

  const { podeCadastrarProduto, podeCadastrarFornecedor } = usePerfil();
  const fornecedoresAtivos = useMemo(
    () => estado.fornecedores.filter((f) => f.ativo !== false),
    [estado.fornecedores],
  );
  const [fornecedorId, setFornecedorId] = useState(fornecedoresAtivos[0]?.id ?? "");
  const [novoProduto, setNovoProduto] = useState(false);
  const [novoFornecedor, setNovoFornecedor] = useState(false);
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
      .filter(
        (p) => p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t),
      )
      .slice(0, 7);
  }, [busca, compraveis]);

  const itens = linhas.map((l) => {
    const p = estado.produtos.find((x) => x.id === l.produtoId)!;
    const custoUnitCompra = paraCentavos(l.custoTexto);
    // avulso: cada "embalagem" e uma unidade so
    const fator = l.porUnidade ? 1 : p.fatorConversao;
    const qtdBase = paraBase(l.qtdCompra, fator);
    const cBase = custoUnitBase(custoUnitCompra, fator);
    const cmpDepois = novoCustoMedio(p.saldoAtual, p.custoMedio, qtdBase, cBase);
    return {
      ...l,
      produto: p,
      /** "cx", "fd"… ou "un", para os rotulos da linha */
      sigla: l.porUnidade ? "un" : p.unidadeCompra.toLowerCase(),
      custoUnitCompra,
      qtdBase,
      custoUnitBase: cBase,
      cmpAntes: p.custoMedio,
      cmpDepois,
      total: Math.round(l.qtdCompra * custoUnitCompra),
    };
  });

  const total = itens.reduce((a, i) => a + i.total, 0);
  const valido =
    itens.length > 0 && itens.every((i) => i.custoUnitCompra > 0 && i.qtdCompra > 0);

  function adicionar(p: Produto, porUnidade = !temEmbalagem(p)) {
    setLinhas((ls) => {
      if (ls.some((l) => l.produtoId === p.id)) return ls;
      const fator = porUnidade ? 1 : p.fatorConversao;
      return [
        ...ls,
        {
          produtoId: p.id,
          qtdCompra: 1,
          // sugere o ultimo custo pago, no formato escolhido
          custoTexto: paraTexto(Math.round((p.custoUltimaCompra * fator) / 100)),
          porUnidade,
        },
      ];
    });
    setBusca("");
    buscaRef.current?.focus();
  }

  const mudar = (produtoId: string, campo: keyof Linha, valor: string | number) =>
    setLinhas((ls) =>
      ls.map((l) => (l.produtoId === produtoId ? { ...l, [campo]: valor } : l)),
    );

  /** Troca entre caixa e unidade, convertendo quantidade e custo. */
  function trocarFormato(produtoId: string, porUnidade: boolean) {
    setLinhas((ls) =>
      ls.map((l) => {
        if (l.produtoId !== produtoId || l.porUnidade === porUnidade) return l;
        const fator = estado.produtos.find((x) => x.id === produtoId)!.fatorConversao;
        const custo = paraCentavos(l.custoTexto);
        return porUnidade
          ? { ...l, porUnidade, qtdCompra: l.qtdCompra * fator, custoTexto: paraTexto(Math.round(custo / fator)) }
          : {
              ...l,
              porUnidade,
              qtdCompra: Math.max(1, Math.round(l.qtdCompra / fator)),
              custoTexto: paraTexto(custo * fator),
            };
      }),
    );
  }

  const remover = (produtoId: string) =>
    setLinhas((ls) => ls.filter((l) => l.produtoId !== produtoId));

  function finalizar() {
    if (!valido) return;
    registrarEntrada({
      fornecedorId,
      documentoFornecedor: documento || "sem documento",
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        qtdCompra: i.qtdCompra,
        custoUnitCompra: i.custoUnitCompra,
        porUnidade: i.porUnidade,
      })),
    });
    router.push("/entradas");
  }

  const seletor = (i: (typeof itens)[number]) =>
    temEmbalagem(i.produto) ? (
      <span
        role="group"
        aria-label="Chegou em"
        className="mt-1 inline-flex rounded-full border border-borda2 p-0.5 text-[11px]"
      >
        {[false, true].map((un) => (
          <button
            key={String(un)}
            onClick={() => trocarFormato(i.produtoId, un)}
            aria-pressed={i.porUnidade === un}
            className={`transicao whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
              i.porUnidade === un ? "bg-marca text-white" : "text-tinta2 hover:text-marca"
            }`}
          >
            {un
              ? "Unidade"
              : `${rotuloEmbalagem(i.produto.unidadeCompra)} c/ ${i.produto.fatorConversao}`}
          </button>
        ))}
      </span>
    ) : (
      <span className="text-[11.5px] text-suave">por unidade</span>
    );

  const campoNum =
    "tabular w-full rounded border border-borda px-2 py-1.5 text-right text-sm focus:border-marca focus:outline-none";

  return (
    <>
      <Cabecalho
        titulo="Entrada de mercadoria"
        descricao="Lance a carga em caixa, fardo, engradado ou por unidade avulsa. O sistema converte tudo para unidade e recalcula o custo médio."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Fornecedor">
                <div className="flex gap-2">
                <Selecao
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                >
                  {fornecedoresAtivos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razaoSocial}
                    </option>
                  ))}
                </Selecao>
                {podeCadastrarFornecedor && (
                  <Botao
                    type="button"
                    onClick={() => setNovoFornecedor(true)}
                    className="shrink-0 px-2.5"
                    aria-label="Cadastrar fornecedor novo"
                    title="Cadastrar fornecedor novo"
                  >
                    <Plus size={15} />
                  </Botao>
                )}
                </div>
              </Campo>
              <Campo
                rotulo="Documento do fornecedor"
                dica="Número da nota que veio com a carga"
              >
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
            {busca.trim().length >= 2 && resultados.length === 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-borda2 px-3 py-2.5">
                <span className="text-[13px] text-tinta2">
                  Nenhum produto com &ldquo;{busca.trim()}&rdquo;.
                </span>
                {podeCadastrarProduto && (
                  <Botao tamanho="sm" onClick={() => setNovoProduto(true)}>
                    <PackagePlus size={13} /> Cadastrar produto novo
                  </Botao>
                )}
              </div>
            )}
            {resultados.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-md border border-borda">
                {resultados.map((p, i) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-2 border-b border-borda px-3 py-2 last:border-b-0 ${
                      i === 0 ? "bg-superficie2/60" : ""
                    }`}
                  >
                    <button
                      onClick={() => adicionar(p)}
                      className="transicao min-w-0 flex-1 rounded py-0.5 text-left hover:text-marca"
                    >
                      <span className="line-clamp-2 block text-[13.5px] font-medium leading-snug">
                        {p.nome}
                      </span>
                      <span className="tabular block text-[11.5px] text-suave">
                        estoque {saldoContado(p)}
                        {temEmbalagem(p) &&
                          ` · ${nomeEmbalagem(p.unidadeCompra)} com ${p.fatorConversao}`}
                        <span className="hidden sm:inline"> · custo médio {custoCurto(p.custoMedio)}</span>
                      </span>
                    </button>
                    <span className="flex shrink-0 gap-1.5">
                      {temEmbalagem(p) && (
                        <button
                          onClick={() => adicionar(p, false)}
                          aria-label={`Lançar em ${nomeEmbalagem(p.unidadeCompra)} ${p.nome}`}
                          className="transicao rounded-md border border-marca/40 bg-marca-clara/60 px-2 py-1 text-[11.5px] font-semibold text-marca hover:border-marca hover:bg-marca-clara"
                        >
                          + {p.unidadeCompra.toLowerCase()}
                        </button>
                      )}
                      <button
                        onClick={() => adicionar(p, true)}
                        aria-label={`Lançar em unidade ${p.nome}`}
                        className="transicao rounded-md border border-borda2 bg-superficie px-2 py-1 text-[11.5px] font-semibold text-tinta2 hover:border-marca hover:bg-marca-clara"
                      >
                        + un
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {podeCadastrarProduto && busca.trim().length < 2 && (
              <button
                onClick={() => setNovoProduto(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
              >
                <PackagePlus size={13} /> Chegou um produto que ainda não está cadastrado?
              </button>
            )}
          </Cartao>

          {itens.length > 0 && (
            <>
              {/* ------------------------------------------- celular */}
              <ul className="flex flex-col gap-2 md:hidden">
                {itens.map((i) => (
                  <li
                    key={i.produtoId}
                    className="rounded-lg border border-borda bg-superficie p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-tinta">
                          {i.produto.nome}
                        </p>
                        {seletor(i)}
                      </div>
                      <button
                        onClick={() => remover(i.produtoId)}
                        className="transicao shrink-0 rounded-md p-1.5 text-suave hover:bg-alerta-claro hover:text-alerta"
                        aria-label={`Remover ${i.produto.nome}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-suave">
                          Qtd em {i.sigla}
                        </span>
                        <input
                          value={i.qtdCompra}
                          onChange={(e) =>
                            mudar(i.produtoId, "qtdCompra", Number(e.target.value) || 0)
                          }
                          inputMode="numeric"
                          className={campoNum}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-suave">
                          Custo por {i.sigla} (R$)
                        </span>
                        <input
                          value={i.custoTexto}
                          onChange={(e) =>
                            mudar(i.produtoId, "custoTexto", e.target.value)
                          }
                          inputMode="decimal"
                          className={campoNum}
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-borda pt-2.5">
                      <span className="text-[11.5px] text-suave">
                        vira {numero(i.qtdBase)} un ·{" "}
                        {custoCurto(i.custoUnitBase)}/un
                      </span>
                      <span className="tabular text-[15px] font-semibold text-tinta">
                        {moeda(i.total)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ------------------------------------------- desktop */}
              <div className="hidden overflow-x-auto rounded-lg border border-borda bg-superficie md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Cab>Produto</Cab>
                      <Cab alinha="right">Qtd</Cab>
                      <Cab alinha="right">Custo de cada</Cab>
                      <Cab alinha="right">Vira</Cab>
                      <Cab alinha="right">Total</Cab>
                      <Cab />
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr key={i.produtoId}>
                        <Cel className="max-w-[220px]">
                          <span className="block truncate font-medium text-tinta">
                            {i.produto.nome}
                          </span>
                          {seletor(i)}
                        </Cel>
                        <Cel alinha="right">
                          <input
                            value={i.qtdCompra}
                            onChange={(e) =>
                              mudar(i.produtoId, "qtdCompra", Number(e.target.value) || 0)
                            }
                            inputMode="numeric"
                            aria-label={`Quantidade de ${i.produto.nome}`}
                            className={`${campoNum} w-16`}
                          />
                          <span className="mt-0.5 block text-[11px] text-suave">{i.sigla}</span>
                        </Cel>
                        <Cel alinha="right">
                          <input
                            value={i.custoTexto}
                            onChange={(e) =>
                              mudar(i.produtoId, "custoTexto", e.target.value)
                            }
                            inputMode="decimal"
                            aria-label={`Custo de ${i.produto.nome}`}
                            className={`${campoNum} w-24`}
                          />
                          <span className="mt-0.5 block text-[11px] text-suave">por {i.sigla}</span>
                        </Cel>
                        <Cel alinha="right" className="text-suave">
                          {numero(i.qtdBase)} un
                          <br />
                          <span className="text-[11px]">
                            {custoCurto(i.custoUnitBase)}/un
                          </span>
                        </Cel>
                        <Cel alinha="right" className="font-semibold text-tinta">
                          {moeda(i.total)}
                        </Cel>
                        <Cel>
                          <button
                            onClick={() => remover(i.produtoId)}
                            className="transicao rounded p-1.5 text-suave hover:bg-alerta-claro hover:text-alerta"
                            aria-label={`Remover ${i.produto.nome}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </Cel>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Cartao>
            <TituloCartao>Resumo</TituloCartao>
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-suave">Itens</dt>
                <dd className="tabular">{itens.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-suave">Unidades que entram</dt>
                <dd className="tabular">
                  {numero(itens.reduce((a, i) => a + i.qtdBase, 0))}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-borda pt-2.5">
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
                    <li
                      key={i.produtoId}
                      className="border-b border-borda pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="truncate text-[12.5px] font-medium text-tinta">
                        {i.produto.nome}
                      </p>
                      <p className="tabular mt-1 flex items-center gap-1.5 text-[13px]">
                        <span className="text-suave">{custoCurto(i.cmpAntes)}</span>
                        <ArrowRight size={12} className="shrink-0 text-suave" />
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
      {/* o produto novo ja entra na carga; o fornecedor novo ja fica selecionado */}
      <FormProduto
        aberto={novoProduto}
        nomeInicial={busca.trim()}
        semEstoqueInicial
        onFechar={() => setNovoProduto(false)}
        onSalvo={(p) => adicionar(p)}
      />
      <FormFornecedor
        aberto={novoFornecedor}
        onFechar={() => setNovoFornecedor(false)}
        onSalvo={(f) => setFornecedorId(f.id)}
      />
    </>
  );
}

function Cab({
  children,
  alinha = "left",
}: {
  children?: React.ReactNode;
  alinha?: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-borda2 bg-superficie2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-suave ${
        alinha === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Cel({
  children,
  alinha = "left",
  className = "",
}: {
  children?: React.ReactNode;
  alinha?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`border-b border-borda px-4 py-2.5 align-middle text-tinta2 ${
        alinha === "right" ? "tabular text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
