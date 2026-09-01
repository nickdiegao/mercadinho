"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Beer } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { estoqueValorizado } from "@/lib/regras";
import { moeda, numero, custoCurto } from "@/lib/formato";
import {
  Cabecalho,
  Cartao,
  Entrada,
  Etiqueta,
  Indicador,
  Rolagem,
  Selecao,
  Tabela,
  Td,
  Th,
  TituloCartao,
  Vazio,
} from "@/components/ui";

export default function Estoque() {
  const { estado } = useEstado();
  const { podeVerCusto } = usePerfil();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");

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
    const t = busca.trim().toLowerCase();
    return normais
      .filter((p) => {
        if (filtro === "baixo" && p.saldoAtual > p.estoqueMinimo) return false;
        if (filtro && filtro !== "baixo" && p.categoriaId !== filtro) return false;
        if (!t) return true;
        return p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t);
      })
      .sort((a, b) => a.saldoAtual / (a.estoqueMinimo || 1) - b.saldoAtual / (b.estoqueMinimo || 1));
  }, [normais, busca, filtro]);

  const abaixo = normais.filter((p) => p.saldoAtual <= p.estoqueMinimo);

  return (
    <>
      <Cabecalho
        titulo="Estoque"
        descricao="Saldo em unidade base. Clique num produto para ver o extrato completo de movimentações."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {podeVerCusto && (
          <Indicador
            rotulo="Estoque a custo"
            valor={moeda(estoqueValorizado(normais))}
            detalhe="saldo × custo médio de cada produto"
          />
        )}
        <Indicador
          rotulo="Unidades"
          valor={numero(normais.reduce((a, p) => a + p.saldoAtual, 0))}
          detalhe={`em ${normais.length} produtos ativos`}
        />
        <Indicador
          rotulo="Abaixo do mínimo"
          valor={String(abaixo.length)}
          detalhe="produtos que precisam de reposição"
          tom={abaixo.length ? "alerta" : "neutro"}
        />
        <Indicador
          rotulo="Cascos na rua"
          valor={numero(cascos.reduce((a, p) => a + p.saldoAtual, 0))}
          detalhe="garrafas retornáveis com clientes"
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

      <Rolagem>
        <Tabela>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Categoria</Th>
              <Th alinha="right">Saldo</Th>
              <Th alinha="right">Em {"caixas"}</Th>
              <Th alinha="right">Mínimo</Th>
              {podeVerCusto && <Th alinha="right">Custo médio</Th>}
              {podeVerCusto && <Th alinha="right">Valor</Th>}
              <Th />
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const baixo = p.saldoAtual <= p.estoqueMinimo;
              return (
                <tr key={p.id} className="transicao hover:bg-superficie2/60">
                  <Td className="max-w-[280px]">
                    <Link
                      href={`/estoque/${p.id}`}
                      className="font-medium text-tinta hover:text-marca hover:underline"
                    >
                      {p.nome}
                    </Link>
                    <span className="mono ml-2 text-[11px] text-suave">{p.sku}</span>
                  </Td>
                  <Td className="text-suave">{catPorId.get(p.categoriaId)}</Td>
                  <Td
                    alinha="right"
                    className={baixo ? "font-semibold text-alerta" : "font-semibold text-tinta"}
                  >
                    {numero(p.saldoAtual)}
                  </Td>
                  <Td alinha="right" className="text-suave">
                    {numero(Math.floor(p.saldoAtual / p.fatorConversao))} {p.unidadeCompra}
                  </Td>
                  <Td alinha="right" className="text-suave">
                    {numero(p.estoqueMinimo)}
                  </Td>
                  {podeVerCusto && (
                    <Td alinha="right">{custoCurto(p.custoMedio)}</Td>
                  )}
                  {podeVerCusto && (
                    <Td alinha="right" className="font-medium">
                      {moeda(Math.round((p.saldoAtual * p.custoMedio) / 100))}
                    </Td>
                  )}
                  <Td>
                    {baixo && (
                      <Etiqueta tom="alerta">
                        <AlertTriangle size={11} className="mr-1" /> repor
                      </Etiqueta>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
        {lista.length === 0 && <Vazio>Nenhum produto com esses filtros.</Vazio>}
      </Rolagem>

      <Cartao className="mt-6" padding={false}>
        <div className="p-5 pb-3">
          <TituloCartao
            extra={
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-casco">
                <Beer size={13} /> retornável
              </span>
            }
          >
            Vasilhame
          </TituloCartao>
          <p className="-mt-2 mb-1 text-[13px] text-suave">
            Para casco, o saldo conta o que está <b>na rua</b> — em poder do
            cliente — e não o que está no depósito. Cada garrafa vendida sai
            junto com o produto e volta na devolução.
          </p>
        </div>
        <Rolagem>
          <Tabela>
            <thead>
              <tr>
                <Th>Casco</Th>
                <Th alinha="right">Na rua</Th>
                <Th alinha="right">Equivale a</Th>
                {podeVerCusto && <Th alinha="right">Valor parado</Th>}
              </tr>
            </thead>
            <tbody>
              {cascos.map((v) => (
                <tr key={v.id} className="transicao hover:bg-superficie2/60">
                  <Td className="font-medium text-tinta">
                    <Link href={`/estoque/${v.id}`} className="hover:text-marca hover:underline">
                      {v.nome}
                    </Link>
                  </Td>
                  <Td alinha="right" className="font-semibold text-casco">
                    {numero(v.saldoAtual)}
                  </Td>
                  <Td alinha="right" className="text-suave">
                    {numero(Math.floor(v.saldoAtual / 24))} engradados
                  </Td>
                  {podeVerCusto && (
                    <Td alinha="right">
                      {moeda(Math.round((v.saldoAtual * v.custoMedio) / 100))}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Rolagem>
      </Cartao>
    </>
  );
}
