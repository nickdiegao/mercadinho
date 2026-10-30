/**
 * Migrations do banco. Depois de mudar lib/servidor/schema.ts:
 *   npm run banco:gerar     cria a migration nova em drizzle/
 *   npm run banco:migrar    aplica no banco
 */

import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// mesmas variaveis que o Next le (.env.local)
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./lib/servidor/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: process.env.BANCO_ARQUIVO ?? "" },
  strict: true,
});
