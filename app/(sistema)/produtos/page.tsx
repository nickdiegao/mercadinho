"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { margem, markup } from "@/lib/regras";
import { moeda, numero, custoCurto } from "@/lib/formato";
import type { Produto } from "@/lib/tipos";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Cartao,
  Entrada,
  Etiqueta,
  Rolagem,
  Selecao,
  Tabela,
  Td,
  Th,
  TituloCartao,
  Vazio,
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

  return (
    <>
      <Cabecalho
        titulo="Produtos"
        descricao="Quatro valores por produto: custo de compra, custo por unidade, preço de varejo e preço de atacado."
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

      <Rolagem>
        <Tabela>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Categoria</Th>
              <Th alinha="right">Embalagem</Th>
              {podeVerCusto && <Th alinha="right">Custo médio</Th>}
              <Th alinha="right">Varejo</Th>
              <Th alinha="right">Atacado</Th>
              {podeVerCusto && <Th alinha="right">Margem</Th>}
              <Th alinha="right">Saldo</Th>
              {ehAdmin && <Th />}
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="transicao hover:bg-superficie2/60">
                <Td className="max-w-[260px]">
                  <Link
                    href={`/estoque/${p.id}`}
                    className="font-medium text-tinta hover:text-marca hover:underline"
                  >
                    {p.nome}
                  </Link>
                  <span className="mono ml-2 text-[11px] text-suave">{p.sku}</span>
                  {p.vasilhameId && (
                    <Etiqueta tom="casco">
                      <span className="ml-0">casco</span>
                    </Etiqueta>
                  )}
                </Td>
                <Td className="text-suave">{catPorId.get(p.categoriaId)}</Td>
                <Td alinha="right" className="text-suave">
                  {p.unidadeCompra} c/ {p.fatorConversao}
                </Td>
                {podeVerCusto && <Td alinha="right">{custoCurto(p.custoMedio)}</Td>}
                <Td alinha="right" className="font-semibold text-tinta">
                  {moeda(p.precoVarejo)}
                </Td>
                <Td alinha="right" className="font-semibold text-marca">
                  {moeda(p.precoAtacado)}
                </Td>
                {podeVerCusto && (
                  <Td alinha="right" className="text-positivo">
                    {(margem(p.precoVarejo, p.custoMedio) * 100).toFixed(1)}%
                    <span className="text-suave">
                      {" / "}
                      {(margem(p.precoAtacado, p.custoMedio) * 100).toFixed(1)}%
                    </span>
                  </Td>
                )}
                <Td
                  alinha="right"
                  className={p.saldoAtual <= p.estoqueMinimo ? "font-semibold text-alerta" : ""}
                >
                  {numero(p.saldoAtual)}
                </Td>
                {ehAdmin && (
                  <Td>
                    <button
                      onClick={() => setEditando(p)}
                      className="transicao rounded p-1.5 text-suave hover:bg-marca-clara hover:text-marca"
                      aria-label={`Editar ${p.nome}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabela>
        {lista.length === 0 && <Vazio>Nenhum produto encontrado.</Vazio>}
      </Rolagem>

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

      <div className="grid gap-3 lg:grid-cols-3">
        <Campo rotulo="Nome" className="lg:col-span-3">
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
          <div className="rounded-md border border-borda bg-superficie2/60 px-3 py-2.5 lg:col-span-2">
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

      <div className="mt-4 flex gap-2">
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
