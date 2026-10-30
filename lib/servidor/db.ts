/**
 * Conexao com o SQLite. So existe no servidor.
 *
 * Uma conexao por processo, guardada no globalThis: o Next em desenvolvimento
 * recarrega os modulos a cada alteracao, e sem isso cada recarga abriria o
 * arquivo de novo.
 *
 * O arquivo nunca pode ficar em pasta sincronizada (OneDrive) nem de rede: a
 * trava do SQLite nao funciona nelas, e isso corrompe o banco.
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema";

if (typeof window !== "undefined") {
  throw new Error("lib/servidor/db.ts so pode ser importado no servidor.");
}

type Banco = ReturnType<typeof criar>;

function criar(arquivo: string) {
  mkdirSync(dirname(arquivo), { recursive: true });
  const cliente = new Database(arquivo);
  // WAL deixa ler enquanto grava, e FULL so confirma a venda depois de ela
  // chegar ao disco: uma queda de luz nao perde o que ja foi confirmado
  cliente.pragma("journal_mode = WAL");
  cliente.pragma("synchronous = FULL");
  cliente.pragma("foreign_keys = ON");
  cliente.pragma("busy_timeout = 5000");
  return drizzle(cliente, { schema });
}

const guardado = globalThis as unknown as { __mercadinhoBanco?: Banco };

/** O banco esta configurado? Sem BANCO_ARQUIVO o sistema roda como demonstracao. */
export const temBanco = () => Boolean(process.env.BANCO_ARQUIVO);

export function banco(): Banco {
  const arquivo = process.env.BANCO_ARQUIVO;
  if (!arquivo) throw new Error("BANCO_ARQUIVO não configurado: veja o .env.example.");
  return (guardado.__mercadinhoBanco ??= criar(arquivo));
}

/** Cria ou atualiza as tabelas. */
export function migrar() {
  const pasta = process.env.BANCO_MIGRATIONS ?? join(process.cwd(), "drizzle");
  migrate(banco(), { migrationsFolder: pasta });
}

export function fecharBanco() {
  guardado.__mercadinhoBanco?.$client.close();
  guardado.__mercadinhoBanco = undefined;
}

export type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
export type Conexao = Banco | Transacao;
