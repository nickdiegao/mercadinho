/** Trilha de auditoria das acoes que nao passam por lib/operacoes.ts. */

import type { Conexao } from "./db";
import * as t from "./schema";

let contador = 0;
const idLog = () => `lg_${Date.now().toString(36)}${(contador++).toString(36)}`;

export function auditar(
  db: Conexao,
  r: { usuarioId: string | null; acao: string; entidade: string; entidadeId?: string; detalhe: string },
) {
  db.insert(t.logAuditoria)
    .values({
      id: idLog(),
      ocorridoEm: new Date().toISOString(),
      usuarioId: r.usuarioId,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId ?? "",
      detalhe: r.detalhe,
    })
    .run();
}
