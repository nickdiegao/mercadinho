/**
 * Conexao com o Postgres. So existe no servidor.
 *
 * Uma conexao por processo, guardada no globalThis: o Next em desenvolvimento
 * recarrega os modulos a cada alteracao, e sem isso cada recarga abriria um
 * pool novo ate estourar o limite de conexoes do banco.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (typeof window !== "undefined") {
  throw new Error("lib/servidor/db.ts so pode ser importado no servidor.");
}

type Banco = ReturnType<typeof criar>;

function criar(url: string) {
  const cliente = postgres(url, { max: 5, onnotice: () => {} });
  return drizzle(cliente, { schema });
}

const guardado = globalThis as unknown as { __mercadinhoBanco?: Banco };

/** O banco esta configurado? Sem DATABASE_URL o sistema roda como demonstracao. */
export const temBanco = () => Boolean(process.env.DATABASE_URL);

export function banco(): Banco {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada: veja o .env.example.");
  return (guardado.__mercadinhoBanco ??= criar(url));
}

export type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
export type Conexao = Banco | Transacao;
