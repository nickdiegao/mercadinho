"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Beer, Plus } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { estoqueValorizado } from "@/lib/regras";
import { moeda, numero, custoCurto } from "@/lib/formato";
import { Lista, type ColunaLista } from "@/components/lista";
import type { Produto } from "@/lib/tipos";
import { FormProduto } from "@/components/form-produto";
import {
  Botao,
  Cabecalho,
  Entrada,
  Etiqueta,
  Indicador,
  Selecao,
  TituloCartao,
} from "@/components/ui";

export default function Estoque() {
  const { estado } = useEstado();
  const { podeVerCusto, podeCadastrarProduto, podeEstoque } = usePerfil();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const buscaAdiada = useDeferredValue(busca);

  const normais = useMemo(
    () => estado.produtos.filter((p) => p.tipo === "NORMAL" && p.ativo),
    [estado.produtos],
  );
  const cascos = useMemo(
    () => estado.produtos.filter((p) => p.tipo === "VASILHAME"),
    [estado.produtos],
  );
  const catPorId = useMemo(
    () => new Map(estado.categorias.map((c) => [c.id, c.nome])),
    [estado.categorias],
  );

  const lista = useMemo(() => {
    const t = buscaAdiada.trim().toLowerCase();
    return normais
      .filter((p) => {
        if (filtro === "baixo" && p.saldoAtual > p.estoqueMinimo) return false;
        if (filtro && filtro !== "baixo" && p.categoriaId !== filtro) return false;
        if (!t) return true;
        return (
          p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)
        );
      })
      .sort(
        (a, b) =>
          a.saldoAtual / (a.estoqueMinimo || 1) -
          b.saldoAtual / (b.estoqueMinimo || 1),
      );
  }, [normais, buscaAdiada, filtro]);

  const abaixo = normais.filter((p) => p.saldoAtual <= p.estoqueMinimo);

  const colunas: ColunaLista<Produto>[] = [
    {
      chave: "nome",
      titulo: "Produto",
      papel: "titulo",
      render: (p) => (
        <Link
          href={`/estoque/${p.id}`}
          className="block max-w-[280px] truncate text-tinta hover:text-marca hover:underline"
        >
          {p.nome}
        </Link>
      ),
    },
    {
      chave: "categoria",
      titulo: "Categoria",
      papel: "apoio",
      render: (p) => (
        <span className="flex items-center gap-1.5 text-suave">
          {catPorId.get(p.categoriaId)}
          {podeVerCusto && p.custoMedio <= 0 && (
            <Etiqueta tom="negativo">sem custo</Etiqueta>
          )}
          {p.saldoAtual <= p.estoqueMinimo && (
            <Etiqueta tom="alerta">
              <AlertTriangle size={10} className="mr-1" /> repor
            </Etiqueta>
          )}
        </span>
      ),
    },
    {
      chave: "saldo",
      titulo: "Saldo",
      alinha: "right",
      papel: "destaque",
      render: (p) => (
        <span
          className={
            p.saldoAtual <= p.estoqueMinimo
              ? "font-semibold text-alerta"
              : "font-semibold text-tinta"
          }
        >
          {numero(p.saldoAtual)}
          <span className="text-[11px] font-normal text-suave"> un</span>
        </span>
      ),
    },
    {
      chave: "caixas",
      titulo: "Em caixas",
      alinha: "right",
      render: (p) => (
        <span className="text-suave">
          {numero(Math.floor(p.saldoAtual / p.fatorConversao))} {p.unidadeCompra}
        </span>
      ),
    },
    {
      chave: "minimo",
      titulo: "Mínimo",
      alinha: "right",
      render: (p) => <span className="text-suave">{numero(p.estoqueMinimo)}</span>,
    },
    ...(podeVerCusto
      ? [
          {
            chave: "custo",
            titulo: "Custo médio",
            alinha: "right" as const,
            render: (p: Produto) => <>{custoCurto(p.custoMedio)}</>,
          },
          {
            chave: "valor",
            titulo: "Valor",
            alinha: "right" as const,
            render: (p: Produto) => (
              <span className="font-medium">
                {moeda(Math.round((p.saldoAtual * p.custoMedio) / 100))}
              </span>
            ),
          },
        ]
      : []),
  ];

  const colunasCasco: ColunaLista<Produto>[] = [
    {
      chave: "nome",
      titulo: "Casco",
      papel: "titulo",
      render: (v) => (
        <Link
          href={`/estoque/${v.id}`}
          className="text-tinta hover:text-marca hover:underline"
        >
          {v.nome}
        </Link>
      ),
    },
    {
      chave: "rua",
      titulo: "Na rua",
      alinha: "right",
      papel: "destaque",
      render: (v) => (
        <span className="font-semibold text-casco">{numero(v.saldoAtual)}</span>
      ),
    },
    {
      chave: "engradados",
      titulo: "Equivale a",
      alinha: "right",
      render: (v) => (
        <span className="text-suave">
          {numero(Math.floor(v.saldoAtual / 24))} engradados
        </span>
      ),
    },
    ...(podeVerCusto
      ? [
          {
            chave: "valor",
            titulo: "Valor parado",
            alinha: "right" as const,
            render: (v: Produto) => (
              <>{moeda(Math.round((v.saldoAtual * v.custoMedio) / 100))}</>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Cabecalho
        titulo="Estoque"
        descricao="Saldo em unidade base. Toque num produto para ver o extrato completo de movimentações."
        acoes={
          (podeCadastrarProduto || podeEstoque) && (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              {podeCadastrarProduto && (
                <Botao onClick={() => setNovoAberto(true)}>
                  <Plus size={15} /> Novo produto
                </Botao>
              )}
              {podeEstoque && (
                <Link href="/entradas/nova" className="contents">
                  <Botao variante="primario" className="w-full">
                    <ArrowDownToLine size={15} /> Dar entrada
                  </Botao>
                </Link>
              )}
            </div>
          )
        }
      />
      <p className="nao-imprime -mt-2 mb-4 text-[12.5px] leading-relaxed text-suave">
        <b className="text-tinta2">Novo produto</b> cadastra um item que ainda
        não existe no sistema. <b className="text-tinta2">Dar entrada</b> registra
        a mercadoria que chegou — é o que aumenta o saldo e define o custo.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {podeVerCusto && (
          <Indicador
            rotulo="Estoque a custo"
            valor={moeda(estoqueValorizado(normais))}
            detalhe="saldo × custo médio"
          />
        )}
        <Indicador
          rotulo="Unidades"
          valor={numero(normais.reduce((a, p) => a + p.saldoAtual, 0))}
          detalhe={`em ${normais.length} produtos`}
        />
        <Indicador
          rotulo="Abaixo do mínimo"
          valor={String(abaixo.length)}
          detalhe="precisam de reposição"
          tom={abaixo.length ? "alerta" : "neutro"}
        />
        <Indicador
          rotulo="Cascos na rua"
          valor={numero(cascos.reduce((a, p) => a + p.saldoAtual, 0))}
          detalhe="com clientes"
          tom="casco"
        />
      </div>

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
        <Entrada
          placeholder="Buscar produto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todas as categorias</option>
          <option value="baixo">Só abaixo do mínimo</option>
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
        vazio="Nenhum produto com esses filtros."
      />

      <div className="mt-8">
        <div className="mb-3">
          <TituloCartao
            extra={
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-casco">
                <Beer size={13} /> retornável
              </span>
            }
          >
            Vasilhame
          </TituloCartao>
          <p className="-mt-2 text-[13px] leading-relaxed text-suave">
            Para casco, o saldo conta o que está <b>na rua</b> — em poder do
            cliente — e não o que está no depósito.
          </p>
        </div>
        <Lista
          colunas={colunasCasco}
          linhas={cascos}
          chave={(v) => v.id}
          vazio="Nenhum vasilhame cadastrado."
        />
      </div>
      <FormProduto aberto={novoAberto} onFechar={() => setNovoAberto(false)} />
    </>
  );
}
