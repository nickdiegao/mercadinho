"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Pencil, Plus, Snowflake } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import {
  aguardandoEntrada,
  margem,
  markup,
  podeGelar,
  precisaRepor,
  precoCaixa,
  semCusto,
} from "@/lib/regras";
import { moeda, numero, custoCurto, moeda4 } from "@/lib/formato";
import { Lista, type ColunaLista } from "@/components/lista";
import { FormProduto } from "@/components/form-produto";
import { ImportarPlanilha } from "@/components/importar-planilha";
import type { Produto } from "@/lib/tipos";
import {
  Aviso,
  Botao,
  Cabecalho,
  Entrada,
  Etiqueta,
  Selecao,
} from "@/components/ui";

/** A caixa so existe com embalagem e com preco da unidade. */
const temCaixa = (p: Produto) => p.fatorConversao > 1 && p.precoVarejo > 0;

export default function Produtos() {
  const { estado } = useEstado();
  const { podeVerCusto, ehAdmin, podeCadastrarProduto } = usePerfil();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [form, setForm] = useState<{ produto: Produto | null } | null>(null);

  // a digitacao responde na hora; a lista acompanha logo depois
  const buscaAdiada = useDeferredValue(busca);

  const catPorId = useMemo(
    () => new Map(estado.categorias.map((c) => [c.id, c.nome])),
    [estado.categorias],
  );

  const lista = useMemo(() => {
    const t = buscaAdiada.trim().toLowerCase();
    return estado.produtos
      .filter((p) => p.tipo === "NORMAL")
      .filter((p) => (categoria === "gelado" ? podeGelar(p) : categoria ? p.categoriaId === categoria : true))
      .filter(
        (p) =>
          !t ||
          p.nome.toLowerCase().includes(t) ||
          p.sku.toLowerCase().includes(t) ||
          p.codigoBarras.includes(t),
      );
  }, [estado.produtos, buscaAdiada, categoria]);

  const pendentes = estado.produtos.filter(
    (p) => p.tipo === "NORMAL" && p.ativo && (p.precoVarejo <= 0 || semCusto(p)),
  );

  const colunas: ColunaLista<Produto>[] = [
    {
      chave: "nome",
      titulo: "Produto",
      papel: "titulo",
      render: (p) => <span className="block max-w-[260px] truncate">{p.nome}</span>,
    },
    {
      chave: "categoria",
      titulo: "Categoria",
      papel: "apoio",
      render: (p) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {catPorId.get(p.categoriaId)}
          <span className="mono">{p.sku}</span>
          {p.vasilhameId && <Etiqueta tom="casco">casco</Etiqueta>}
          {p.precoVarejo <= 0 && <Etiqueta tom="alerta">sem preço</Etiqueta>}
          {aguardandoEntrada(p) && <Etiqueta>aguarda 1ª entrada</Etiqueta>}
          {podeVerCusto && semCusto(p) && (
            <Etiqueta tom="negativo">sem custo</Etiqueta>
          )}
        </span>
      ),
    },
    {
      chave: "embalagem",
      titulo: "Embalagem",
      alinha: "right",
      render: (p) => (
        <span className="text-suave">
          {p.unidadeCompra} c/ {p.fatorConversao}
        </span>
      ),
    },
    ...(podeVerCusto
      ? [
          {
            chave: "custo",
            titulo: "Custo médio",
            alinha: "right" as const,
            render: (p: Produto) =>
              p.custoMedio > 0 ? <>{custoCurto(p.custoMedio)}</> : <span className="text-suave">—</span>,
          },
        ]
      : []),
    {
      chave: "unidade",
      titulo: "Unidade",
      alinha: "right",
      papel: "destaque",
      render: (p) =>
        p.precoVarejo > 0 ? (
          <span className="font-semibold text-tinta">{moeda(p.precoVarejo)}</span>
        ) : (
          <span className="text-suave">—</span>
        ),
    },
    {
      chave: "caixa",
      titulo: "Caixa",
      alinha: "right",
      render: (p) =>
        temCaixa(p) ? (
          <span
            className="font-semibold text-marca"
            title={p.descontoCaixa > 0 ? `${moeda(p.descontoCaixa)} de desconto` : "sem desconto"}
          >
            {moeda(precoCaixa(p))}
          </span>
        ) : (
          <span className="text-suave">—</span>
        ),
    },
    {
      chave: "gelado",
      titulo: "Gelado",
      alinha: "right",
      render: (p) =>
        podeGelar(p) ? (
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              p.precoGelado! <= p.precoVarejo ? "text-alerta" : "text-tinta2"
            }`}
            title={
              p.precoGelado! <= p.precoVarejo
                ? "Gelado igual ou mais barato que o natural"
                : undefined
            }
          >
            {p.precoGelado! <= p.precoVarejo ? (
              <AlertTriangle size={12} />
            ) : (
              <Snowflake size={12} className="text-marca" />
            )}
            {moeda(p.precoGelado!)}
          </span>
        ) : (
          <span className="text-suave">—</span>
        ),
    },
    ...(podeVerCusto
      ? [
          {
            chave: "margem",
            titulo: "Margem",
            alinha: "right" as const,
            render: (p: Produto) =>
              p.custoMedio > 0 && p.precoVarejo > 0 ? (
                <>
                  <span className="text-positivo">
                    {(margem(p.precoVarejo, p.custoMedio) * 100).toFixed(1)}%
                  </span>
                  {temCaixa(p) && (
                    <span className="text-suave" title="Margem na caixa">
                      {" / "}
                      {(margem(precoCaixa(p) / p.fatorConversao, p.custoMedio) * 100).toFixed(1)}%
                    </span>
                  )}
                </>
              ) : (
                <span className="text-suave">—</span>
              ),
          },
        ]
      : []),
    {
      chave: "saldo",
      titulo: "Saldo",
      alinha: "right",
      render: (p) => (
        <span className={precisaRepor(p) ? "font-semibold text-alerta" : ""}>
          {numero(p.saldoAtual)}
        </span>
      ),
    },
  ];

  function detalhe(p: Produto) {
    return (
      <div>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
          {podeVerCusto && (
            <>
              <Info
                rotulo="Custo médio"
                valor={p.custoMedio > 0 ? moeda4(p.custoMedio) : "sem custo ainda"}
              />
              <Info
                rotulo="Custo da última compra"
                valor={p.custoUltimaCompra > 0 ? custoCurto(p.custoUltimaCompra) : "—"}
              />
              <Info
                rotulo="Markup unidade"
                valor={
                  p.custoMedio > 0
                    ? `${(markup(p.precoVarejo, p.custoMedio) * 100).toFixed(1)}%`
                    : "—"
                }
              />
              <Info
                rotulo={podeGelar(p) ? "Margem gelado" : "Markup caixa"}
                valor={
                  p.custoMedio <= 0
                    ? "—"
                    : podeGelar(p)
                      ? `${(margem(p.precoGelado!, p.custoMedio) * 100).toFixed(1)}%`
                      : temCaixa(p)
                        ? `${(markup(precoCaixa(p) / p.fatorConversao, p.custoMedio) * 100).toFixed(1)}%`
                        : "—"
                }
              />
            </>
          )}
          {temCaixa(p) && (
            <Info
              rotulo="Desconto da caixa"
              valor={p.descontoCaixa > 0 ? moeda(p.descontoCaixa) : "sem desconto"}
            />
          )}
          {podeGelar(p) && p.fatorConversao > 1 && (
            <Info rotulo="Caixa gelada" valor={moeda(precoCaixa(p, true))} />
          )}
          <Info rotulo="Estoque mínimo" valor={`${numero(p.estoqueMinimo)} un`} />
          <Info rotulo="NCM" valor={p.ncm || "—"} />
          <Info rotulo="Código de barras" valor={p.codigoBarras || "—"} />
        </dl>

        {p.precoVarejo <= 0 && (
          <p className="mt-3 rounded-md bg-alerta-claro px-3 py-2 text-[12.5px] text-alerta">
            Produto sem preço de venda: não aparece para vender até a
            administradora definir o preço.
          </p>
        )}
        {aguardandoEntrada(p) && (
          <p className="mt-3 rounded-md bg-superficie2 px-3 py-2 text-[12.5px] text-tinta2">
            Aguardando a primeira entrada. Não é erro: o saldo e o custo nascem
            quando a mercadoria chegar, em Entradas → Nova entrada.
          </p>
        )}
        {podeVerCusto && semCusto(p) && (
          <p className="mt-3 rounded-md bg-negativo-claro px-3 py-2 text-[12.5px] text-negativo">
            Tem saldo, mas sem custo: lance uma entrada deste produto, senão o
            lucro das vendas dele aparece inflado.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-borda pt-3">
          <Link
            href={`/estoque/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
          >
            <ExternalLink size={13} /> Ver extrato de movimentações
          </Link>
          {ehAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setForm({ produto: p });
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
            >
              <Pencil size={13} /> Editar produto e preços
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Produtos"
        descricao="Toque num produto para ver custo, margem e markup. Cada produto tem o preço da unidade, o da caixa e, se gelar, os dois gelados."
        acoes={
          <>
            <ImportarPlanilha />
            {podeCadastrarProduto && (
              <Botao
                variante="primario"
                onClick={() => setForm({ produto: null })}
                className="w-full sm:w-auto"
              >
                <Plus size={15} /> Novo produto
              </Botao>
            )}
          </>
        }
      />

      {pendentes.length > 0 && ehAdmin && (
        <div className="mb-4">
          <Aviso tom="alerta" titulo={`${pendentes.length} produto${pendentes.length === 1 ? "" : "s"} com cadastro incompleto`}>
            Sem preço de venda, ou com saldo e sem custo. Produto sem preço não
            pode ser vendido; com saldo e sem custo, o lucro das vendas dele
            aparece inflado.
          </Aviso>
        </div>
      )}

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
        <Entrada
          placeholder="Buscar por nome, SKU ou código de barras…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          <option value="gelado">Só os que vendem gelado</option>
          {estado.categorias
            .filter((c) => c.id !== "c_vasilhame")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Selecao>
      </div>

      <Lista
        colunas={colunas}
        linhas={lista}
        chave={(p) => p.id}
        detalhe={detalhe}
        vazio="Nenhum produto encontrado."
      />

      {!podeVerCusto && (
        <div className="mt-4">
          <Aviso titulo="Custo e margem ficam ocultos neste perfil">
            O operador de caixa vê o preço de venda, porque precisa dele para
            vender — mas não vê custo nem margem.
          </Aviso>
        </div>
      )}

      <FormProduto
        aberto={form !== null}
        produto={form?.produto}
        onFechar={() => setForm(null)}
      />
    </>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-suave">
        {rotulo}
      </dt>
      <dd className="tabular truncate text-[13px] text-tinta2">{valor}</dd>
    </div>
  );
}
