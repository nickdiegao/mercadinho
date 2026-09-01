"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Pencil, X } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { margem, markup } from "@/lib/regras";
import { moeda, numero, custoCurto, moeda4 } from "@/lib/formato";
import { Lista, type ColunaLista } from "@/components/lista";
import type { Produto } from "@/lib/tipos";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Cartao,
  Entrada,
  Etiqueta,
  Selecao,
  TituloCartao,
} from "@/components/ui";

/** centavos <-> texto "4,50" */
const paraTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const paraCentavos = (t: string) =>
  Math.round((parseFloat(t.replace(",", ".")) || 0) * 100);

export default function Produtos() {
  const { estado, salvarProduto } = useEstado();
  const { podeVerCusto, ehAdmin } = usePerfil();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [editando, setEditando] = useState<Produto | null>(null);

  const catPorId = useMemo(
    () => new Map(estado.categorias.map((c) => [c.id, c.nome])),
    [estado.categorias],
  );

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return estado.produtos
      .filter((p) => p.tipo === "NORMAL")
      .filter((p) => (categoria ? p.categoriaId === categoria : true))
      .filter(
        (p) =>
          !t ||
          p.nome.toLowerCase().includes(t) ||
          p.sku.toLowerCase().includes(t) ||
          p.codigoBarras.includes(t),
      );
  }, [estado.produtos, busca, categoria]);

  const colunas: ColunaLista<Produto>[] = [
    {
      chave: "nome",
      titulo: "Produto",
      papel: "titulo",
      render: (p) => (
        <span className="block max-w-[260px] truncate">{p.nome}</span>
      ),
    },
    {
      chave: "categoria",
      titulo: "Categoria",
      papel: "apoio",
      render: (p) => (
        <span className="flex items-center gap-1.5">
          {catPorId.get(p.categoriaId)}
          <span className="mono">{p.sku}</span>
          {p.vasilhameId && <Etiqueta tom="casco">casco</Etiqueta>}
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
            render: (p: Produto) => <>{custoCurto(p.custoMedio)}</>,
          },
        ]
      : []),
    {
      chave: "varejo",
      titulo: "Varejo",
      alinha: "right",
      papel: "destaque",
      render: (p) => (
        <span className="font-semibold text-tinta">{moeda(p.precoVarejo)}</span>
      ),
    },
    {
      chave: "atacado",
      titulo: "Atacado",
      alinha: "right",
      render: (p) => (
        <span className="font-semibold text-marca">{moeda(p.precoAtacado)}</span>
      ),
    },
    ...(podeVerCusto
      ? [
          {
            chave: "margem",
            titulo: "Margem",
            alinha: "right" as const,
            render: (p: Produto) => (
              <>
                <span className="text-positivo">
                  {(margem(p.precoVarejo, p.custoMedio) * 100).toFixed(1)}%
                </span>
                <span className="text-suave">
                  {" / "}
                  {(margem(p.precoAtacado, p.custoMedio) * 100).toFixed(1)}%
                </span>
              </>
            ),
          },
        ]
      : []),
    {
      chave: "saldo",
      titulo: "Saldo",
      alinha: "right",
      render: (p) => (
        <span
          className={p.saldoAtual <= p.estoqueMinimo ? "font-semibold text-alerta" : ""}
        >
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
              <Info rotulo="Custo médio" valor={moeda4(p.custoMedio)} />
              <Info
                rotulo="Custo da última compra"
                valor={custoCurto(p.custoUltimaCompra)}
              />
              <Info
                rotulo="Markup varejo"
                valor={`${(markup(p.precoVarejo, p.custoMedio) * 100).toFixed(1)}%`}
              />
              <Info
                rotulo="Markup atacado"
                valor={`${(markup(p.precoAtacado, p.custoMedio) * 100).toFixed(1)}%`}
              />
            </>
          )}
          <Info
            rotulo="Atacado a partir de"
            valor={`${numero(p.qtdMinimaAtacado)} un`}
          />
          <Info rotulo="Estoque mínimo" valor={`${numero(p.estoqueMinimo)} un`} />
          <Info rotulo="NCM" valor={p.ncm} />
          <Info
            rotulo="Código de barras"
            valor={p.codigoBarras || "—"}
          />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-borda pt-3">
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
                setEditando(p);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
            >
              <Pencil size={13} /> Editar preços
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
        descricao="Toque num produto para ver custo, margem e markup. Quatro valores por produto: custo, custo por unidade, varejo e atacado."
      />

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
        <Entrada
          placeholder="Buscar por nome, SKU ou código de barras…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {estado.categorias
            .filter((c) => c.id !== "c_vasilhame")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Selecao>
      </div>

      {editando && (
        <EditorProduto
          produto={editando}
          podeVerCusto={podeVerCusto}
          podeEditarPreco={ehAdmin}
          onFechar={() => setEditando(null)}
          onSalvar={(p) => {
            salvarProduto(p);
            setEditando(null);
          }}
        />
      )}

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
            vender — mas não vê custo nem margem. É a permissão que dono de
            distribuidora mais pede.
          </Aviso>
        </div>
      )}
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

// ---------------------------------------------------------------- editor
function EditorProduto({
  produto,
  podeVerCusto,
  podeEditarPreco,
  onFechar,
  onSalvar,
}: {
  produto: Produto;
  podeVerCusto: boolean;
  podeEditarPreco: boolean;
  onFechar: () => void;
  onSalvar: (p: Produto) => void;
}) {
  const [nome, setNome] = useState(produto.nome);
  const [varejo, setVarejo] = useState(paraTexto(produto.precoVarejo));
  const [atacado, setAtacado] = useState(paraTexto(produto.precoAtacado));
  const [minAtacado, setMinAtacado] = useState(String(produto.qtdMinimaAtacado));
  const [estoqueMinimo, setEstoqueMinimo] = useState(String(produto.estoqueMinimo));

  const pv = paraCentavos(varejo);
  const pa = paraCentavos(atacado);

  return (
    <Cartao className="mb-4 border-marca/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <TituloCartao>Editar produto</TituloCartao>
        <button
          onClick={onFechar}
          className="transicao -mt-1 rounded p-1 text-suave hover:bg-superficie2 hover:text-tinta"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo rotulo="Nome" className="sm:col-span-2 lg:col-span-3">
          <Entrada value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>

        <Campo
          rotulo="Preço de varejo (R$)"
          dica={
            podeVerCusto
              ? `margem ${(margem(pv, produto.custoMedio) * 100).toFixed(1)}% · markup ${(markup(pv, produto.custoMedio) * 100).toFixed(1)}%`
              : undefined
          }
        >
          <Entrada
            inputMode="decimal"
            value={varejo}
            onChange={(e) => setVarejo(e.target.value)}
            disabled={!podeEditarPreco}
          />
        </Campo>

        <Campo
          rotulo="Preço de atacado (R$)"
          dica={
            podeVerCusto
              ? `margem ${(margem(pa, produto.custoMedio) * 100).toFixed(1)}% · markup ${(markup(pa, produto.custoMedio) * 100).toFixed(1)}%`
              : undefined
          }
        >
          <Entrada
            inputMode="decimal"
            value={atacado}
            onChange={(e) => setAtacado(e.target.value)}
            disabled={!podeEditarPreco}
          />
        </Campo>

        <Campo
          rotulo="Atacado a partir de (un)"
          dica={`1 ${produto.unidadeCompra} = ${produto.fatorConversao} un`}
        >
          <Entrada
            inputMode="numeric"
            value={minAtacado}
            onChange={(e) => setMinAtacado(e.target.value)}
          />
        </Campo>

        <Campo rotulo="Estoque mínimo (un)">
          <Entrada
            inputMode="numeric"
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
          />
        </Campo>

        {podeVerCusto && (
          <div className="rounded-md border border-borda bg-superficie2/60 px-3 py-2.5 sm:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-suave">
              Custo médio ponderado
            </p>
            <p className="tabular mt-1 text-lg font-semibold text-tinta">
              {custoCurto(produto.custoMedio)}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-suave">
              Não é editável aqui de propósito: o custo médio só muda quando
              entra mercadoria nova. Editar custo à mão é o que faz o relatório
              de lucro parar de fechar.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Botao
          variante="primario"
          onClick={() =>
            onSalvar({
              ...produto,
              nome,
              precoVarejo: pv,
              precoAtacado: pa,
              qtdMinimaAtacado: Number(minAtacado) || 0,
              estoqueMinimo: Number(estoqueMinimo) || 0,
            })
          }
        >
          Salvar
        </Botao>
        <Botao onClick={onFechar}>Cancelar</Botao>
      </div>
    </Cartao>
  );
}
