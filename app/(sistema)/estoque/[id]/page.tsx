"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { extrato } from "@/lib/consultas";
import { moeda, numero, custoCurto, moeda4, dataHora } from "@/lib/formato";
import { margem, precisaRepor } from "@/lib/regras";
import type { Estado, TipoMovimento } from "@/lib/tipos";
import {
  Aviso,
  Botao,
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

const ROTULO: Record<TipoMovimento, { texto: string; tom: "positivo" | "negativo" | "neutro" | "alerta" | "casco" }> = {
  ENTRADA: { texto: "Entrada", tom: "positivo" },
  SAIDA: { texto: "Saída", tom: "negativo" },
  AJUSTE: { texto: "Ajuste", tom: "neutro" },
  PERDA: { texto: "Perda", tom: "alerta" },
  DEVOLUCAO: { texto: "Devolução", tom: "casco" },
  INVENTARIO_INICIAL: { texto: "Inventário", tom: "neutro" },
};

/** Numero da venda formatado, para o extrato nao mostrar so "Venda". */
function numeroVenda(estado: Estado, vendaId: string) {
  const v = estado.vendas.find((x) => x.id === vendaId);
  return v ? String(v.numero).padStart(5, "0") : "";
}

export default function Kardex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { estado, ajustarEstoque } = useEstado();
  const { podeVerCusto, podeEstoque } = usePerfil();

  const [ajustando, setAjustando] = useState(false);
  const [novaQtd, setNovaQtd] = useState("");
  const [tipo, setTipo] = useState<TipoMovimento>("AJUSTE");
  const [motivo, setMotivo] = useState("");

  const produto = estado.produtos.find((p) => p.id === id);
  const movs = useMemo(
    () => (produto ? extrato(estado, produto.id) : []),
    [estado, produto],
  );

  if (!produto) {
    return (
      <Aviso tom="alerta" titulo="Produto não encontrado">
        <Link href="/estoque" className="font-semibold text-marca hover:underline">
          Voltar para o estoque
        </Link>
      </Aviso>
    );
  }

  const casco = produto.tipo === "VASILHAME";

  async function salvarAjuste() {
    const q = parseFloat(novaQtd.replace(",", "."));
    if (Number.isNaN(q) || !motivo.trim()) return;
    try {
      await ajustarEstoque(produto!.id, q, tipo, motivo.trim());
      setAjustando(false);
      setNovaQtd("");
      setMotivo("");
    } catch {
      /* o motivo ja apareceu no aviso; o ajuste continua aberto */
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/estoque"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-marca"
          >
            <ArrowLeft size={15} /> Estoque
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">
            {produto.nome}
          </h1>
          <p className="mono mt-1 text-[12px] text-suave">
            {produto.sku}
            {produto.codigoBarras && ` · ${produto.codigoBarras}`}
            {!casco && ` · 1 ${produto.unidadeCompra} = ${produto.fatorConversao} un`}
          </p>
        </div>
        {podeEstoque && (
          <Botao onClick={() => setAjustando((a) => !a)}>
            <SlidersHorizontal size={15} /> Ajustar saldo
          </Botao>
        )}
      </div>

      {ajustando && (
        <Cartao className="mb-4">
          <TituloCartao>Ajuste de saldo</TituloCartao>
          <div className="grid gap-3 sm:grid-cols-[140px_180px_1fr_auto] sm:items-end">
            <Campo rotulo="Saldo contado">
              <Entrada
                inputMode="decimal"
                value={novaQtd}
                onChange={(e) => setNovaQtd(e.target.value)}
                placeholder={numero(produto.saldoAtual)}
              />
            </Campo>
            <Campo rotulo="Tipo">
              <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimento)}>
                <option value="AJUSTE">Ajuste de contagem</option>
                <option value="PERDA">Perda ou quebra</option>
                <option value="INVENTARIO_INICIAL">Inventário de abertura</option>
              </Selecao>
            </Campo>
            <Campo rotulo="Motivo (obrigatório)">
              <Entrada
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: 3 garrafas quebradas na descarga"
              />
            </Campo>
            <Botao variante="primario" onClick={salvarAjuste} className="h-[38px]">
              Gravar
            </Botao>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-suave">
            O ajuste não apaga nada: grava um movimento novo com a diferença, o
            motivo e quem fez. O custo médio não muda — só a entrada de
            mercadoria mexe no custo.
          </p>
        </Cartao>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao>
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-suave">
            {casco ? "Na rua" : "Saldo atual"}
          </p>
          <p
            className={`tabular mt-2 text-[26px] font-semibold leading-none ${
              casco
                ? "text-casco"
                : precisaRepor(produto)
                  ? "text-alerta"
                  : "text-tinta"
            }`}
          >
            {numero(produto.saldoAtual)}
          </p>
          <p className="mt-2 text-xs text-suave">
            {casco
              ? "garrafas com clientes"
              : `mínimo ${numero(produto.estoqueMinimo)} un`}
          </p>
        </Cartao>

        {podeVerCusto && (
          <Cartao>
            <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-suave">
              Custo médio
            </p>
            <p className="tabular mt-2 text-[26px] font-semibold leading-none text-tinta">
              {custoCurto(produto.custoMedio)}
            </p>
            <p className="mono mt-2 text-[11px] text-suave">
              {moeda4(produto.custoMedio)} com 4 casas
            </p>
          </Cartao>
        )}

        {!casco && (
          <>
            <Cartao>
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-suave">
                Preço varejo
              </p>
              <p className="tabular mt-2 text-[26px] font-semibold leading-none text-tinta">
                {moeda(produto.precoVarejo)}
              </p>
              {podeVerCusto && (
                <p className="mt-2 text-xs text-positivo">
                  margem {(margem(produto.precoVarejo, produto.custoMedio) * 100).toFixed(1)}%
                </p>
              )}
            </Cartao>
            <Cartao>
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-suave">
                Preço atacado
              </p>
              <p className="tabular mt-2 text-[26px] font-semibold leading-none text-marca">
                {moeda(produto.precoAtacado)}
              </p>
              <p className="mt-2 text-xs text-suave">
                a partir de {numero(produto.qtdMinimaAtacado)} un
                {podeVerCusto &&
                  ` · margem ${(margem(produto.precoAtacado, produto.custoMedio) * 100).toFixed(1)}%`}
              </p>
            </Cartao>
          </>
        )}
      </div>

      <Cartao padding={false}>
        <div className="p-5 pb-3">
          <TituloCartao extra={<span className="text-[11px] text-suave">{movs.length} lançamentos</span>}>
            Extrato de movimentações
          </TituloCartao>
          <p className="-mt-2 text-[13px] text-suave">
            Livro-razão do produto: só se insere, nunca se edita nem apaga. O
            saldo de qualquer data sai daqui.
          </p>
        </div>
        <Rolagem>
          <Tabela>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th alinha="right">{casco ? "Saiu / voltou" : "Quantidade"}</Th>
                <Th alinha="right">{casco ? "Na rua depois" : "Saldo depois"}</Th>
                {podeVerCusto && <Th alinha="right">Custo no momento</Th>}
                <Th>Origem</Th>
                <Th>Usuário</Th>
              </tr>
            </thead>
            <tbody>
              {movs.slice(0, 120).map((m) => {
                const r = ROTULO[m.tipo];
                return (
                  <tr key={m.id} className="transicao hover:bg-superficie2/60">
                    <Td className="whitespace-nowrap text-suave">{dataHora(m.data)}</Td>
                    <Td>
                      <Etiqueta tom={r.tom}>{r.texto}</Etiqueta>
                    </Td>
                    <Td
                      alinha="right"
                      className={`font-semibold ${m.qtd > 0 ? "text-positivo" : "text-negativo"}`}
                    >
                      {m.qtd > 0 ? "+" : ""}
                      {numero(m.qtd)}
                    </Td>
                    <Td alinha="right" className="font-medium text-tinta">
                      {numero(m.saldoApos)}
                    </Td>
                    {podeVerCusto && (
                      <Td alinha="right" className="text-suave">
                        {custoCurto(m.custoUnitNoMomento)}
                      </Td>
                    )}
                    <Td className="text-suave">
                      {m.origemTipo === "VENDA" && m.origemId ? (
                        // saida por venda: mostra quando a venda aconteceu
                        <Link
                          href={`/vendas/${m.origemId}`}
                          className="hover:text-marca hover:underline"
                        >
                          <span className="block font-medium text-tinta2">
                            Venda {numeroVenda(estado, m.origemId)}
                          </span>
                          <span className="tabular block text-[11px]">
                            {dataHora(m.data)}
                          </span>
                        </Link>
                      ) : m.origemTipo === "ENTRADA" && m.origemId ? (
                        // sem venda: leva para a carga, onde estao os produtos comprados
                        <Link
                          href={`/entradas?abrir=${m.origemId}`}
                          className="hover:text-marca hover:underline"
                        >
                          <span className="block font-medium text-tinta2">Compra</span>
                          <span className="block text-[11px]">ver produtos da carga</span>
                        </Link>
                      ) : m.origemTipo === "CARGA_INICIAL" ? (
                        "Carga inicial"
                      ) : (
                        m.motivo ?? "Ajuste"
                      )}
                    </Td>
                    <Td className="text-suave">
                      {estado.usuarios.find((u) => u.id === m.usuarioId)?.nome.split(" ")[0]}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
          {movs.length === 0 && (
            <Vazio>
              Nenhuma movimentação ainda. O produto aguarda a primeira entrada —{" "}
              <Link href="/entradas/nova" className="font-semibold text-marca hover:underline">
                lançar agora
              </Link>
              .
            </Vazio>
          )}
        </Rolagem>
      </Cartao>
    </>
  );
}
