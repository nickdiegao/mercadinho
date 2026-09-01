"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { moeda, dataHora } from "@/lib/formato";
import {
  Botao,
  Cabecalho,
  Entrada,
  Etiqueta,
  Rolagem,
  Selecao,
  Tabela,
  Td,
  Th,
  Vazio,
} from "@/components/ui";

export default function Vendas() {
  const { estado } = useEstado();
  const { podeVerLucro, podeVender } = usePerfil();
  const [busca, setBusca] = useState("");
  const [canal, setCanal] = useState("");
  const [forma, setForma] = useState("");

  const clientePorId = useMemo(
    () => new Map(estado.clientes.map((c) => [c.id, c])),
    [estado.clientes],
  );

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return estado.vendas
      .filter((v) => {
        if (canal && v.tipoPreco !== canal) return false;
        if (forma && v.formaPagamento !== forma) return false;
        if (!t) return true;
        const c = clientePorId.get(v.clienteId ?? "");
        return (
          String(v.numero).padStart(5, "0").includes(t) ||
          (c?.nomeRazao.toLowerCase().includes(t) ?? false)
        );
      })
      .slice(0, 200);
  }, [estado.vendas, busca, canal, forma, clientePorId]);

  return (
    <>
      <Cabecalho
        titulo="Vendas"
        descricao={`${estado.vendas.length} vendas registradas nos últimos 60 dias.`}
        acoes={
          podeVender && (
            <Link href="/vendas/nova">
              <Botao variante="primario">
                <Plus size={15} /> Nova venda
              </Botao>
            </Link>
          )
        }
      />

      <div className="nao-imprime mb-4 grid gap-2 sm:grid-cols-[1fr_150px_150px]">
        <Entrada
          placeholder="Buscar por número ou cliente…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Selecao value={canal} onChange={(e) => setCanal(e.target.value)}>
          <option value="">Todos os canais</option>
          <option value="ATACADO">Atacado</option>
          <option value="VAREJO">Varejo</option>
        </Selecao>
        <Selecao value={forma} onChange={(e) => setForma(e.target.value)}>
          <option value="">Toda forma</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="DEBITO">Débito</option>
          <option value="CREDITO">Crédito</option>
          <option value="FIADO">Fiado</option>
        </Selecao>
      </div>

      <Rolagem>
        <Tabela>
          <thead>
            <tr>
              <Th>Nº</Th>
              <Th>Data</Th>
              <Th>Cliente</Th>
              <Th>Canal</Th>
              <Th>Pagamento</Th>
              <Th alinha="right">Itens</Th>
              <Th alinha="right">Total</Th>
              {podeVerLucro && <Th alinha="right">Lucro</Th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const c = clientePorId.get(v.clienteId ?? "");
              return (
                <tr key={v.id} className="transicao hover:bg-superficie2/60">
                  <Td className="tabular">
                    <Link
                      href={`/vendas/${v.id}`}
                      className="font-medium hover:text-marca hover:underline"
                    >
                      {String(v.numero).padStart(5, "0")}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-suave">{dataHora(v.data)}</Td>
                  <Td className="max-w-[220px] truncate">
                    {c?.nomeRazao ?? <span className="text-suave">Consumidor final</span>}
                  </Td>
                  <Td>
                    <Etiqueta tom={v.tipoPreco === "ATACADO" ? "marca" : "neutro"}>
                      {v.tipoPreco}
                    </Etiqueta>
                  </Td>
                  <Td>
                    <Etiqueta tom={v.formaPagamento === "FIADO" ? "negativo" : "neutro"}>
                      {v.formaPagamento}
                    </Etiqueta>
                  </Td>
                  <Td alinha="right">{v.itens.length}</Td>
                  <Td alinha="right" className="font-semibold text-tinta">
                    {moeda(v.total)}
                  </Td>
                  {podeVerLucro && (
                    <Td alinha="right" className="text-positivo">
                      {moeda(v.total - v.custoTotal)}
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Tabela>
        {lista.length === 0 && <Vazio>Nenhuma venda encontrada com esses filtros.</Vazio>}
      </Rolagem>
    </>
  );
}
