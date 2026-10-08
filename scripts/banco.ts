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
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { estadoVazio, gerarEstado } from "../lib/seed";

loadEnvConfig(process.cwd());

async function main() {
  const comando = process.argv[2];
  // o modulo do banco le DATABASE_URL ao conectar: importa depois do .env.local
  const { banco } = await import("../lib/servidor/db");
  const { semear } = await import("../lib/servidor/estado");
  const db = banco();

  if (comando === "migrar") {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Tabelas em dia.");
  } else if (comando === "semear" || comando === "zerar") {
    const senha = process.env.SENHA_INICIAL;
    if (!senha) throw new Error("Defina SENHA_INICIAL no .env.local (veja o .env.example).");
    const estado = comando === "semear" ? gerarEstado() : estadoVazio();
    await db.transaction((tx) => semear(tx, estado, senha));
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
