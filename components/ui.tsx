"use client";

import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

// ---------------------------------------------------------------- cabecalho
export function Cabecalho({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="nao-imprime mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-borda pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-tinta">{titulo}</h1>
        {descricao && (
          <p className="mt-1 max-w-2xl text-sm text-suave">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- cartao
export function Cartao({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-borda bg-superficie shadow-[0_1px_2px_rgba(15,20,28,0.04)] ${padding ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function TituloCartao({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.07em] text-suave">
        {children}
      </h2>
      {extra}
    </div>
  );
}

// ---------------------------------------------------------------- indicador
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
  icone,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "positivo" | "negativo" | "alerta" | "casco";
  icone?: ReactNode;
}) {
  const cor = {
    neutro: "text-tinta",
    positivo: "text-positivo",
    negativo: "text-negativo",
    alerta: "text-alerta",
    casco: "text-casco",
  }[tom];

  return (
    <Cartao>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-suave">
          {rotulo}
        </p>
        {icone && <span className="text-suave">{icone}</span>}
      </div>
      <p className={`tabular mt-2 text-[26px] font-semibold leading-none ${cor}`}>
        {valor}
      </p>
      {detalhe && <p className="mt-2 text-xs text-suave">{detalhe}</p>}
    </Cartao>
  );
}

// ---------------------------------------------------------------- etiqueta
const TONS = {
  neutro: "bg-superficie2 text-suave",
  marca: "bg-marca-clara text-marca",
  positivo: "bg-positivo-claro text-positivo",
  negativo: "bg-negativo-claro text-negativo",
  alerta: "bg-alerta-claro text-alerta",
  casco: "bg-casco-claro text-casco",
} as const;

export function Etiqueta({
  children,
  tom = "neutro",
}: {
  children: ReactNode;
  tom?: keyof typeof TONS;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] ${TONS[tom]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- botao
type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  tamanho?: "md" | "sm";
};

export function Botao({
  variante = "secundario",
  tamanho = "md",
  className = "",
  ...props
}: BotaoProps) {
  const base =
    "transicao inline-flex items-center justify-center gap-2 rounded-md font-semibold disabled:cursor-not-allowed disabled:opacity-45";
  const tam = tamanho === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const v = {
    primario: "bg-marca text-white hover:bg-marca-media",
    secundario:
      "border border-borda2 bg-superficie text-tinta2 hover:border-marca hover:text-marca",
    fantasma: "text-suave hover:bg-superficie2 hover:text-tinta",
    perigo: "border border-alerta/40 bg-alerta-claro text-alerta hover:bg-alerta hover:text-white",
  }[variante];
  return <button className={`${base} ${tam} ${v} ${className}`} {...props} />;
}

// ---------------------------------------------------------------- campos
export function Campo({
  rotulo,
  dica,
  children,
  className = "",
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.07em] text-suave">
        {rotulo}
      </span>
      {children}
      {dica && <span className="mt-1 block text-[11px] text-suave">{dica}</span>}
    </label>
  );
}

const entradaBase =
  "w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-tinta placeholder:text-suave/60 focus:border-marca focus:outline-none";

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${entradaBase} ${className}`} {...rest} />;
}

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`${entradaBase} ${className}`} {...rest} />;
}

// ---------------------------------------------------------------- tabela
export function Rolagem({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
      {children}
    </div>
  );
}

export function Tabela({ children }: { children: ReactNode }) {
  return <table className="w-full min-w-[640px] text-sm">{children}</table>;
}

export function Th({
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
        alinha === "right" ? "text-right" : alinha === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  alinha = "left",
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  alinha?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-borda px-4 py-2.5 align-middle text-tinta2 ${
        alinha === "right" ? "tabular text-right" : alinha === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-suave">{children}</div>
  );
}

// ---------------------------------------------------------------- barra
/** Barra horizontal proporcional, para rankings. */
export function Barra({ fracao, tom = "marca" }: { fracao: number; tom?: "marca" | "positivo" }) {
  const cor = tom === "positivo" ? "bg-positivo" : "bg-marca";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-superficie2">
      <div
        className={`h-full rounded-full ${cor}`}
        style={{ width: `${Math.max(2, Math.min(100, fracao * 100))}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- aviso
export function Aviso({
  tom = "marca",
  titulo,
  children,
}: {
  tom?: "marca" | "alerta" | "positivo" | "casco";
  titulo?: string;
  children: ReactNode;
}) {
  const borda = {
    marca: "border-l-marca",
    alerta: "border-l-alerta",
    positivo: "border-l-positivo",
    casco: "border-l-casco",
  }[tom];
  return (
    <div
      className={`rounded-r-md border border-l-[3px] border-borda bg-superficie px-4 py-3 ${borda}`}
    >
      {titulo && <p className="text-sm font-bold text-tinta">{titulo}</p>}
      <div className="text-[13px] leading-relaxed text-tinta2">{children}</div>
    </div>
  );
}
