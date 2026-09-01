"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { moeda, numero, dataHora, porExtenso } from "@/lib/formato";
import { Aviso, Botao, Cartao, Etiqueta } from "@/components/ui";

export default function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { estado } = useEstado();
  const { podeVerLucro } = usePerfil();

  const venda = estado.vendas.find((v) => v.id === id);
  if (!venda) {
    return (
      <Aviso tom="alerta" titulo="Venda não encontrada">
        Ela pode ter sido removida ao recarregar a demonstração.{" "}
        <Link href="/vendas" className="font-semibold text-marca hover:underline">
          Voltar para a lista
        </Link>
      </Aviso>
    );
  }

  const cliente = estado.clientes.find((c) => c.id === venda.clienteId) ?? null;
  const doc = estado.documentos.find((d) => d.vendaId === venda.id);
  const e = estado.empresa;
  const cascos = venda.itens.filter(
    (i) => estado.produtos.find((p) => p.id === i.produtoId)?.vasilhameId,
  );

  return (
    <>
      <div className="nao-imprime mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/vendas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-marca"
        >
          <ArrowLeft size={15} /> Vendas
        </Link>
        <div className="flex items-center gap-2">
          {podeVerLucro && (
            <span className="mr-2 text-[13px] text-suave">
              Lucro desta venda{" "}
              <span className="tabular font-semibold text-positivo">
                {moeda(venda.total - venda.custoTotal)}
              </span>
            </span>
          )}
          <Botao variante="primario" onClick={() => window.print()}>
            <Printer size={15} /> Imprimir ou salvar em PDF
          </Botao>
        </div>
      </div>

      {/* ---------------------------------------------------- folha A4 */}
      <div className="folha mx-auto max-w-[820px] rounded-lg border border-borda bg-white p-8 shadow-[0_1px_2px_rgba(15,20,28,0.04)] sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-tinta pb-5">
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold leading-tight text-tinta">
              {e.nomeFantasia}
            </p>
            <p className="mt-0.5 text-[12px] text-tinta2">{e.razaoSocial}</p>
            <p className="tabular mt-2 text-[11.5px] leading-relaxed text-tinta2">
              CNPJ {e.cnpj} · IE {e.inscricaoEstadual}
              <br />
              {e.endereco}
              <br />
              {e.telefone} · {e.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-suave">
              {doc ? "Recibo de venda" : "Pedido"}
            </p>
            <p className="tabular text-[26px] font-bold leading-none text-tinta">
              {String(doc?.numero ?? venda.numero).padStart(5, "0")}
            </p>
            <p className="mt-1.5 text-[11.5px] text-tinta2">{dataHora(venda.data)}</p>
          </div>
        </header>

        <section className="grid gap-5 border-b border-borda py-5 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-suave">
              Destinatário
            </p>
            {cliente ? (
              <>
                <p className="text-[14px] font-bold text-tinta">{cliente.nomeRazao}</p>
                <p className="tabular mt-1 text-[11.5px] leading-relaxed text-tinta2">
                  {cliente.tipo === "PJ" ? "CNPJ" : "CPF"} {cliente.cpfCnpj}
                  {cliente.inscricaoEstadual && (
                    <>
                      <br />
                      IE {cliente.inscricaoEstadual}
                    </>
                  )}
                  <br />
                  {cliente.endereco}
                  <br />
                  {cliente.telefone}
                </p>
              </>
            ) : (
              <p className="text-[14px] font-bold text-tinta">Consumidor final</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-suave">
              Condições
            </p>
            <p className="text-[12.5px] leading-relaxed text-tinta2">
              Tabela de preço: <b>{venda.tipoPreco === "ATACADO" ? "Atacado" : "Varejo"}</b>
              <br />
              Pagamento: <b>{venda.formaPagamento}</b>
              <br />
              Operador: {estado.usuarios.find((u) => u.id === venda.usuarioId)?.nome}
            </p>
          </div>
        </section>

        <table className="mt-5 w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-tinta2">
              <th className="py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                Descrição
              </th>
              <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                Qtd
              </th>
              <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                Un.
              </th>
              <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                Valor unit.
              </th>
              <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {venda.itens.map((i) => (
              <tr key={i.id} className="border-b border-borda">
                <td className="py-2 pr-3 text-tinta">{i.descricao}</td>
                <td className="tabular py-2 text-right">{numero(i.qtd)}</td>
                <td className="py-2 text-right text-suave">UN</td>
                <td className="tabular py-2 text-right">{moeda(i.precoUnit)}</td>
                <td className="tabular py-2 text-right font-semibold text-tinta">
                  {moeda(i.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-[280px] space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-tinta2">Subtotal</dt>
              <dd className="tabular">{moeda(venda.subtotal)}</dd>
            </div>
            {venda.desconto > 0 && (
              <div className="flex justify-between">
                <dt className="text-tinta2">Desconto</dt>
                <dd className="tabular">− {moeda(venda.desconto)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t-2 border-tinta pt-2">
              <dt className="font-bold text-tinta">Total</dt>
              <dd className="tabular text-[20px] font-bold text-tinta">
                {moeda(venda.total)}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-3 text-right text-[11.5px] italic text-tinta2">
          {porExtenso(venda.total)}
        </p>

        {cascos.length > 0 && (
          <div className="mt-6 rounded border border-casco/30 bg-casco-claro/50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-casco">
              Vasilhame retornável
            </p>
            <p className="mt-1 text-[12.5px] text-tinta2">
              Saíram{" "}
              <b>{numero(cascos.reduce((a, i) => a + i.qtd, 0))} cascos</b> com esta
              venda, que permanecem em poder do cliente até a devolução.
            </p>
          </div>
        )}

        <footer className="mt-8 border-t border-borda pt-4">
          <p className="text-[10.5px] leading-relaxed text-suave">
            Documento sem valor fiscal. Emitido para controle interno e comprovação
            comercial entre as partes. Não substitui Nota Fiscal Eletrônica.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div className="border-t border-tinta2 pt-1.5 text-center text-[11px] text-tinta2">
              {e.nomeFantasia}
            </div>
            <div className="border-t border-tinta2 pt-1.5 text-center text-[11px] text-tinta2">
              Recebedor
            </div>
          </div>
        </footer>
      </div>

      <div className="nao-imprime mx-auto mt-4 max-w-[820px]">
        <Aviso tom="casco" titulo="Sobre este documento">
          Este é o recibo da fase 1 — o caminho A do blueprint. Traz CNPJ do
          emitente e do destinatário, descrição, quantidade e valores, e sai em PDF
          pelo botão de imprimir. Não é nota fiscal: a NF-e entra na fase 3, pelo
          mesmo botão, trocando só a implementação do módulo de emissão.
        </Aviso>
      </div>
    </>
  );
}
