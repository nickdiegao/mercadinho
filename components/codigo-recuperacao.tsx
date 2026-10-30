"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Botao } from "./ui";

/**
 * Mostra o codigo uma vez so: o banco guarda apenas o hash. O botao de seguir
 * so libera depois de a pessoa confirmar que guardou.
 */
export function CodigoRecuperacao({
  codigo,
  textoBotao,
  onContinuar,
}: {
  codigo: string;
  textoBotao: string;
  onContinuar: () => void;
}) {
  const [guardou, setGuardou] = useState(false);
  const [copiou, setCopiou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiou(true);
    } catch {
      /* area de transferencia bloqueada: o codigo continua na tela */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] font-bold text-tinta">Guarde o código de recuperação</p>
        <p className="mt-1 text-[13px] leading-relaxed text-tinta2">
          Este sistema roda neste computador, então não existe &ldquo;esqueci a senha&rdquo; por
          e-mail. Sem a senha e sem este código, ninguém entra como administração.
          Anote em papel e guarde longe do computador.
        </p>
      </div>

      <p className="mono select-all rounded-md border border-borda2 bg-superficie2 px-3 py-3 text-center text-[17px] font-bold tracking-[0.06em] text-tinta">
        {codigo}
      </p>

      <Botao type="button" onClick={copiar}>
        {copiou ? <Check size={15} /> : <Copy size={15} />} {copiou ? "Copiado" : "Copiar código"}
      </Botao>

      <p className="text-[12.5px] leading-relaxed text-tinta2">
        Ele aparece só agora e cada código funciona uma vez: ao recuperar a senha,
        o sistema gera outro.
      </p>

      <label className="flex items-center gap-2 text-[13px] font-medium text-tinta">
        <input type="checkbox" checked={guardou} onChange={(e) => setGuardou(e.target.checked)} />
        Já guardei o código em um lugar seguro
      </label>

      <Botao type="button" variante="primario" disabled={!guardou} onClick={onContinuar} className="w-full py-2.5">
        {textoBotao}
      </Botao>
    </div>
  );
}
