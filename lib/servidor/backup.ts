/**
 * Backup do banco. Funciona com o sistema ligado, e cada copia e conferida
 * antes de valer.
 *
 *   diario               um por dia, guarda os ultimos 30
 *   antes-da-atualizacao feito sozinho quando uma versao nova muda as tabelas
 *
 * A pasta vem de BACKUP_PASTA. No instalador ela fica em Documentos: se o
 * Windows sincroniza Documentos com o OneDrive, o backup ainda ganha uma copia
 * na nuvem. Aqui e seguro, porque e um arquivo fechado, nao o banco em uso.
 */

import Database from "better-sqlite3";
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { banco } from "./db";

const GUARDAR_DIARIOS = 30;
const GUARDAR_ATUALIZACAO = 5;
const VINTE_HORAS = 20 * 60 * 60 * 1000;
const UMA_HORA = 60 * 60 * 1000;

const pasta = () => process.env.BACKUP_PASTA ?? "";

const carimbo = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, "-");

function listar(prefixo: string) {
  if (!pasta()) return [];
  try {
    return readdirSync(pasta())
      .filter((n) => n.startsWith(prefixo) && n.endsWith(".db"))
      .map((nome) => ({ nome, em: statSync(join(pasta(), nome)).mtimeMs }))
      .sort((a, b) => b.em - a.em);
  } catch {
    return [];
  }
}

function limpar(prefixo: string, guardar: number) {
  for (const { nome } of listar(prefixo).slice(guardar)) rmSync(join(pasta(), nome), { force: true });
}

/** Copia com o banco ligado, confere a copia e so entao ela passa a valer. */
export async function fazerBackup(tipo: "diario" | "antes-da-atualizacao" = "diario") {
  if (!pasta()) throw new Error("BACKUP_PASTA não configurada.");
  mkdirSync(pasta(), { recursive: true });

  const prefixo = `mercadinho-${tipo}-`;
  const final = join(pasta(), `${prefixo}${carimbo(new Date())}.db`);
  const parcial = `${final}.parcial`;
  try {
    await banco().$client.backup(parcial);
    const copia = new Database(parcial);
    // a copia herda o WAL do banco: sem isso, abrir o arquivo deixaria -wal e
    // -shm soltos na pasta, e o backup precisa ser um arquivo so
    copia.pragma("journal_mode = DELETE");
    const conferido = copia.pragma("quick_check", { simple: true });
    copia.close();
    if (conferido !== "ok") throw new Error(`Cópia com defeito: ${conferido}`);
    renameSync(parcial, final);
  } finally {
    for (const fim of ["", "-wal", "-shm"]) rmSync(parcial + fim, { force: true });
  }
  limpar(prefixo, tipo === "diario" ? GUARDAR_DIARIOS : GUARDAR_ATUALIZACAO);
  return final;
}

export function situacaoBackup() {
  const diarios = listar("mercadinho-");
  return {
    pasta: pasta(),
    ultimoEm: diarios[0] ? new Date(diarios[0].em).toISOString() : null,
    quantidade: diarios.length,
  };
}

async function backupSeVencido() {
  const ultimo = listar("mercadinho-diario-")[0];
  if (ultimo && Date.now() - ultimo.em < VINTE_HORAS) return;
  try {
    await fazerBackup();
  } catch (e) {
    console.error("[backup automatico]", e);
  }
}

/** Confere de hora em hora: o computador da loja nao fica ligado o dia inteiro. */
export function agendarBackups() {
  if (!pasta()) return;
  setTimeout(() => void backupSeVencido(), 60_000).unref();
  setInterval(() => void backupSeVencido(), UMA_HORA).unref();
}
