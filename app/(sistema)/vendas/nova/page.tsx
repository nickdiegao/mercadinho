"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { precoAplicavel } from "@/lib/regras";
import { moeda, numero } from "@/lib/formato";
import type { FormaPagamento, Produto } from "@/lib/tipos";
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

interface Linha {
  produtoId: string;
  qtd: number;
}

const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "DINHEIRO", rotulo: "Dinheiro" },
  { valor: "PIX", rotulo: "PIX" },
  { valor: "DEBITO", rotulo: "Débito" },
  { valor: "CREDITO", rotulo: "Crédito" },
  { valor: "FIADO", rotulo: "Fiado" },
];

export default function NovaVenda() {
  const { estado, registrarVenda } = useEstado();
  const { podeVerLucro } = usePerfil();
  const router = useRouter();
  const buscaRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [descontoTexto, setDescontoTexto] = useState("");
  const [recibo, setRecibo] = useState(true);

  const cliente = estado.clientes.find((c) => c.id === clienteId) ?? null;
  const vendaveis = useMemo(
    () => estado.produtos.filter((p) => p.tipo === "NORMAL" && p.ativo),
    [estado.produtos],
  );

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    return vendaveis
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(t) ||
          p.sku.toLowerCase().includes(t) ||
          p.codigoBarras.includes(t),
      )
      .slice(0, 7);
  }, [busca, vendaveis]);

  const itens = linhas.map((l) => {
    const p = estado.produtos.find((x) => x.id === l.produtoId)!;
    const { tipo, preco, motivo } = precoAplicavel(p, l.qtd, cliente);
    return {
      ...l,
      produto: p,
      tipoPreco: tipo,
      precoUnit: preco,
      motivo,
      total: Math.round(l.qtd * preco),
    };
  });

  const subtotal = itens.reduce((a, i) => a + i.total, 0);
  const desconto = Math.min(
    subtotal,
    Math.round((parseFloat(descontoTexto.replace(",", ".")) || 0) * 100),
  );
  const total = subtotal - desconto;
  const custo = itens.reduce(
    (a, i) => a + Math.round((i.qtd * i.produto.custoMedio) / 100),
    0,
  );

  function adicionar(p: Produto) {
    setLinhas((ls) => {
      const existe = ls.find((l) => l.produtoId === p.id);
      if (existe)
        return ls.map((l) =>
          l.produtoId === p.id ? { ...l, qtd: l.qtd + 1 } : l,
        );
      return [...ls, { produtoId: p.id, qtd: 1 }];
    });
    setBusca("");
    buscaRef.current?.focus();
  }

  function mudarQtd(produtoId: string, qtd: number) {
    if (qtd <= 0) {
      setLinhas((ls) => ls.filter((l) => l.produtoId !== produtoId));
      return;
    }
    setLinhas((ls) =>
      ls.map((l) => (l.produtoId === produtoId ? { ...l, qtd } : l)),
    );
  }

  function finalizar() {
    if (!itens.length) return;
    const venda = registrarVenda({
      clienteId: clienteId || undefined,
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        qtd: i.qtd,
        precoUnit: i.precoUnit,
        tipoPrecoAplicado: i.tipoPreco,
      })),
      desconto,
      formaPagamento: forma,
      emitirRecibo: recibo,
    });
    router.push(`/vendas/${venda.id}`);
  }

  const semEstoque = itens.filter((i) => i.qtd > i.produto.saldoAtual);
  const cascos = itens.filter((i) => i.produto.vasilhameId);

  return (
    <>
      <Cabecalho
        titulo="Nova venda"
        descricao="Busque pelo nome, código ou SKU. O preço de atacado entra sozinho quando a quantidade bate."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <div className="flex flex-col gap-4">
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
                  if (e.key === "Escape") setBusca("");
                }}
                placeholder="Buscar produto…"
                autoFocus
                className="w-full rounded-md border border-borda bg-superficie py-2.5 pl-9 pr-3 text-sm focus:border-marca focus:outline-none"
              />
            </div>

            {resultados.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-md border border-borda">
                {resultados.map((p, i) => (
                  <li key={p.id}>
                    <button
                      onClick={() => adicionar(p)}
                      className={`transicao flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-marca-clara ${
                        i === 0 ? "bg-superficie2/60" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-tinta">
                          {p.nome}
                        </span>
                        <span className="tabular text-[11.5px] text-suave">
                          {p.sku} · saldo {numero(p.saldoAtual)} un · caixa com{" "}
                          {p.fatorConversao}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block text-[13px] font-semibold">
                          {moeda(p.precoVarejo)}
                        </span>
                        <span className="tabular block text-[11px] text-marca">
                          {moeda(p.precoAtacado)} atacado
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao padding={false}>
            {itens.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="text-sm text-suave">
                  Nenhum item ainda. Busque um produto acima para começar.
                </p>
              </div>
            ) : (
              <ul>
                {itens.map((i) => (
                  <li
                    key={i.produtoId}
                    className="border-b border-borda px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-tinta">
                          {i.produto.nome}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-suave">
                          <Etiqueta tom={i.tipoPreco === "ATACADO" ? "marca" : "neutro"}>
                            {i.tipoPreco}
                          </Etiqueta>
                          <span>
                            {moeda(i.precoUnit)} / un — {i.motivo}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border border-borda">
                          <button
                            onClick={() => mudarQtd(i.produtoId, i.qtd - 1)}
                            className="transicao px-2 py-1.5 text-suave hover:text-marca"
                            aria-label="Diminuir"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            value={i.qtd}
                            onChange={(e) =>
                              mudarQtd(i.produtoId, Number(e.target.value) || 0)
                            }
                            className="tabular w-14 border-x border-borda py-1.5 text-center text-sm focus:outline-none"
                          />
                          <button
                            onClick={() => mudarQtd(i.produtoId, i.qtd + 1)}
                            className="transicao px-2 py-1.5 text-suave hover:text-marca"
                            aria-label="Aumentar"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() =>
                            mudarQtd(i.produtoId, 0)
                          }
                          className="transicao rounded-md p-2 text-suave hover:bg-alerta-claro hover:text-alerta"
                          aria-label="Remover item"
                        >
                          <Trash2 size={15} />
                        </button>
                        <span className="tabular w-24 text-right text-[14px] font-semibold text-tinta">
                          {moeda(i.total)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11.5px]">
                      <button
                        onClick={() =>
                          mudarQtd(i.produtoId, i.produto.fatorConversao)
                        }
                        className="font-semibold text-marca hover:underline"
                      >
                        1 {i.produto.unidadeCompra} = {i.produto.fatorConversao} un
                      </button>
                      {i.qtd > i.produto.saldoAtual && (
                        <span className="font-semibold text-alerta">
                          saldo insuficiente: tem {numero(i.produto.saldoAtual)} un
                        </span>
                      )}
                      {i.produto.vasilhameId && (
                        <span className="text-casco">
                          sai {numero(i.qtd)} casco{i.qtd === 1 ? "" : "s"} junto
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {semEstoque.length > 0 && (
            <Aviso tom="alerta" titulo="Saldo insuficiente">
              O mockup deixa fechar a venda mesmo assim, para você ver o saldo
              ficar negativo. No sistema real isso é bloqueado por uma constraint
              no banco, e só o admin pode autorizar.
            </Aviso>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Cartao>
            <TituloCartao>Cliente</TituloCartao>
            <Selecao
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Consumidor final (varejo)</option>
              <optgroup label="Atacado">
                {estado.clientes
                  .filter((c) => c.tipoPreco === "ATACADO")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeRazao}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Varejo">
                {estado.clientes
                  .filter((c) => c.tipoPreco === "VAREJO")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeRazao}
                    </option>
                  ))}
              </optgroup>
            </Selecao>
            {cliente?.tipoPreco === "ATACADO" && (
              <p className="mt-2 text-[12px] leading-relaxed text-marca">
                Cliente com tabela de atacado: todo item sai no preço de atacado,
                em qualquer quantidade.
              </p>
            )}
          </Cartao>

          <Cartao>
            <TituloCartao>Pagamento</TituloCartao>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMAS.map((f) => (
                <button
                  key={f.valor}
                  onClick={() => setForma(f.valor)}
                  className={`transicao rounded-md border px-2 py-2 text-[12.5px] font-semibold ${
                    forma === f.valor
                      ? "border-marca bg-marca-clara text-marca"
                      : "border-borda text-tinta2 hover:border-borda2"
                  }`}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
            {forma === "FIADO" && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-negativo">
                Fiado entra no lucro hoje, mas não entra no caixa. É a regra 4 do
                blueprint funcionando.
              </p>
            )}

            <div className="mt-4">
              <Campo rotulo="Desconto (R$)">
                <Entrada
                  inputMode="decimal"
                  value={descontoTexto}
                  onChange={(e) => setDescontoTexto(e.target.value)}
                  placeholder="0,00"
                />
              </Campo>
            </div>

            <label className="mt-3 flex items-center gap-2 text-[13px] text-tinta2">
              <input
                type="checkbox"
                checked={recibo}
                onChange={(e) => setRecibo(e.target.checked)}
                className="h-4 w-4 accent-[#1e3f8f]"
              />
              Emitir recibo ao finalizar
            </label>
          </Cartao>

          <Cartao>
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-suave">Subtotal</dt>
                <dd className="tabular">{moeda(subtotal)}</dd>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between">
                  <dt className="text-suave">Desconto</dt>
                  <dd className="tabular text-negativo">− {moeda(desconto)}</dd>
                </div>
              )}
              {cascos.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-suave">Cascos a devolver</dt>
                  <dd className="tabular text-casco">
                    {numero(cascos.reduce((a, i) => a + i.qtd, 0))} un
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-borda pt-2.5">
                <dt className="font-bold text-tinta">Total</dt>
                <dd className="tabular text-2xl font-semibold text-tinta">
                  {moeda(total)}
                </dd>
              </div>
              {podeVerLucro && total > 0 && (
                <div className="flex justify-between border-t border-borda pt-2.5 text-[12.5px]">
                  <dt className="text-suave">Lucro desta venda</dt>
                  <dd className="tabular font-semibold text-positivo">
                    {moeda(total - custo)}
                  </dd>
                </div>
              )}
            </dl>

            <Botao
              variante="primario"
              onClick={finalizar}
              disabled={!itens.length}
              className="mt-4 w-full py-2.5"
            >
              <Check size={16} /> Finalizar venda
            </Botao>
          </Cartao>
        </div>
      </div>
    </>
  );
}
