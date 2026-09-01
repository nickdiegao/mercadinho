"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Receipt,
  Unlock,
} from "lucide-react";
import { useEstado } from "@/lib/store";
import { resumoCaixa } from "@/lib/consultas";
import { moeda, dataHora, hora, data } from "@/lib/formato";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Cartao,
  Entrada,
  Etiqueta,
  Indicador,
  Rolagem,
  Tabela,
  Td,
  Th,
  TituloCartao,
  Vazio,
} from "@/components/ui";

const paraCentavos = (t: string) =>
  Math.round((parseFloat(t.replace(",", ".")) || 0) * 100);

export default function Caixa() {
  const { estado, lancarCaixa, fecharCaixa, abrirCaixa } = useEstado();
  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contado, setContado] = useState("");
  const [fundo, setFundo] = useState("200,00");

  const r = useMemo(() => resumoCaixa(estado), [estado]);

  const anteriores = useMemo(
    () =>
      estado.caixaSessoes
        .filter((s) => s.status === "FECHADA")
        .sort((a, b) => (b.fechadaEm ?? "").localeCompare(a.fechadaEm ?? ""))
        .slice(0, 10),
    [estado.caixaSessoes],
  );

  if (!r) {
    return (
      <>
        <Cabecalho titulo="Caixa" descricao="Nenhum caixa aberto no momento." />
        <Cartao className="max-w-md">
          <TituloCartao>Abrir caixa</TituloCartao>
          <Campo rotulo="Fundo de troco (R$)" dica="Dinheiro que já está na gaveta ao abrir">
            <Entrada
              inputMode="decimal"
              value={fundo}
              onChange={(e) => setFundo(e.target.value)}
            />
          </Campo>
          <Botao
            variante="primario"
            onClick={() => abrirCaixa(paraCentavos(fundo))}
            className="mt-4 w-full"
          >
            <Unlock size={15} /> Abrir caixa
          </Botao>
        </Cartao>
      </>
    );
  }

  const { sessao, movimentos, esperado, faturado, sangrias, despesas } = r;
  const diferencaPrevia = contado ? paraCentavos(contado) - esperado : null;

  function lancar(tipo: "SANGRIA" | "SUPRIMENTO" | "DESPESA") {
    const v = paraCentavos(valorTexto);
    if (!v || !descricao.trim()) return;
    lancarCaixa(tipo, tipo === "SUPRIMENTO" ? v : -v, descricao.trim());
    setValorTexto("");
    setDescricao("");
  }

  return (
    <>
      <Cabecalho
        titulo="Caixa"
        descricao={`Sessão aberta em ${dataHora(sessao.abertaEm)} por ${estado.usuarios.find((u) => u.id === sessao.usuarioId)?.nome}.`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Esperado na gaveta"
          valor={moeda(esperado)}
          detalhe="só dinheiro vivo entra nesta conta"
        />
        <Indicador
          rotulo="Faturado na sessão"
          valor={moeda(faturado)}
          detalhe="todas as formas de pagamento"
          tom="positivo"
        />
        <Indicador
          rotulo="Sangrias"
          valor={moeda(sangrias)}
          detalhe="retiradas para o cofre"
          tom="negativo"
        />
        <Indicador
          rotulo="Despesas"
          valor={moeda(despesas)}
          detalhe="pagas direto do caixa"
          tom="negativo"
        />
      </div>

      <div className="mb-4">
        <Aviso titulo="Por que o faturado não bate com o esperado">
          PIX, débito e crédito entram no faturamento mas não caem na gaveta — o
          dinheiro chega pela maquininha ou pela conta. Só dinheiro vivo compõe o
          valor a conferir no fechamento. Venda fiada não entra em nenhum dos
          dois: ela é lucro hoje e caixa só quando o cliente pagar.
        </Aviso>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
        <Cartao padding={false}>
          <div className="p-5 pb-3">
            <TituloCartao extra={<span className="text-[11px] text-suave">{movimentos.length} lançamentos</span>}>
              Movimentos da sessão
            </TituloCartao>
          </div>
          <Rolagem>
            <Tabela>
              <thead>
                <tr>
                  <Th>Hora</Th>
                  <Th>Tipo</Th>
                  <Th>Descrição</Th>
                  <Th>Forma</Th>
                  <Th alinha="right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {[...movimentos].reverse().map((m) => (
                  <tr key={m.id} className="transicao hover:bg-superficie2/60">
                    <Td className="whitespace-nowrap text-suave">{hora(m.data)}</Td>
                    <Td>
                      <Etiqueta
                        tom={
                          m.tipo === "VENDA"
                            ? "positivo"
                            : m.tipo === "SUPRIMENTO"
                              ? "marca"
                              : "negativo"
                        }
                      >
                        {m.tipo}
                      </Etiqueta>
                    </Td>
                    <Td className="max-w-[260px] truncate">{m.descricao}</Td>
                    <Td className="text-suave">{m.formaPagamento ?? "—"}</Td>
                    <Td
                      alinha="right"
                      className={`font-semibold ${m.valor >= 0 ? "text-positivo" : "text-negativo"}`}
                    >
                      {moeda(m.valor)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            {movimentos.length === 0 && <Vazio>Nenhum movimento nesta sessão ainda.</Vazio>}
          </Rolagem>
        </Cartao>

        <div className="flex flex-col gap-4">
          <Cartao>
            <TituloCartao>Lançar movimento</TituloCartao>
            <div className="space-y-3">
              <Campo rotulo="Valor (R$)">
                <Entrada
                  inputMode="decimal"
                  value={valorTexto}
                  onChange={(e) => setValorTexto(e.target.value)}
                  placeholder="0,00"
                />
              </Campo>
              <Campo rotulo="Descrição">
                <Entrada
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: combustível da entrega"
                />
              </Campo>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <Botao tamanho="sm" onClick={() => lancar("SANGRIA")}>
                <ArrowUpCircle size={13} /> Sangria
              </Botao>
              <Botao tamanho="sm" onClick={() => lancar("SUPRIMENTO")}>
                <ArrowDownCircle size={13} /> Suprir
              </Botao>
              <Botao tamanho="sm" onClick={() => lancar("DESPESA")}>
                <Receipt size={13} /> Despesa
              </Botao>
            </div>
          </Cartao>

          <Cartao>
            <TituloCartao>Fechamento</TituloCartao>
            <Campo
              rotulo="Valor contado na gaveta (R$)"
              dica="Conte o dinheiro e digite aqui, sem olhar o esperado"
            >
              <Entrada
                inputMode="decimal"
                value={contado}
                onChange={(e) => setContado(e.target.value)}
                placeholder="0,00"
              />
            </Campo>

            {diferencaPrevia !== null && (
              <div
                className={`mt-3 rounded-md px-3 py-2.5 ${
                  diferencaPrevia === 0
                    ? "bg-positivo-claro"
                    : Math.abs(diferencaPrevia) < 500
                      ? "bg-superficie2"
                      : "bg-alerta-claro"
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-suave">
                  Diferença
                </p>
                <p
                  className={`tabular text-lg font-semibold ${
                    diferencaPrevia === 0
                      ? "text-positivo"
                      : Math.abs(diferencaPrevia) < 500
                        ? "text-tinta"
                        : "text-alerta"
                  }`}
                >
                  {diferencaPrevia > 0 ? "+" : ""}
                  {moeda(diferencaPrevia)}
                </p>
                <p className="mt-0.5 text-[11.5px] text-suave">
                  esperado {moeda(esperado)}
                </p>
              </div>
            )}

            <Botao
              variante="primario"
              onClick={() => {
                fecharCaixa(paraCentavos(contado));
                setContado("");
              }}
              disabled={!contado}
              className="mt-3 w-full"
            >
              <Lock size={15} /> Fechar caixa
            </Botao>
          </Cartao>
        </div>
      </div>

      <Cartao className="mt-6" padding={false}>
        <div className="p-5 pb-3">
          <TituloCartao>Fechamentos anteriores</TituloCartao>
        </div>
        <Rolagem>
          <Tabela>
            <thead>
              <tr>
                <Th>Dia</Th>
                <Th>Operador</Th>
                <Th alinha="right">Fundo</Th>
                <Th alinha="right">Esperado</Th>
                <Th alinha="right">Contado</Th>
                <Th alinha="right">Diferença</Th>
              </tr>
            </thead>
            <tbody>
              {anteriores.map((s) => {
                const rr = resumoCaixa(estado, s.id);
                const dif = rr?.diferenca ?? 0;
                return (
                  <tr key={s.id} className="transicao hover:bg-superficie2/60">
                    <Td className="whitespace-nowrap">{data(s.abertaEm)}</Td>
                    <Td className="text-suave">
                      {estado.usuarios.find((u) => u.id === s.usuarioId)?.nome}
                    </Td>
                    <Td alinha="right" className="text-suave">
                      {moeda(s.fundoTroco)}
                    </Td>
                    <Td alinha="right">{moeda(rr?.esperado ?? 0)}</Td>
                    <Td alinha="right" className="font-medium text-tinta">
                      {moeda(s.valorContado ?? 0)}
                    </Td>
                    <Td
                      alinha="right"
                      className={
                        dif === 0
                          ? "text-suave"
                          : Math.abs(dif) < 500
                            ? "text-negativo"
                            : "font-semibold text-alerta"
                      }
                    >
                      {dif > 0 ? "+" : ""}
                      {moeda(dif)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        </Rolagem>
      </Cartao>
    </>
  );
}
