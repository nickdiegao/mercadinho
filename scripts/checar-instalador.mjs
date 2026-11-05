/**
 * Confere o instalador antes de publicar. Use pelo npm: npm run instalador:checar
 *
 * Roda o programa que o `npm run instalador` acabou de montar (pasta
 * win-unpacked, o mesmo conteudo do .exe) num ambiente isolado: pasta de
 * dados, banco e configuracoes proprios, numa pasta temporaria. Nao toca no
 * sistema instalado neste computador, nem nos dados dele.
 *
 * O que confere:
 *   1. a versao e a mesma no package.json, no nome do .exe, no latest.yml e
 *      no programa montado;
 *   2. um banco "antigo" (criado antes do catalogo, sem produtos) e atualizado
 *      ao abrir: os produtos entram, com saldo 0, uma vez so;
 *      a primeira abertura (banco novo, criar administrador) funciona;
 *   3. o servidor sobe, a tela de entrada responde e o programa nao fecha.
 *
 * Sai com codigo 0 se tudo passou e 1 se algo falhou.
 */

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(process.env.LOCALAPPDATA, "Mercadinho", "empacotar", "saida");
const PROGRAMA = join(SAIDA, "win-unpacked", "Distribuidora.exe");
const PRODUTOS_ESPERADOS = 53; // 51 produtos + 2 cascos do catalogo inicial

const resultados = [];
function confere(nome, ok, detalhe = "") {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "  ok " : " ERRO"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  return ok;
}

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(condicao, ms, passo = 500) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const v = await condicao();
    if (v) return v;
    await dorme(passo);
  }
  return null;
}

// ---------------------------------------------------------------- 1. versao
console.log("\n1. Versoes");
const versao = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).version;
const exe = join(SAIDA, `Distribuidora-Setup-${versao}.exe`);
confere("instalador existe", existsSync(exe), `Distribuidora-Setup-${versao}.exe`);
confere("blockmap existe", existsSync(`${exe}.blockmap`));
const yml = existsSync(join(SAIDA, "latest.yml")) ? readFileSync(join(SAIDA, "latest.yml"), "utf8") : "";
confere("latest.yml na mesma versao", new RegExp(`^version: ${versao.replaceAll(".", "\\.")}$`, "m").test(yml), `esperado ${versao}`);
confere("programa montado existe", existsSync(PROGRAMA));
if (existsSync(PROGRAMA)) {
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `(Get-Item '${PROGRAMA}').VersionInfo.ProductVersion`],
    { encoding: "utf8" },
  );
  const doExe = (r.stdout ?? "").trim();
  confere("programa montado na mesma versao", doExe.startsWith(`${versao}.`) || doExe === versao, `${doExe} (esperado ${versao})`);
}

// ---------------------------------------------------------------- 2. banco antigo
console.log("\n2. Banco antigo atualizado ao abrir");
const temp = mkdtempSync(join(tmpdir(), "checar-instalador-"));
const local = join(temp, "Local");
const dados = join(local, "Mercadinho", "dados");
const usuario = join(temp, "usuario");
mkdirSync(dados, { recursive: true });
mkdirSync(usuario, { recursive: true });
const banco = join(dados, "mercadinho.db");

let processo = null;
try {
  // banco criado como nas versoes 0.1.0 a 0.1.2: empresa e usuarios, sem produtos
  const zerar = spawnSync("npm", ["run", "banco:zerar"], {
    cwd: RAIZ,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, BANCO_ARQUIVO: banco, SENHA_INICIAL: `Chk-${randomBytes(6).toString("hex")}!A1`, NEXTAUTH_SECRET: randomBytes(16).toString("hex") },
  });
  confere("banco de teste criado", zerar.status === 0 && existsSync(banco));

  const antes = new DatabaseSync(banco);
  antes.exec("PRAGMA foreign_keys = OFF; update produtos set vasilhame_id = null; delete from produtos; delete from log_auditoria where acao = 'CATALOGO_INICIAL';");
  const vazio = antes.prepare("select count(*) n from produtos").get().n;
  antes.close();
  confere("banco de teste sem produtos (como na 0.1.0)", vazio === 0, `${vazio} produtos`);

  // primeira abertura: banco novo, criar empresa e administrador pela mesma funcao da tela
  const novo = join(temp, "novo.db");
  const primeira = spawnSync("npx", ["tsx", "scripts/checar-primeira-abertura.ts"], {
    cwd: RAIZ,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, BANCO_ARQUIVO: novo, NEXTAUTH_SECRET: randomBytes(16).toString("hex") },
  });
  confere("primeira abertura (criar empresa e administrador)", primeira.status === 0, primeira.status === 0 ? "" : (primeira.stderr ?? "").trim().split("\n").slice(-2).join(" "));

  // ---------------------------------------------------------------- 3. abre o programa
  console.log("\n3. Abrir o programa");
  processo = spawn(PROGRAMA, [`--user-data-dir=${usuario}`], {
    env: { ...process.env, LOCALAPPDATA: local },
    stdio: "ignore",
    windowsHide: true,
  });
  let saiu = false;
  processo.once("exit", () => (saiu = true));

  const logServidor = join(dados, "servidor.log");
  const endereco = await esperar(() => {
    if (saiu) return "saiu";
    if (!existsSync(logServidor)) return null;
    const m = readFileSync(logServidor, "utf8").match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
    return m?.[1] ?? null;
  }, 90000);
  confere("o programa abriu e o servidor subiu", Boolean(endereco) && endereco !== "saiu", endereco === "saiu" ? "o programa fechou sozinho" : (endereco ?? "o servidor nao respondeu em 90 s"));

  if (endereco && endereco !== "saiu") {
    const resposta = await esperar(async () => {
      try {
        const r = await fetch(endereco, { redirect: "manual" });
        return r.status < 500 ? r : null;
      } catch {
        return null;
      }
    }, 30000);
    confere("a tela de entrada responde", Boolean(resposta), resposta ? `HTTP ${resposta.status}` : "sem resposta");

    const quantos = await esperar(() => {
      try {
        const db = new DatabaseSync(banco, { readOnly: true });
        const n = db.prepare("select count(*) n from produtos").get().n;
        db.close();
        return n > 0 ? n : null;
      } catch {
        return null;
      }
    }, 30000);
    confere("produtos carregados no banco antigo", quantos === PRODUTOS_ESPERADOS, `${quantos ?? 0} (esperado ${PRODUTOS_ESPERADOS})`);

    const db = new DatabaseSync(banco, { readOnly: true });
    const saldo = db.prepare("select coalesce(sum(saldo_atual), 0) s from produtos").get().s;
    const marca = db.prepare("select count(*) n from log_auditoria where acao = 'CATALOGO_INICIAL'").get().n;
    db.close();
    confere("todos com saldo 0", saldo === 0, `soma ${saldo}`);
    confere("marca de catalogo carregado gravada", marca === 1, `${marca} marca(s)`);
  }
  confere("o programa continua aberto", !saiu);
} catch (e) {
  confere("a checagem rodou sem erro", false, String(e?.message ?? e));
} finally {
  if (processo?.pid) spawnSync("taskkill", ["/PID", String(processo.pid), "/T", "/F"], { stdio: "ignore" });
  await dorme(1500);
  rmSync(temp, { recursive: true, force: true });
}

// ---------------------------------------------------------------- resultado
const falhas = resultados.filter((r) => !r.ok);
console.log(
  falhas.length
    ? `\nNAO PUBLIQUE: ${falhas.length} de ${resultados.length} conferencias falharam.`
    : `\nTudo certo: ${resultados.length} conferencias passaram. Pode publicar a ${versao}.`,
);
process.exit(falhas.length ? 1 : 0);
