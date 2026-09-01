"use client";

import { useMemo } from "react";
import { useEstado } from "@/lib/store";
import { moeda, data } from "@/lib/formato";
import {
  Cabecalho,
  Cartao,
  Rolagem,
  Tabela,
  Td,
  Th,
  Vazio,
} from "@/components/ui";

export default function Fornecedores() {
  const { estado } = useEstado();

  const resumo = useMemo(() => {
    const acc = new Map<string, { cargas: number; total: number; ultima: string }>();
    for (const e of estado.entradas) {
      const a = acc.get(e.fornecedorId) ?? { cargas: 0, total: 0, ultima: e.data };
      a.cargas += 1;
      a.total += e.valorTotal;
      if (e.data > a.ultima) a.ultima = e.data;
      acc.set(e.fornecedorId, a);
    }
    return acc;
  }, [estado.entradas]);

  return (
    <>
      <Cabecalho
        titulo="Fornecedores"
        descricao="Cadastro deliberadamente enxuto — o que importa aqui é o histórico de compras, que é de onde vem o custo."
      />

      <Rolagem>
        <Tabela>
          <thead>
            <tr>
              <Th>Fornecedor</Th>
              <Th>CNPJ</Th>
              <Th>Contato</Th>
              <Th alinha="right">Cargas</Th>
              <Th alinha="right">Total comprado</Th>
              <Th alinha="right">Última carga</Th>
            </tr>
          </thead>
          <tbody>
            {estado.fornecedores.map((f) => {
              const r = resumo.get(f.id);
              return (
                <tr key={f.id} className="transicao hover:bg-superficie2/60">
                  <Td className="max-w-[280px]">
                    <span className="block truncate font-medium text-tinta">
                      {f.razaoSocial}
                    </span>
                    <span className="text-[11.5px] text-suave">{f.endereco}</span>
                  </Td>
                  <Td className="mono text-suave">{f.cnpj}</Td>
                  <Td className="text-suave">
                    {f.telefone}
                    <br />
                    <span className="text-[11.5px]">{f.email}</span>
                  </Td>
                  <Td alinha="right">{r?.cargas ?? 0}</Td>
                  <Td alinha="right" className="font-semibold text-tinta">
                    {moeda(r?.total ?? 0)}
                  </Td>
                  <Td alinha="right" className="text-suave">
                    {r ? data(r.ultima) : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
        {estado.fornecedores.length === 0 && <Vazio>Nenhum fornecedor cadastrado.</Vazio>}
      </Rolagem>

      <Cartao className="mt-4">
        <p className="text-[13px] leading-relaxed text-tinta2">
          Na hora da carga inicial, é o histórico de compras destes fornecedores
          que faz o custo médio nascer verdadeiro. Sem as notas deles, o custo de
          cada produto vira chute — e chute no custo estraga o relatório de lucro
          para sempre.
        </p>
      </Cartao>
    </>
  );
}
