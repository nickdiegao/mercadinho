"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Ban, FileText, MessageCircle, Printer, Share2, Snowflake } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { resumoCaixa } from "@/lib/consultas";
import { imprimirBobina, imprimirPdf } from "@/lib/exportar";
import { moeda, numero, dataHora, porExtenso } from "@/lib/formato";
import { comoVendido } from "@/lib/embalagem";
import { apenasDigitos } from "@/lib/documentos";
import type { Cliente, Empresa, Venda } from "@/lib/tipos";
import { Aviso, Botao, Campo } from "@/components/ui";
import { Modal } from "@/components/modal";
import { ReciboBobina } from "@/components/recibo-bobina";

const FORMA: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  FIADO: "Fiado",
};

export default function Recibo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { estado } = useEstado();
  const { podeVerLucro, podeCancelarVenda } = usePerfil();
  const [cancelando, setCancelando] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

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

  const doc = estado.documentos.find((d) => d.vendaId === venda.id);
  // documento emitido nunca muda: vale a copia congelada no momento da venda,
  // mesmo que o cadastro do cliente seja editado depois
  const e: Empresa = doc?.emitenteSnapshot ?? estado.empresa;
  const cliente: Cliente | null =
    doc?.destinatarioSnapshot ??
    estado.clientes.find((c) => c.id === venda.clienteId) ??
    null;
  const cascos = venda.itens.filter(
    (i) => estado.produtos.find((p) => p.id === i.produtoId)?.vasilhameId,
  );
  const totalCascos = cascos.reduce((a, i) => a + i.qtd, 0);
  const cancelada = venda.status === "CANCELADA";
  const numeroDoc = String(doc?.numero ?? venda.numero).padStart(5, "0");
  const titulo = cancelada ? "Venda cancelada" : doc ? "Recibo de venda" : "Pedido";
  const operador = estado.usuarios.find((u) => u.id === venda.usuarioId)?.nome;

  const texto = textoRecibo(venda, e, cliente, numeroDoc, totalCascos);
  const telefone = cliente ? apenasDigitos(cliente.telefone) : "";
  const linkWhats =
    `https://wa.me/${telefone.length >= 10 ? `55${telefone}` : ""}` +
    `?text=${encodeURIComponent(texto)}`;

  return (
    <>
      <div className="nao-imprime mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href="/vendas"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-suave hover:text-marca"
        >
          <ArrowLeft size={15} /> Vendas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {podeVerLucro && !cancelada && (
            <span className="mr-1 w-full text-[13px] text-suave sm:w-auto">
              Lucro desta venda{" "}
              <span className="tabular font-semibold text-positivo">
                {moeda(venda.total - venda.custoTotal)}
              </span>
            </span>
          )}
          {podeCancelarVenda && !cancelada && (
            <Botao variante="perigo" onClick={() => setCancelando(true)}>
              <Ban size={15} /> Cancelar venda
            </Botao>
          )}
          <a
            href={linkWhats}
            target="_blank"
            rel="noopener noreferrer"
            className="transicao inline-flex items-center justify-center gap-2 rounded-md border border-borda2 bg-superficie px-3.5 py-2 text-sm font-semibold text-tinta2 hover:border-positivo hover:text-positivo"
            title={
              telefone.length >= 10
                ? `Abre a conversa com ${cliente?.nomeRazao}`
                : "Abre o WhatsApp para escolher o contato"
            }
          >
            <MessageCircle size={15} /> WhatsApp
          </a>
          {podeCompartilhar && (
            <Botao
              onClick={() =>
                navigator
                  .share({ title: `Recibo ${numeroDoc}`, text: texto })
                  .catch(() => {})
              }
            >
              <Share2 size={15} /> Compartilhar
            </Botao>
          )}
          <Botao onClick={imprimirPdf} title="Abre o diálogo de impressão; escolha Salvar como PDF">
            <FileText size={15} /> A4 ou PDF
          </Botao>
          <Botao variante="primario" onClick={imprimirBobina} title="Para a impressora de bobina, papel de 80 mm">
            <Printer size={15} /> Imprimir recibo
          </Botao>
        </div>
      </div>

      {cancelada && (
        <div className="nao-imprime mx-auto mb-4 max-w-[820px]">
          <Aviso tom="alerta" titulo="Esta venda foi cancelada">
            Cancelada em {dataHora(venda.canceladaEm!)} por{" "}
            {estado.usuarios.find((u) => u.id === venda.canceladaPor)?.nome}.
            Motivo: <b>{venda.motivoCancelamento}</b>. Os itens voltaram para o
            estoque{venda.formaPagamento !== "FIADO" && " e o valor saiu do caixa como estorno"}.
          </Aviso>
        </div>
      )}

      {/* ---------------------------------------------------- folha A4 */}
      <div className="folha relative mx-auto max-w-[820px] overflow-hidden rounded-lg border border-borda bg-white p-5 shadow-[0_1px_2px_rgba(15,20,28,0.04)] sm:p-10">
        {cancelada && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] select-none whitespace-nowrap rounded-lg border-4 border-alerta/35 px-8 py-2 text-5xl font-extrabold tracking-[0.18em] text-alerta/25 sm:text-7xl"
          >
            CANCELADA
          </div>
        )}

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
              {titulo}
            </p>
            <p className="tabular text-[26px] font-bold leading-none text-tinta">
              {numeroDoc}
            </p>
            <p className="mt-1.5 text-[11.5px] text-tinta2">{dataHora(venda.data)}</p>
            {/* o recibo tem numeracao propria; o numero da venda e o da lista */}
            {doc && doc.numero !== venda.numero && (
              <p className="text-[11.5px] text-suave">
                venda nº {String(venda.numero).padStart(5, "0")}
              </p>
            )}
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
                  {cliente.cpfCnpj && (
                    <>
                      {cliente.tipo === "PJ" ? "CNPJ" : "CPF"} {cliente.cpfCnpj}
                    </>
                  )}
                  {cliente.inscricaoEstadual && (
                    <>
                      <br />
                      IE {cliente.inscricaoEstadual}
                    </>
                  )}
                  {cliente.endereco && (
                    <>
                      <br />
                      {cliente.endereco}
                    </>
                  )}
                  {cliente.telefone && (
                    <>
                      <br />
                      {cliente.telefone}
                    </>
                  )}
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
              Pagamento: <b>{FORMA[venda.formaPagamento]}</b>
              <br />
              Operador: {operador}
            </p>
          </div>
        </section>

        <div className="-mx-1 mt-5 overflow-x-auto px-1">
          <table className="w-full min-w-[440px] text-[12.5px]">
            <thead>
              <tr className="border-b border-tinta2">
                <Th>Descrição</Th>
                <Th direita>Qtd</Th>
                <Th direita>Un.</Th>
                <Th direita>Valor unit.</Th>
                <Th direita>Total</Th>
              </tr>
            </thead>
            <tbody>
              {venda.itens.map((i) => {
                const q = comoVendido(i);
                return (
                <tr key={i.id} className="border-b border-borda">
                  <td className="py-2 pr-3 text-tinta">
                    {i.descricao}
                    {i.gelado && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-marca">
                        <Snowflake size={10} /> gelado
                      </span>
                    )}
                  </td>
                  <td className="tabular py-2 text-right">{numero(q.qtd)}</td>
                  <td className="py-2 text-right text-suave">
                    {q.unidade}
                    {q.fator > 1 && (
                      <span className="block text-[10.5px] leading-tight">c/ {q.fator}</span>
                    )}
                  </td>
                  <td className="tabular py-2 text-right">{moeda(q.precoUnit)}</td>
                  <td className="tabular py-2 text-right font-semibold text-tinta">
                    {moeda(i.total)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
              <dd
                className={`tabular text-[20px] font-bold ${cancelada ? "text-suave line-through" : "text-tinta"}`}
              >
                {moeda(venda.total)}
              </dd>
            </div>
          </dl>
        </div>

        <p className="mt-3 text-right text-[11.5px] italic text-tinta2">
          {porExtenso(venda.total)}
        </p>

        {totalCascos > 0 && (
          <div className="mt-6 rounded border border-casco/30 bg-casco-claro/50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-casco">
              Vasilhame retornável
            </p>
            <p className="mt-1 text-[12.5px] text-tinta2">
              {cancelada ? (
                <>
                  Os <b>{numero(totalCascos)} cascos</b> desta venda voltaram ao
                  depósito com o cancelamento.
                </>
              ) : (
                <>
                  Saíram <b>{numero(totalCascos)} cascos</b> com esta venda, que
                  permanecem em poder do cliente até a devolução.
                </>
              )}
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
          <b>Imprimir recibo</b> sai na impressora de bobina, em papel de 80 mm. O
          botão <b>WhatsApp</b> abre a conversa com o cliente já com o recibo
          escrito — basta enviar. Para mandar o arquivo em PDF, use{" "}
          <b>A4 ou PDF</b>, salve e anexe na conversa. Não é nota fiscal: a NF-e
          entra numa etapa própria do projeto.
        </Aviso>
      </div>

      <ReciboBobina
        venda={venda}
        empresa={e}
        cliente={cliente}
        titulo={titulo}
        numeroDoc={numeroDoc}
        pagamento={FORMA[venda.formaPagamento]}
        operador={operador}
        cascos={totalCascos}
      />
      <CancelarVenda aberto={cancelando} venda={venda} onFechar={() => setCancelando(false)} />
    </>
  );
}

function Th({ children, direita }: { children: React.ReactNode; direita?: boolean }) {
  return (
    <th
      className={`py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-suave ${
        direita ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/** Recibo em texto, com a formatacao que o WhatsApp entende (*negrito*). */
function textoRecibo(
  v: Venda,
  e: Empresa,
  cliente: Cliente | null,
  numeroDoc: string,
  cascos: number,
) {
  const linhas = [
    `*${e.nomeFantasia}* — Recibo nº ${numeroDoc}`,
    dataHora(v.data),
    "",
    `Cliente: ${cliente?.nomeRazao ?? "Consumidor final"}`,
    "",
    ...v.itens.map((i) => {
      const q = comoVendido(i);
      const quanto =
        q.fator > 1
          ? `${numero(q.qtd)} ${q.unidade.toLowerCase()} c/${q.fator}`
          : `${numero(i.qtd)}×`;
      return `${quanto} ${i.descricao}${i.gelado ? " (gelado)" : ""} — ${moeda(i.total)}`;
    }),
    "",
    ...(v.desconto > 0 ? [`Desconto: − ${moeda(v.desconto)}`] : []),
    `*Total: ${moeda(v.total)}*`,
    `Pagamento: ${FORMA[v.formaPagamento]}`,
    ...(cascos > 0 ? [`Cascos a devolver: ${numero(cascos)}`] : []),
    ...(v.status === "CANCELADA" ? ["", "*VENDA CANCELADA*"] : []),
    "",
    `${e.razaoSocial} — CNPJ ${e.cnpj}`,
    "Documento sem valor fiscal.",
  ];
  return linhas.join("\n");
}

function CancelarVenda({
  aberto,
  venda,
  onFechar,
}: {
  aberto: boolean;
  venda: Venda;
  onFechar: () => void;
}) {
  const { estado, cancelarVenda } = useEstado();
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);

  const caixa = resumoCaixa(estado);
  const unidades = venda.itens.reduce((a, i) => a + i.qtd, 0);
  const cascos = venda.itens
    .filter((i) => estado.produtos.find((p) => p.id === i.produtoId)?.vasilhameId)
    .reduce((a, i) => a + i.qtd, 0);
  const fiado = venda.formaPagamento === "FIADO";
  const dinheiro = venda.formaPagamento === "DINHEIRO";

  async function confirmar() {
    setTentou(true);
    if (motivo.trim().length < 3) return;
    try {
      await cancelarVenda(venda.id, motivo.trim());
      setMotivo("");
      onFechar();
    } catch {
      /* o motivo ja apareceu no aviso; o painel continua aberto */
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={`Cancelar a venda ${String(venda.numero).padStart(5, "0")}`}
      descricao="Nada é apagado: a venda fica na lista marcada como cancelada, com o motivo e quem cancelou."
      onFechar={onFechar}
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-suave">
            O que vai acontecer
          </p>
          <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-tinta2">
            <li>
              <b className="text-tinta">{numero(unidades)} unidades</b> voltam para o
              estoque, pelo mesmo custo médio de hoje.
            </li>
            {cascos > 0 && (
              <li>
                <b className="text-tinta">{numero(cascos)} cascos</b> saem da conta
                de &ldquo;na rua&rdquo;.
              </li>
            )}
            <li>
              {fiado ? (
                <>
                  Foi fiado: nada sai do caixa, e a dívida de{" "}
                  <b className="text-tinta">{moeda(venda.total)}</b> deixa de existir.
                </>
              ) : caixa ? (
                <>
                  <b className="text-tinta">{moeda(venda.total)}</b> saem do caixa
                  aberto como estorno.{" "}
                  {dinheiro
                    ? "Devolva o dinheiro ao cliente da gaveta."
                    : `Foi ${FORMA[venda.formaPagamento]}: devolva pela maquininha ou pela conta — a gaveta não muda.`}
                </>
              ) : (
                <span className="text-alerta">
                  Não há caixa aberto: o estorno de {moeda(venda.total)} não vai
                  aparecer em nenhum caixa. Abra o caixa antes, se for devolver dinheiro.
                </span>
              )}
            </li>
            <li>A venda sai do faturamento, do lucro e dos relatórios.</li>
          </ul>
        </div>

        <Campo rotulo="Motivo do cancelamento (obrigatório)">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex.: cliente desistiu na hora; lançado o produto errado"
            className="w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-suave/60 focus:border-marca focus:outline-none"
          />
        </Campo>
        {tentou && motivo.trim().length < 3 && (
          <p className="-mt-2 text-[12px] font-medium text-alerta">
            Escreva o motivo — ele fica registrado na venda e na auditoria.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-borda pt-4">
          <Botao onClick={onFechar}>Voltar</Botao>
          <Botao variante="perigo" onClick={confirmar}>
            <Ban size={15} /> Confirmar cancelamento
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
