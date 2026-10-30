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
import { mkdirSync, readFileSync } from "node:fs";
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

const pastaMigrations = () => process.env.BANCO_MIGRATIONS ?? join(process.cwd(), "drizzle");

/** Cria ou atualiza as tabelas. */
export function migrar() {
  migrate(banco(), { migrationsFolder: pastaMigrations() });
}

/** Banco com dados e migration ainda nao aplicada: o caso de uma versao nova. */
export function temMigracaoPendente() {
  const cliente = banco().$client;
  const existe = cliente
    .prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get();
  if (!existe) return false;
  const aplicadas = (cliente.prepare("select count(*) n from __drizzle_migrations").get() as { n: number }).n;
  const diario = JSON.parse(readFileSync(join(pastaMigrations(), "meta", "_journal.json"), "utf8"));
  return aplicadas < diario.entries.length;
}

export function fecharBanco() {
  guardado.__mercadinhoBanco?.$client.close();
  guardado.__mercadinhoBanco = undefined;
}

export type Transacao = Parameters<Parameters<Banco["transaction"]>[0]>[0];
export type Conexao = Banco | Transacao;
