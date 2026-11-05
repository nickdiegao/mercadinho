/**
 * Copia do backup para fora do computador (pen drive ou outra pasta): faz um
 * backup novo e conferido, e pede ao programa para copiar para onde a pessoa
 * escolher. So existe no programa instalado.
 */

import { fazerBackupAgora } from "@/app/acoes-contas";
import { eletron } from "./eletron";

export interface ResultadoCopiaFora {
  ok: boolean;
  cancelado?: boolean;
  texto: string;
}

export async function copiarParaFora(): Promise<ResultadoCopiaFora> {
  const programa = eletron();
  if (!programa) return { ok: false, texto: "Disponível só no programa instalado." };

  const feito = await fazerBackupAgora().catch(() => null);
  if (!feito?.ok) return { ok: false, texto: feito ? feito.erro : "Não foi possível fazer o backup." };

  const r = await programa.copiarBackupParaFora();
  if (r.ok) return { ok: true, texto: `Cópia salva em ${r.pasta}. Pode retirar o pen drive.` };
  if (r.cancelado) return { ok: false, cancelado: true, texto: "" };
  return { ok: false, texto: r.erro ?? "Não foi possível copiar." };
}
