"use client";

/**
 * Qual forma a lista deve ter agora: cartao no celular, tabela no desktop.
 *
 * Antes cada lista desenhava as duas versoes e escondia uma com CSS. Na tela
 * de vendas isso dava 11 mil elementos no DOM e ~140 ms para apagar a busca.
 * Agora so a versao visivel existe.
 *
 * Na impressao vale sempre a tabela, com todas as linhas. O flushSync garante
 * que o DOM ja tenha trocado quando o navegador montar a pagina impressa.
 */

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Formato = "cartao" | "tabela";

const CONSULTA = "(min-width: 768px)";

function atual(): Formato {
  if (typeof window === "undefined") return "tabela";
  return window.matchMedia(CONSULTA).matches ? "tabela" : "cartao";
}

export function useFormato() {
  const [formato, setFormato] = useState<Formato>(atual);
  const [imprimindo, setImprimindo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const aoMudar = () => setFormato(mq.matches ? "tabela" : "cartao");
    const antes = () =>
      flushSync(() => {
        setImprimindo(true);
        setFormato("tabela");
      });
    const depois = () => {
      setImprimindo(false);
      aoMudar();
    };

    mq.addEventListener("change", aoMudar);
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      mq.removeEventListener("change", aoMudar);
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, []);

  return { formato: imprimindo ? ("tabela" as const) : formato, imprimindo };
}
