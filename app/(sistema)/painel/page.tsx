"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Beer,
  Boxes,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import {
  inicioDoDia,
  rankingProdutos,
  resumoPainel,
  serieDiaria,
  vendasEntre,
} from "@/lib/consultas";
import { moeda, numero, porcento, diaCurto, hora } from "@/lib/formato";
import {
  Barra,
  Cabecalho,
  Cartao,
  Etiqueta,
  Indicador,
  Rolagem,
  Tabela,
  Td,
  Th,
  TituloCartao,
  Vazio,
} from "@/components/ui";

export default function Painel() {
  const { estado } = useEstado();
  const { podeVerLucro, podeVerCusto, usuario } = usePerfil();

  const r = useMemo(() => resumoPainel(estado), [estado]);
  const serie = useMemo(() => serieDiaria(estado, 30), [estado]);
  const top = useMemo(() => {
    const agora = new Date();
    const inicio = new Date(inicioDoDia().getTime() - 29 * 86400000);
    return rankingProdutos(estado, vendasEntre(estado, inicio, agora)).slice(0, 6);
  }, [estado]);

  const ultimas = estado.vendas.slice(0, 8);
  const maiorReceita = top[0]?.receita ?? 1;
  const primeiroNome = usuario?.nome.split(" ")[0] ?? "";

  return (
    <>
      <Cabecalho
        titulo={`Bom dia, ${primeiroNome}`}
        descricao={`Movimento de hoje, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Vendas de hoje"
          valor={moeda(r.dia.receita)}
          detalhe={`${r.dia.quantidade} venda${r.dia.quantidade === 1 ? "" : "s"} · ticket ${moeda(r.dia.ticket)}`}
          icone={<ArrowUpRight size={16} />}
        />
        {podeVerLucro ? (
          <Indicador
            rotulo="Lucro em 30 dias"
            valor={moeda(r.mes.lucro)}
            detalhe={`margem de ${porcento(r.mes.margem)} sobre ${moeda(r.mes.receita)}`}
            tom="positivo"
            icone={<TrendingUp size={16} />}
          />
        ) : (
          <Indicador
            rotulo="Faturamento em 30 dias"
            valor={moeda(r.mes.receita)}
            detalhe={`${r.mes.quantidade} vendas no período`}
            icone={<TrendingUp size={16} />}
          />
        )}
        <Indicador
          rotulo={podeVerCusto ? "Estoque a custo" : "Itens em estoque"}
          valor={podeVerCusto ? moeda(r.estoque) : numero(r.itensEstoque)}
          detalhe={
            podeVerCusto
              ? `${numero(r.itensEstoque)} unidades em ${estado.produtos.filter((p) => p.tipo === "NORMAL").length} produtos`
              : `em ${estado.produtos.filter((p) => p.tipo === "NORMAL").length} produtos`
          }
          icone={<Boxes size={16} />}
        />
        <Indicador
          rotulo="Cascos na rua"
          valor={numero(r.cascos)}
          detalhe="garrafas retornáveis com clientes"
          tom="casco"
          icone={<Beer size={16} />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <TituloCartao
            extra={
              <div className="flex items-center gap-4 text-[11px] font-semibold text-suave">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-full bg-marca" />
                  Receita
                </span>
                {podeVerLucro && (
                  <span className="flex items-center gap-1.5">
                    <i className="inline-block h-2 w-2 rounded-full bg-positivo" />
                    Lucro
                  </span>
                )}
              </div>
            }
          >
            Últimos 30 dias
          </TituloCartao>
          <div className="h-[236px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3f8f" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#1e3f8f" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e6a4f" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0e6a4f" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e6ecf3" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tickFormatter={(d) => diaCurto(d)}
                  tick={{ fontSize: 10.5, fill: "#6b7685" }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10.5, fill: "#6b7685" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #dbe2ea",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 6px 20px -12px rgba(15,20,28,.4)",
                  }}
                  labelFormatter={(d) => diaCurto(String(d))}
                  formatter={(v: number, nome: string) => [
                    moeda(Math.round(v * 100)),
                    nome === "receita" ? "Receita" : "Lucro",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="#1e3f8f"
                  strokeWidth={1.8}
                  fill="url(#gR)"
                />
                {podeVerLucro && (
                  <Area
                    type="monotone"
                    dataKey="lucro"
                    stroke="#0e6a4f"
                    strokeWidth={1.8}
                    fill="url(#gL)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Cartao>

        <div className="flex flex-col gap-4">
          <Cartao>
            <TituloCartao
              extra={
                <Link
                  href="/caixa"
                  className="text-[11px] font-semibold text-marca hover:underline"
                >
                  abrir
                </Link>
              }
            >
              Caixa
            </TituloCartao>
            {r.caixa ? (
              <>
                <p className="tabular text-[26px] font-semibold leading-none text-tinta">
                  {moeda(r.caixa.esperado)}
                </p>
                <p className="mt-2 text-xs text-suave">
                  esperado na gaveta · aberto às {hora(r.caixa.sessao.abertaEm)}
                </p>
                <dl className="mt-4 space-y-1.5 border-t border-borda pt-3 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-suave">Faturado na sessão</dt>
                    <dd className="tabular font-medium">{moeda(r.caixa.faturado)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-suave">Sangrias</dt>
                    <dd className="tabular font-medium text-negativo">
                      {moeda(r.caixa.sangrias)}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="py-2">
                <p className="text-sm text-suave">Nenhum caixa aberto agora.</p>
                <Link
                  href="/caixa"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-marca hover:underline"
                >
                  <Wallet size={14} /> Abrir caixa
                </Link>
              </div>
            )}
          </Cartao>

          <Cartao className={r.abaixoMinimo.length ? "border-alerta/35" : ""}>
            <TituloCartao
              extra={
                <Link
                  href="/estoque"
                  className="text-[11px] font-semibold text-marca hover:underline"
                >
                  ver tudo
                </Link>
              }
            >
              Abaixo do mínimo
            </TituloCartao>
            {r.abaixoMinimo.length === 0 ? (
              <p className="py-1 text-sm text-suave">
                Nenhum produto abaixo do estoque mínimo.
              </p>
            ) : (
              <>
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-alerta">
                  <AlertTriangle size={15} />
                  {r.abaixoMinimo.length} produto
                  {r.abaixoMinimo.length === 1 ? "" : "s"} para repor
                </p>
                <ul className="space-y-2">
                  {r.abaixoMinimo.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/estoque/${p.id}`}
                        className="truncate text-[13px] text-tinta2 hover:text-marca hover:underline"
                      >
                        {p.nome}
                      </Link>
                      <span className="tabular shrink-0 text-[13px] font-semibold text-alerta">
                        {numero(p.saldoAtual)}
                        <span className="text-suave"> / {numero(p.estoqueMinimo)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Cartao>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Cartao padding={false}>
          <div className="p-5 pb-3">
            <TituloCartao>Mais vendidos em 30 dias</TituloCartao>
          </div>
          {top.length === 0 ? (
            <Vazio>Sem vendas neste mês ainda.</Vazio>
          ) : (
            <ul className="px-5 pb-5">
              {top.map((p) => (
                <li key={p.produtoId} className="border-t border-borda py-3 first:border-t-0 first:pt-0">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium text-tinta">
                      {p.nome}
                    </span>
                    <span className="tabular shrink-0 text-[13px] font-semibold">
                      {moeda(p.receita)}
                    </span>
                  </div>
                  <Barra fracao={p.receita / maiorReceita} />
                  <div className="mt-1.5 flex justify-between text-[11.5px] text-suave">
                    <span>{numero(p.qtd)} un vendidas</span>
                    {podeVerLucro && (
                      <span className="tabular text-positivo">
                        lucro {moeda(p.lucro)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao padding={false}>
          <div className="p-5 pb-3">
            <TituloCartao
              extra={
                <Link
                  href="/vendas"
                  className="text-[11px] font-semibold text-marca hover:underline"
                >
                  ver todas
                </Link>
              }
            >
              Últimas vendas
            </TituloCartao>
          </div>
          <Rolagem>
            <Tabela>
              <thead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Cliente</Th>
                  <Th>Canal</Th>
                  <Th alinha="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {ultimas.map((v) => {
                  const c = estado.clientes.find((x) => x.id === v.clienteId);
                  return (
                    <tr key={v.id} className="transicao hover:bg-superficie2/60">
                      <Td className="tabular whitespace-nowrap">
                        <Link href={`/vendas/${v.id}`} className="hover:text-marca hover:underline">
                          {String(v.numero).padStart(5, "0")}
                        </Link>
                      </Td>
                      <Td className="max-w-[190px] truncate">
                        {c?.nomeRazao ?? (
                          <span className="text-suave">Consumidor final</span>
                        )}
                      </Td>
                      <Td>
                        <Etiqueta tom={v.tipoPreco === "ATACADO" ? "marca" : "neutro"}>
                          {v.tipoPreco}
                        </Etiqueta>
                      </Td>
                      <Td alinha="right" className="font-semibold text-tinta">
                        {moeda(v.total)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          </Rolagem>
        </Cartao>
      </div>
    </>
  );
}
