"use client";

/**
 * Lista responsiva — o mesmo dado em duas formas.
 *
 *   md e acima   tabela, que e como se le muita linha de uma vez
 *   abaixo de md cartao empilhado, porque tabela de 8 colunas num celular de
 *                375px so mostra as duas primeiras e esconde o resto
 *
 * Toda lista do sistema passa por aqui, entao a seta de expandir, o espacamento
 * e o comportamento de clique sao identicos em vendas, entradas, clientes,
 * estoque e produtos.
 *
 * Desempenho: so a forma visivel e desenhada, e no maximo `porPagina` linhas
 * de cada vez, com um botao para carregar mais. Na impressao sai tudo.
 */

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFormato } from "./useFormato";

export type PapelColuna =
  /** vira o titulo do cartao no celular */
  | "titulo"
  /** linha fina logo abaixo do titulo */
  | "apoio"
  /** valor grande a direita do titulo */
  | "destaque"
  /** entra na grade de rotulo + valor */
  | "normal"
  /** aparece so na tabela, some no celular */
  | "sóTabela"
  /** aparece so no cartao do celular, some na tabela */
  | "sóCartao";

export interface ColunaLista<T> {
  chave: string;
  titulo: string;
  alinha?: "left" | "right" | "center";
  papel?: PapelColuna;
  render: (linha: T) => ReactNode;
}

interface Props<T> {
  colunas: ColunaLista<T>[];
  linhas: T[];
  chave: (linha: T) => string;
  /** Se existir, a linha ganha seta e abre mostrando este conteudo. */
  detalhe?: (linha: T) => ReactNode;
  /** Abre esta linha assim que a lista monta. */
  abertaInicial?: string | null;
  vazio?: string;
  /** Quantas linhas desenhar antes do "mostrar mais". */
  porPagina?: number;
}

export function Lista<T>({
  colunas,
  linhas,
  chave,
  detalhe,
  abertaInicial = null,
  vazio = "Nada encontrado.",
  porPagina = 50,
}: Props<T>) {
  const { formato, imprimindo } = useFormato();
  const [aberta, setAberta] = useState<string | null>(abertaInicial);
  const expansivel = Boolean(detalhe);

  // a linha aberta pela URL precisa estar dentro do que foi desenhado
  const minimo = () => {
    const i = aberta ? linhas.findIndex((l) => chave(l) === aberta) : -1;
    return Math.max(porPagina, i + 1);
  };
  const [limite, setLimite] = useState(minimo);

  // filtro mudou: volta para a primeira pagina
  const assinatura = `${linhas.length}|${linhas[0] ? chave(linhas[0]) : ""}`;
  const [assinaturaVista, setAssinaturaVista] = useState(assinatura);
  if (assinatura !== assinaturaVista) {
    setAssinaturaVista(assinatura);
    setLimite(minimo());
  }

  const alternar = (id: string) =>
    setAberta((atual) => (atual === id ? null : id));

  const titulo = colunas.find((c) => c.papel === "titulo") ?? colunas[0];
  // sóCartao entra como linha de apoio: existe justamente para aparecer
  // aqui e sumir da tabela
  const apoio = colunas.filter(
    (c) => c.papel === "apoio" || c.papel === "sóCartao",
  );
  const destaque = colunas.find((c) => c.papel === "destaque");
  const normais = colunas
    .filter((c) => !c.papel || c.papel === "normal")
    .filter((c) => c !== titulo);
  const daTabela = colunas.filter((c) => c.papel !== "sóCartao");

  if (linhas.length === 0) {
    return (
      <div className="rounded-lg border border-borda bg-superficie px-4 py-12 text-center text-sm text-suave">
        {vazio}
      </div>
    );
  }

  const visiveis = imprimindo ? linhas : linhas.slice(0, limite);
  const faltam = linhas.length - visiveis.length;

  const maisBotao =
    faltam > 0 ? (
      <div className="nao-imprime mt-3 flex flex-col items-center gap-1">
        <button
          onClick={() => setLimite((l) => l + porPagina)}
          className="transicao rounded-md border border-borda2 bg-superficie px-4 py-2 text-[13px] font-semibold text-tinta2 hover:border-marca hover:text-marca"
        >
          Mostrar mais {Math.min(porPagina, faltam)}
        </button>
        <span className="text-[11.5px] text-suave">
          mostrando {visiveis.length} de {linhas.length}
        </span>
      </div>
    ) : null;

  if (formato === "cartao") {
    return (
      <>
        <ul className="flex flex-col gap-2">
          {visiveis.map((linha) => {
            const id = chave(linha);
            const expandida = aberta === id;
            return (
              <li
                key={id}
                id={`item-${id}`}
                className="overflow-hidden rounded-lg border border-borda bg-superficie"
              >
                <div
                  className={expansivel ? "cursor-pointer select-none" : ""}
                  onClick={expansivel ? () => alternar(id) : undefined}
                  role={expansivel ? "button" : undefined}
                  tabIndex={expansivel ? 0 : undefined}
                  aria-expanded={expansivel ? expandida : undefined}
                  onKeyDown={
                    expansivel
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            alternar(id);
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {expansivel && (
                        <span className="mt-0.5 shrink-0 text-suave">
                          {expandida ? (
                            <ChevronDown size={15} />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-tinta">
                          {titulo.render(linha)}
                        </div>
                        {apoio.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-suave">
                            {apoio.map((c) => (
                              <span key={c.chave}>{c.render(linha)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {destaque && (
                      <div className="tabular shrink-0 text-right text-[15px] font-semibold text-tinta">
                        {destaque.render(linha)}
                      </div>
                    )}
                  </div>

                  {normais.length > 0 && (
                    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-borda px-3.5 py-2.5">
                      {normais.map((c) => (
                        <div key={c.chave} className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-suave">
                            {c.titulo}
                          </dt>
                          <dd className="tabular truncate text-[13px] text-tinta2">
                            {c.render(linha)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                {expansivel && expandida && (
                  <div className="border-t border-borda bg-superficie2/40 px-3.5 py-3">
                    {detalhe!(linha)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {maisBotao}
      </>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {expansivel && <Cabeca className="w-8" />}
              {daTabela.map((c) => (
                <Cabeca key={c.chave} alinha={c.alinha}>
                  {c.titulo}
                </Cabeca>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => {
              const id = chave(linha);
              const expandida = aberta === id;
              return (
                <Fragment key={id}>
                  <tr
                    id={`linha-${id}`}
                    className={`transicao ${expansivel ? "cursor-pointer select-none" : ""} ${
                      expandida ? "bg-marca-clara/40" : "hover:bg-superficie2/60"
                    }`}
                    onClick={expansivel ? () => alternar(id) : undefined}
                    aria-expanded={expansivel ? expandida : undefined}
                  >
                    {expansivel && (
                      <Celula className="w-8 text-suave">
                        {expandida ? (
                          <ChevronDown size={15} />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                      </Celula>
                    )}
                    {daTabela.map((c) => (
                      <Celula key={c.chave} alinha={c.alinha}>
                        {c.render(linha)}
                      </Celula>
                    ))}
                  </tr>
                  {expansivel && expandida && (
                    <tr>
                      <td
                        colSpan={daTabela.length + 1}
                        className="border-b border-borda bg-superficie2/40 px-5 py-4"
                      >
                        {detalhe!(linha)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {maisBotao}
    </>
  );
}

function Cabeca({
  children,
  alinha = "left",
  className = "",
}: {
  children?: ReactNode;
  alinha?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-borda2 bg-superficie2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-suave ${
        alinha === "right"
          ? "text-right"
          : alinha === "center"
            ? "text-center"
            : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Celula({
  children,
  alinha = "left",
  className = "",
}: {
  children?: ReactNode;
  alinha?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={`border-b border-borda px-4 py-2.5 align-middle text-tinta2 ${
        alinha === "right"
          ? "tabular text-right"
          : alinha === "center"
            ? "text-center"
            : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * Lista interna do bloco expandido — itens de uma venda, produtos de uma carga.
 * Segue a mesma regra da Lista: tabela no desktop, empilhado no celular, e so
 * a forma visivel e desenhada.
 */
export interface ColunaSub<T> {
  chave: string;
  titulo: string;
  alinha?: "left" | "right";
  papel?: "titulo" | "apoio" | "destaque" | "normal" | "sóTabela";
  render: (item: T) => ReactNode;
}

export function SubLista<T>({
  itens,
  chave,
  colunas,
}: {
  itens: T[];
  chave: (item: T) => string;
  colunas: ColunaSub<T>[];
}) {
  const { formato } = useFormato();
  const titulo = colunas.find((c) => c.papel === "titulo") ?? colunas[0];
  const apoio = colunas.filter((c) => c.papel === "apoio");
  const destaque = colunas.find((c) => c.papel === "destaque");
  const normais = colunas.filter(
    (c) => (!c.papel || c.papel === "normal") && c !== titulo,
  );

  if (formato === "cartao") {
    return (
      <ul className="flex flex-col gap-2.5">
        {itens.map((i) => (
          <li
            key={chave(i)}
            className="rounded-md border border-borda bg-superficie px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold leading-snug text-tinta">
                  {titulo.render(i)}
                </div>
                {apoio.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-suave">
                    {apoio.map((c) => (
                      <span key={c.chave}>{c.render(i)}</span>
                    ))}
                  </div>
                )}
              </div>
              {destaque && (
                <div className="tabular shrink-0 text-right text-[13.5px] font-semibold text-tinta">
                  {destaque.render(i)}
                </div>
              )}
            </div>
            {normais.length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-borda pt-2">
                {normais.map((c) => (
                  <div key={c.chave} className="flex items-baseline gap-1.5">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.05em] text-suave">
                      {c.titulo}
                    </dt>
                    <dd className="tabular text-[12.5px] text-tinta2">
                      {c.render(i)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-borda2">
            {colunas.map((c) => (
              <th
                key={c.chave}
                className={`whitespace-nowrap py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-suave ${
                  c.alinha === "right" ? "text-right" : "pr-3 text-left"
                }`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={chave(i)} className="border-b border-borda/70 last:border-b-0">
              {colunas.map((c) => (
                <td
                  key={c.chave}
                  className={`py-1.5 ${
                    c.alinha === "right" ? "tabular text-right" : "pr-3 text-left"
                  }`}
                >
                  {c.render(i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
