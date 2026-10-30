/**
 * Gera o instalador .exe. Use pelo npm: npm run instalador
 *
 *   1. instala as ferramentas (Electron e cia) fora do OneDrive
 *   2. gera o servidor do Next em modo standalone
 *   3. monta a pasta do programa, sem nenhum segredo desta maquina
 *   4. roda o electron-builder
 *
 * Tudo acontece em %LOCALAPPDATA%\Mercadinho\empacotar: sao centenas de MB que
 * o OneDrive nao precisa sincronizar. O instalador sai na subpasta saida.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTE = join(RAIZ, "electron");
const PASTA = join(process.env.LOCALAPPDATA, "Mercadinho", "empacotar");
mkdirSync(PASTA, { recursive: true });
// caminho real: o Windows redireciona AppData para apps em container, e o
// electron-builder recusa o gancho quando os dois caminhos nao batem
const BASE = realpathSync.native(PASTA);
const FERRAMENTAS = join(BASE, "ferramentas");
const SERVIDOR = join(BASE, "servidor");
const APP = join(BASE, "app");
const RECURSOS = join(BASE, "recursos");
const SAIDA = join(BASE, "saida");

const pacote = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));

function etapa(texto) {
  console.log(`\n--- ${texto}`);
}

function rodar(comando, args, cwd, env = {}) {
  const r = spawnSync(comando, args, { cwd, stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`Falhou: ${comando} ${args.join(" ")}`);
}

function arquivos(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    return e.isDirectory() ? arquivos(caminho) : [caminho];
  });
}

/** Nenhum valor do .env.local pode sair desta maquina dentro do instalador. */
function conferirSegredos() {
  const env = join(RAIZ, ".env.local");
  if (!existsSync(env)) return;
  const valores = readFileSync(env, "utf8")
    .split(/\r?\n/)
    .map((l) => l.slice(l.indexOf("=") + 1).trim())
    .filter((v) => v.length >= 12);
  for (const arquivo of arquivos(SERVIDOR)) {
    if (/\.env/.test(arquivo)) throw new Error(`Arquivo de ambiente no pacote: ${arquivo}`);
    if (/\.(node|woff2?|png|ico)$/.test(arquivo) || statSync(arquivo).size > 20_000_000) continue;
    const texto = readFileSync(arquivo, "utf8");
    if (valores.some((v) => texto.includes(v))) throw new Error(`Segredo do .env.local dentro de ${arquivo}`);
  }
}

etapa("Ferramentas");
mkdirSync(FERRAMENTAS, { recursive: true });
const manifesto = join(FERRAMENTAS, "package.json");
const mudou = !existsSync(manifesto) || readFileSync(manifesto, "utf8") !== readFileSync(join(FONTE, "package.json"), "utf8");
if (mudou) copyFileSync(join(FONTE, "package.json"), manifesto);
if (mudou || !existsSync(join(FERRAMENTAS, "node_modules"))) {
  rodar("npm", ["install", "--no-audit", "--no-fund"], FERRAMENTAS);
}

etapa("Servidor do sistema");
rmSync(join(RAIZ, ".next"), { recursive: true, force: true });
// BANCO_ARQUIVO aqui so marca o modo: o caminho de verdade vem do programa
rodar("npx", ["next", "build"], RAIZ, { EMPACOTANDO: "1", BANCO_ARQUIVO: "instalador", NEXTAUTH_SECRET: "" });

rmSync(SERVIDOR, { recursive: true, force: true });
cpSync(join(RAIZ, ".next", "standalone"), SERVIDOR, { recursive: true, dereference: true });
cpSync(join(RAIZ, ".next", "static"), join(SERVIDOR, ".next", "static"), { recursive: true });
cpSync(join(RAIZ, "drizzle"), join(SERVIDOR, "drizzle"), { recursive: true });
if (existsSync(join(RAIZ, "public"))) cpSync(join(RAIZ, "public"), join(SERVIDOR, "public"), { recursive: true });
for (const n of readdirSync(SERVIDOR)) if (n.startsWith(".env")) rmSync(join(SERVIDOR, n));

// o SQLite traz binario de oito sistemas: fica so o do Windows
const sqlite = join(SERVIDOR, "node_modules", "better-sqlite3");
for (const n of readdirSync(join(sqlite, "prebuilds"))) {
  if (n !== "win32-x64.node") rmSync(join(sqlite, "prebuilds", n));
}
for (const n of ["deps", "src", "binding.gyp"]) rmSync(join(sqlite, n), { recursive: true, force: true });
if (!existsSync(join(sqlite, "prebuilds", "win32-x64.node"))) throw new Error("Faltou o binario do SQLite.");
conferirSegredos();

etapa("Programa");
rmSync(APP, { recursive: true, force: true });
mkdirSync(APP, { recursive: true });
mkdirSync(RECURSOS, { recursive: true });
// o esbuild acha o electron-updater a partir da pasta das ferramentas
copyFileSync(join(FONTE, "main.cjs"), join(FERRAMENTAS, "main.cjs"));
rodar(
  "npx",
  ["esbuild", "main.cjs", "--bundle", "--platform=node", "--format=cjs", "--target=node24", "--external:electron", `--outfile="${join(APP, "main.cjs")}"`],
  FERRAMENTAS,
);
copyFileSync(join(FONTE, "preload.cjs"), join(APP, "preload.cjs"));
copyFileSync(join(FONTE, "carregando.html"), join(APP, "carregando.html"));
copyFileSync(join(FONTE, "icone.ico"), join(RECURSOS, "icone.ico"));
copyFileSync(join(FONTE, "electron-builder.json"), join(BASE, "electron-builder.json"));
copyFileSync(join(FONTE, "depois-de-empacotar.cjs"), join(BASE, "depois-de-empacotar.cjs"));
writeFileSync(
  join(APP, "package.json"),
  JSON.stringify(
    {
      name: "distribuidora",
      productName: "Distribuidora",
      version: pacote.version,
      description: "Sistema de estoque, vendas e caixa",
      author: "Mercadinho",
      main: "main.cjs",
    },
    null,
    2,
  ),
);

// o electron-builder exige um package.json na raiz, alem do programa em app/
writeFileSync(join(BASE, "package.json"), JSON.stringify({ name: "distribuidora-empacotar", private: true }, null, 2));

etapa("Instalador");
rmSync(SAIDA, { recursive: true, force: true });
// roda a partir de BASE: e dali que ele acha o depois-de-empacotar.cjs
rodar(
  `"${join(FERRAMENTAS, "node_modules", ".bin", "electron-builder.cmd")}"`,
  ["--win", "--x64", "--publish", "never", "--config", "electron-builder.json"],
  BASE,
  { CSC_IDENTITY_AUTO_DISCOVERY: "false" },
);

const exe = readdirSync(SAIDA).find((n) => n.endsWith(".exe"));
if (!exe) throw new Error("O instalador não foi gerado.");
console.log(`\nPronto: ${join(SAIDA, exe)} (${Math.round(statSync(join(SAIDA, exe)).size / 1e6)} MB)`);
