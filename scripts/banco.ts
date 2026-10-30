/**
 * Comandos do banco local. Use pelo npm:
 *
 *   npm run banco:migrar   cria ou atualiza as tabelas (migrations em drizzle/)
 *   npm run banco:semear   APAGA TUDO e carrega os dados ficticios da demonstracao
 *   npm run banco:zerar    APAGA TUDO e deixa so a empresa, os usuarios e as
 *                          categorias — pronto para os dados reais
 *
 * Os usuarios entram com a SENHA_INICIAL do .env.local.
 */

import { loadEnvConfig } from "@next/env";
import { hash } from "bcryptjs";
import { rmSync } from "node:fs";
import { estadoVazio, gerarEstado } from "../lib/seed";

loadEnvConfig(process.cwd());

async function main() {
  const comando = process.argv[2];
  // o modulo do banco le BANCO_ARQUIVO ao conectar: importa depois do .env.local
  const { banco, migrar } = await import("../lib/servidor/db");
  const { semear } = await import("../lib/servidor/estado");

  if (comando === "migrar") {
    migrar();
    console.log("Tabelas em dia.");
  } else if (comando === "semear" || comando === "zerar") {
    const senha = process.env.SENHA_INICIAL;
    if (!senha) throw new Error("Defina SENHA_INICIAL no .env.local (veja o .env.example).");
    if (senha.length < 8) throw new Error("SENHA_INICIAL precisa de pelo menos 8 caracteres.");
    const arquivo = process.env.BANCO_ARQUIVO;
    if (!arquivo) throw new Error("Defina BANCO_ARQUIVO no .env.local (veja o .env.example).");

    // recomeca do arquivo: os gatilhos de so-insercao nao deixam limpar por DELETE
    for (const fim of ["", "-wal", "-shm"]) rmSync(arquivo + fim, { force: true });
    migrar();

    const estado = comando === "semear" ? gerarEstado() : estadoVazio();
    const senhaHash = await hash(senha, 12);
    banco().transaction((tx) => semear(tx, estado, senhaHash));
    console.log(
      comando === "semear"
        ? `Banco com a demonstração: ${estado.produtos.length} produtos, ${estado.vendas.length} vendas, ${estado.movimentos.length} movimentos.`
        : "Banco zerado: empresa, usuários e categorias. Pronto para os dados reais.",
    );
    console.log(`Usuários: ${estado.usuarios.map((u) => u.email).join(", ")} (senha: SENHA_INICIAL do .env.local).`);
  } else {
    console.log("Uso: tsx scripts/banco.ts migrar | semear | zerar");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
