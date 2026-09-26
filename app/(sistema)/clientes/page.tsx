"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { moeda, data } from "@/lib/formato";
import { Lista, type ColunaLista } from "@/components/lista";
import type { Cliente } from "@/lib/tipos";
import { FormCliente } from "@/components/form-cliente";
import {
  Botao,
  Cabecalho,
  Cartao,
  Entrada,
  Etiqueta,
  Selecao,
} from "@/components/ui";

export default function Clientes() {
  const { estado } = useEstado();
  const { podeVerLucro, podeCadastrarCliente } = usePerfil();
  const [busca, setBusca] = useState("");
  const [tabela, setTabela] = useState("");
  const [form, setForm] = useState<{ cliente: Cliente | null } | null>(null);
  const buscaAdiada = useDeferredValue(busca);

  const porCliente = useMemo(() => {
    const acc = new Map<
      string,
      { compras: number; total: number; lucro: number; fiado: number }
    >();
    for (const v of estado.vendas) {
      if (!v.clienteId || v.status !== "FECHADA") continue;
      const a =
        acc.get(v.clienteId) ?? { compras: 0, total: 0, lucro: 0, fiado: 0 };
      a.compras += 1;
      a.total += v.total;
      a.lucro += v.total - v.custoTotal;
      if (v.formaPagamento === "FIADO") a.fiado += v.total;
      acc.set(v.clienteId, a);
    }
    return acc;
  }, [estado.vendas]);

  const lista = useMemo(() => {
    const t = buscaAdiada.trim().toLowerCase();
    return estado.clientes
      // desativado some da lista, mas continua valendo nas vendas antigas
      .filter((c) =>
        tabela === "INATIVO" ? !c.ativo : c.ativo && (tabela ? c.tipoPreco === tabela : true),
      )
      .filter(
        (c) =>
          !t ||
          c.nomeRazao.toLowerCase().includes(t) ||
          c.cpfCnpj.includes(t) ||
          c.telefone.includes(t),
      )
      .sort(
        (a, b) =>
          (porCliente.get(b.id)?.total ?? 0) - (porCliente.get(a.id)?.total ?? 0),
      );
  }, [estado.clientes, buscaAdiada, tabela, porCliente]);

  const colunas: ColunaLista<Cliente>[] = [
    {
      chave: "nome",
      titulo: "Cliente",
      papel: "titulo",
      render: (c) => (
        <span className="block max-w-[240px] truncate">{c.nomeRazao}</span>
      ),
    },
    {
      chave: "doc",
      titulo: "CPF / CNPJ",
      papel: "apoio",
      render: (c) => <span className="mono text-suave">{c.cpfCnpj}</span>,
    },
    {
      chave: "tabela",
      titulo: "Tabela",
      render: (c) => (
        <Etiqueta tom={c.tipoPreco === "ATACADO" ? "marca" : "neutro"}>
          {c.tipoPreco}
        </Etiqueta>
      ),
    },
    {
      chave: "compras",
      titulo: "Compras",
      alinha: "right",
      render: (c) => <>{porCliente.get(c.id)?.compras ?? 0}</>,
    },
    {
      chave: "total",
      titulo: "Total comprado",
      alinha: "right",
      papel: "destaque",
      render: (c) => (
        <span className="font-semibold text-tinta">
          {moeda(porCliente.get(c.id)?.total ?? 0)}
        </span>
      ),
    },
    ...(podeVerLucro
      ? [
          {
            chave: "lucro",
            titulo: "Lucro gerado",
            alinha: "right" as const,
            render: (c: Cliente) => (
              <span className="text-positivo">
                {moeda(porCliente.get(c.id)?.lucro ?? 0)}
              </span>
            ),
          },
        ]
      : []),
    {
      chave: "fiado",
      titulo: "Fiado aberto",
      alinha: "right",
      render: (c) => {
        const f = porCliente.get(c.id)?.fiado ?? 0;
        return (
          <span className={f ? "font-semibold text-negativo" : "text-suave"}>
            {moeda(f)}
          </span>
        );
      },
    },
  ];

  function detalhe(c: Cliente) {
    const vendas = estado.vendas.filter((v) => v.clienteId === c.id).slice(0, 6);
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-suave">
            Cadastro
          </p>
          <p className="text-[13px] leading-relaxed text-tinta2">
            {c.endereco}
            <br />
            {c.telefone}
            {c.email && (
              <>
                <br />
                {c.email}
              </>
            )}
            {c.inscricaoEstadual && (
              <>
                <br />
                IE {c.inscricaoEstadual}
              </>
            )}
            <br />
            Limite de crédito: {moeda(c.limiteCredito)}
          </p>
          {podeCadastrarCliente && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setForm({ cliente: c });
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
            >
              <Pencil size={13} /> Editar cadastro
            </button>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-suave">
            Últimas compras
          </p>
          {vendas.length === 0 ? (
            <p className="text-[13px] text-suave">Nenhuma compra registrada.</p>
          ) : (
            <ul className="space-y-1">
              {vendas.map((v) => (
                <li key={v.id} className="flex justify-between gap-3 text-[13px]">
                  <Link
                    href={`/vendas/${v.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-tinta2 hover:text-marca hover:underline"
                  >
                    {data(v.data)} · {v.itens.length} itens
                  </Link>
                  <span className="tabular font-medium">{moeda(v.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        descricao="A tabela de preço do cadastro define se o cliente compra no atacado ou no varejo, em qualquer quantidade."
        acoes={
          podeCadastrarCliente && (
            <Botao
              variante="primario"
              onClick={() => setForm({ cliente: null })}
              className="w-full sm:w-auto"
            >
              <Plus size={15} /> Novo cliente
            </Botao>
          )
        }
      />

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-[1fr_180px]">
        <Entrada
          placeholder="Buscar por nome, CPF/CNPJ ou telefone…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={tabela} onChange={(e) => setTabela(e.target.value)}>
          <option value="">Todas as tabelas</option>
          <option value="ATACADO">Atacado</option>
          <option value="VAREJO">Varejo</option>
          <option value="INATIVO">Desativados</option>
        </Selecao>
      </div>

      <Lista
        colunas={colunas}
        linhas={lista}
        chave={(c) => c.id}
        detalhe={detalhe}
        vazio="Nenhum cliente encontrado."
      />

      <Cartao className="mt-4">
        <p className="text-[13px] leading-relaxed text-tinta2">
          A coluna <b>Fiado aberto</b> existe porque venda fiada entra no lucro no
          dia da saída da mercadoria, mas só entra no caixa quando o cliente
          paga. No sistema real isso vira contas a receber, com baixa de
          pagamento — está modelado, mas a tela fica para depois.
        </p>
      </Cartao>
      <FormCliente
        aberto={form !== null}
        cliente={form?.cliente}
        onFechar={() => setForm(null)}
      />
    </>
  );
}
