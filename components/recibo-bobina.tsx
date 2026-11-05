"use client";

import { createPortal } from "react-dom";
import { comoVendido } from "@/lib/embalagem";
import { dataHora, moeda, numero, porExtenso } from "@/lib/formato";
import type { Cliente, Empresa, Venda } from "@/lib/tipos";

/**
 * Recibo para impressora de bobina (Elgin i9): 72 mm uteis no papel de 80 mm.
 * So usa preto puro, porque cinza vira pontilhado no papel termico. Fica direto
 * no body para que, na impressao, o resto da tela suma sem deixar margem.
 */
export function ReciboBobina({
  venda,
  empresa: e,
  cliente,
  titulo,
  numeroDoc,
  pagamento,
  operador,
  cascos,
}: {
  venda: Venda;
  empresa: Empresa;
  cliente: Cliente | null;
  titulo: string;
  numeroDoc: string;
  pagamento: string;
  operador?: string;
  cascos: number;
}) {
  const cancelada = venda.status === "CANCELADA";
  const numeroVenda = String(venda.numero).padStart(5, "0");

  return createPortal(
    <div id="recibo-bobina" className="recibo-bobina">
      <header className="text-center">
        <p className="text-[15px] font-bold leading-tight">{e.nomeFantasia}</p>
        <p>{e.razaoSocial}</p>
        <p>
          CNPJ {e.cnpj}
          {e.inscricaoEstadual && ` · IE ${e.inscricaoEstadual}`}
        </p>
        <p>{e.endereco}</p>
        <p>{e.telefone}</p>
      </header>

      {cancelada && (
        <p className="mt-2 border-2 border-black py-1 text-center text-[15px] font-bold">
          VENDA CANCELADA
        </p>
      )}

      <section className="recibo-bloco text-center">
        <p className="font-bold">
          {titulo} nº {numeroDoc}
        </p>
        <p>{dataHora(venda.data)}</p>
        {numeroVenda !== numeroDoc && <p>venda nº {numeroVenda}</p>}
      </section>

      <section className="recibo-bloco">
        <p className="font-bold">{cliente?.nomeRazao ?? "Consumidor final"}</p>
        {cliente?.cpfCnpj && (
          <p>
            {cliente.tipo === "PJ" ? "CNPJ" : "CPF"} {cliente.cpfCnpj}
          </p>
        )}
        {cliente?.inscricaoEstadual && <p>IE {cliente.inscricaoEstadual}</p>}
        {cliente?.endereco && <p>{cliente.endereco}</p>}
        {cliente?.telefone && <p>{cliente.telefone}</p>}
      </section>

      <ul className="recibo-bloco flex flex-col gap-1.5">
        {venda.itens.map((i) => {
          const q = comoVendido(i);
          return (
            <li key={i.id}>
              <p className="font-bold">
                {i.descricao}
                {i.gelado && " (gelado)"}
              </p>
              <Linha
                rotulo={`${numero(q.qtd)} ${q.unidade}${q.fator > 1 ? ` c/ ${q.fator}` : ""} x ${moeda(q.precoUnit)}`}
                valor={moeda(i.total)}
              />
            </li>
          );
        })}
      </ul>

      <section className="recibo-bloco">
        <Linha rotulo="Subtotal" valor={moeda(venda.subtotal)} />
        {venda.desconto > 0 && <Linha rotulo="Desconto" valor={`− ${moeda(venda.desconto)}`} />}
        <p className="mt-0.5 flex items-baseline justify-between text-[17px] font-bold">
          <span>Total</span>
          <span className={cancelada ? "line-through" : ""}>{moeda(venda.total)}</span>
        </p>
        <p>{porExtenso(venda.total)}</p>
      </section>

      <section className="recibo-bloco">
        <Linha rotulo="Pagamento" valor={pagamento} />
        {operador && <Linha rotulo="Operador" valor={operador} />}
      </section>

      {cascos > 0 && (
        <section className="recibo-bloco">
          <p className="font-bold">Vasilhame retornável</p>
          <p>
            {cancelada
              ? `Os ${numero(cascos)} cascos desta venda voltaram ao depósito com o cancelamento.`
              : `Saíram ${numero(cascos)} cascos com esta venda, que permanecem em poder do cliente até a devolução.`}
          </p>
        </section>
      )}

      {/* a assinatura so importa quando o cliente fica devendo algo */}
      {!cancelada && (venda.formaPagamento === "FIADO" || cascos > 0) && (
        <p className="mt-10 border-t border-black pt-1 text-center">Assinatura do cliente</p>
      )}

      <p className="recibo-bloco text-center">
        Documento sem valor fiscal. Não substitui Nota Fiscal Eletrônica.
      </p>
    </div>,
    document.body,
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span>{rotulo}</span>
      <span className="shrink-0 font-bold">{valor}</span>
    </p>
  );
}
