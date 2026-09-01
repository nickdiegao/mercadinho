"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { moeda, data } from "@/lib/formato";
import {
  Cabecalho,
  Cartao,
  Entrada,
  Etiqueta,
  Rolagem,
  Selecao,
  Tabela,
  Td,
  Th,
  Vazio,
} from "@/components/ui";

export default function Clientes() {
  const { estado } = useEstado();
  const { podeVerLucro } = usePerfil();
  const [busca, setBusca] = useState("");
  const [tabela, setTabela] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const porCliente = useMemo(() => {
    const acc = new Map<
      string,
      { compras: number; total: number; lucro: number; ultima: string; fiado: number }
    >();
    for (const v of estado.vendas) {
      if (!v.clienteId || v.status !== "FECHADA") continue;
      const a =
        acc.get(v.clienteId) ??
        { compras: 0, total: 0, lucro: 0, ultima: v.data, fiado: 0 };
      a.compras += 1;
      a.total += v.total;
      a.lucro += v.total - v.custoTotal;
      if (v.formaPagamento === "FIADO") a.fiado += v.total;
      if (v.data > a.ultima) a.ultima = v.data;
      acc.set(v.clienteId, a);
    }
    return acc;
  }, [estado.vendas]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return estado.clientes
      .filter((c) => (tabela ? c.tipoPreco === tabela : true))
      .filter(
        (c) =>
          !t ||
          c.nomeRazao.toLowerCase().includes(t) ||
          c.cpfCnpj.includes(t) ||
          c.telefone.includes(t),
      )
      .sort(
        (a, b) => (porCliente.get(b.id)?.total ?? 0) - (porCliente.get(a.id)?.total ?? 0),
      );
  }, [estado.clientes, busca, tabela, porCliente]);

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        descricao="A tabela de preço do cadastro define se o cliente compra no atacado ou no varejo, em qualquer quantidade."
      />

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-[1fr_200px]">
        <Entrada
          placeholder="Buscar por nome, CPF/CNPJ ou telefone…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={tabela} onChange={(e) => setTabela(e.target.value)}>
          <option value="">Todas as tabelas</option>
          <option value="ATACADO">Atacado</option>
          <option value="VAREJO">Varejo</option>
        </Selecao>
      </div>

      <Rolagem>
        <Tabela>
          <thead>
            <tr>
              <Th />
              <Th>Cliente</Th>
              <Th>CPF / CNPJ</Th>
              <Th>Tabela</Th>
              <Th alinha="right">Compras</Th>
              <Th alinha="right">Total comprado</Th>
              {podeVerLucro && <Th alinha="right">Lucro gerado</Th>}
              <Th alinha="right">Fiado aberto</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const r = porCliente.get(c.id);
              const expandido = aberto === c.id;
              const vendas = estado.vendas
                .filter((v) => v.clienteId === c.id)
                .slice(0, 6);
              return (
                <Fragment key={c.id}>
                  <tr
                    className="transicao cursor-pointer hover:bg-superficie2/60"
                    onClick={() => setAberto(expandido ? null : c.id)}
                  >
                    <Td className="w-8 text-suave">
                      {expandido ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </Td>
                    <Td className="max-w-[240px]">
                      <span className="block truncate font-medium text-tinta">
                        {c.nomeRazao}
                      </span>
                      <span className="text-[11.5px] text-suave">{c.telefone}</span>
                    </Td>
                    <Td className="mono text-suave">{c.cpfCnpj}</Td>
                    <Td>
                      <Etiqueta tom={c.tipoPreco === "ATACADO" ? "marca" : "neutro"}>
                        {c.tipoPreco}
                      </Etiqueta>
                    </Td>
                    <Td alinha="right">{r?.compras ?? 0}</Td>
                    <Td alinha="right" className="font-semibold text-tinta">
                      {moeda(r?.total ?? 0)}
                    </Td>
                    {podeVerLucro && (
                      <Td alinha="right" className="text-positivo">
                        {moeda(r?.lucro ?? 0)}
                      </Td>
                    )}
                    <Td
                      alinha="right"
                      className={r?.fiado ? "font-semibold text-negativo" : "text-suave"}
                    >
                      {moeda(r?.fiado ?? 0)}
                    </Td>
                  </tr>
                  {expandido && (
                    <tr>
                      <Td colSpan={podeVerLucro ? 8 : 7} className="bg-superficie2/40 p-0">
                        <div className="grid gap-6 px-6 py-4 lg:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-suave">
                              Cadastro
                            </p>
                            <p className="text-[13px] leading-relaxed text-tinta2">
                              {c.endereco}
                              <br />
                              {c.email ?? "sem e-mail"}
                              {c.inscricaoEstadual && (
                                <>
                                  <br />
                                  IE {c.inscricaoEstadual}
                                </>
                              )}
                              <br />
                              Limite de crédito: {moeda(c.limiteCredito)}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-suave">
                              Últimas compras
                            </p>
                            {vendas.length === 0 ? (
                              <p className="text-[13px] text-suave">
                                Nenhuma compra registrada.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {vendas.map((v) => (
                                  <li
                                    key={v.id}
                                    className="flex justify-between gap-3 text-[13px]"
                                  >
                                    <Link
                                      href={`/vendas/${v.id}`}
                                      className="text-tinta2 hover:text-marca hover:underline"
                                    >
                                      {data(v.data)} · {v.itens.length} itens
                                    </Link>
                                    <span className="tabular font-medium">
                                      {moeda(v.total)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Tabela>
        {lista.length === 0 && <Vazio>Nenhum cliente encontrado.</Vazio>}
      </Rolagem>

      <Cartao className="mt-4">
        <p className="text-[13px] leading-relaxed text-tinta2">
          A coluna <b>Fiado aberto</b> existe porque venda fiada entra no lucro no
          dia da saída da mercadoria, mas só entra no caixa quando o cliente
          paga. No sistema real isso vira contas a receber, com baixa de
          pagamento — está modelado, mas a tela fica para depois.
        </p>
      </Cartao>
    </>
  );
}
