"use client";

/**
 * Painel de formulario. Desliza pela direita no desktop e ocupa a tela no
 * celular. Todo cadastro do sistema abre aqui, para o operador nunca perder a
 * tela em que estava — cadastrar um cliente no meio da venda nao pode jogar a
 * venda fora.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  aberto,
  titulo,
  descricao,
  onFechar,
  children,
  rodape,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // foco no primeiro campo, para ja sair digitando. O efeito roda depois do
    // formulario estar no DOM, entao nao precisa esperar quadro nenhum.
    painel.current
      ?.querySelector<HTMLElement>(
        "input:not([disabled]):not([type=checkbox]), select:not([disabled]), textarea",
      )
      ?.focus();
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="nao-imprime fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-marca-escura/45"
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative flex h-full w-full flex-col bg-papel shadow-2xl sm:max-w-[540px]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-borda bg-superficie px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-tinta">{titulo}</h2>
            {descricao && (
              <p className="mt-0.5 text-[12.5px] leading-snug text-suave">{descricao}</p>
            )}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="transicao -mr-1 rounded-md p-1.5 text-suave hover:bg-superficie2 hover:text-tinta"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {rodape && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-borda bg-superficie px-5 py-3.5">
            {rodape}
          </footer>
        )}
      </div>
    </div>
  );
}
