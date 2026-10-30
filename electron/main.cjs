/**
 * O programa instalado. Ele so faz quatro coisas:
 *
 *   1. sobe o servidor do sistema (o mesmo Next) num processo separado
 *   2. abre a janela apontando para esse servidor
 *   3. fala com o que o navegador nao alcanca: impressora e pastas
 *   4. procura atualizacao, em silencio
 *
 * Os dados ficam em %LOCALAPPDATA%\Mercadinho\dados, fora do OneDrive e fora da
 * pasta do programa: desinstalar ou atualizar nao toca neles.
 */

const { app, BrowserWindow, dialog, ipcMain, Menu, shell, utilityProcess } = require("electron");
const { autoUpdater } = require("electron-updater");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const PORTA_PADRAO = 38310;
const ESPERA_SERVIDOR_MS = 60_000;

const SERVIDOR = path.join(process.resourcesPath, "servidor");
const DADOS = path.join(process.env.LOCALAPPDATA ?? app.getPath("appData"), "Mercadinho", "dados");
const BANCO = path.join(DADOS, "mercadinho.db");
const CONFIG = path.join(DADOS, "config.json");
const SEGREDO = path.join(DADOS, "segredo");
const LOG = path.join(DADOS, "servidor.log");
const BACKUPS = path.join(app.getPath("documents"), "Mercadinho Backups");

let janela = null;
let servidor = null;
let endereco = "";
let saindo = false;
let reiniciando = false;

// ---------------------------------------------------------------- config

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    return {};
  }
}

function gravarConfig(mudanca) {
  fs.writeFileSync(CONFIG, JSON.stringify({ ...lerConfig(), ...mudanca }, null, 2));
}

/** Assina o cookie de sessao. Nasce neste computador: nao vem no instalador. */
function segredo() {
  try {
    return fs.readFileSync(SEGREDO, "utf8");
  } catch {
    const novo = randomBytes(32).toString("base64");
    fs.writeFileSync(SEGREDO, novo);
    return novo;
  }
}

// ---------------------------------------------------------------- servidor

function portaLivre(porta) {
  return new Promise((resolve) => {
    const teste = net.createServer();
    teste.once("error", () => resolve(false));
    teste.once("listening", () => teste.close(() => resolve(true)));
    teste.listen(porta, "127.0.0.1");
  });
}

async function escolherPorta() {
  if (await portaLivre(PORTA_PADRAO)) return PORTA_PADRAO;
  return new Promise((resolve) => {
    const teste = net.createServer();
    teste.listen(0, "127.0.0.1", () => {
      const { port } = teste.address();
      teste.close(() => resolve(port));
    });
  });
}

function respondeu(porta) {
  return new Promise((resolve) => {
    const c = net.connect(porta, "127.0.0.1");
    c.once("connect", () => {
      c.destroy();
      resolve(true);
    });
    c.once("error", () => resolve(false));
  });
}

async function esperarServidor(porta) {
  const limite = Date.now() + ESPERA_SERVIDOR_MS;
  while (Date.now() < limite) {
    if (await respondeu(porta)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function iniciarServidor() {
  const porta = await escolherPorta();
  // o log mostra so a ultima execucao, para o suporte achar o erro de hoje
  const log = fs.createWriteStream(LOG);

  servidor = utilityProcess.fork(path.join(SERVIDOR, "server.js"), [], {
    cwd: SERVIDOR,
    serviceName: "Servidor do sistema",
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(porta),
      HOSTNAME: "127.0.0.1",
      BANCO_ARQUIVO: BANCO,
      BANCO_MIGRATIONS: path.join(SERVIDOR, "drizzle"),
      BACKUP_PASTA: BACKUPS,
      NEXTAUTH_SECRET: segredo(),
      AUTH_TRUST_HOST: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  servidor.stdout?.pipe(log);
  servidor.stderr?.pipe(log);
  servidor.once("exit", (codigo) => {
    servidor = null;
    if (saindo || reiniciando) return;
    dialog.showErrorBox(
      "O sistema parou",
      `O servidor do sistema fechou (código ${codigo}). Abra o programa de novo. Se repetir, envie para o suporte o arquivo:\n${LOG}`,
    );
    app.quit();
  });

  if (!(await esperarServidor(porta))) throw new Error("O servidor do sistema não respondeu a tempo.");
  endereco = `http://127.0.0.1:${porta}`;
}

function pararServidor() {
  return new Promise((resolve) => {
    if (!servidor) return resolve();
    servidor.once("exit", () => resolve());
    servidor.kill();
  });
}

// ---------------------------------------------------------------- janela

function ehDoSistema(url) {
  return Boolean(endereco) && url.startsWith(`${endereco}/`);
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#16233f",
    title: "Distribuidora",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  janela.once("ready-to-show", () => {
    janela.maximize();
    janela.show();
  });
  janela.on("closed", () => {
    janela = null;
  });

  // o que nao e do sistema (WhatsApp, por exemplo) abre no navegador
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (ev, url) => {
    if (ehDoSistema(url)) return;
    ev.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });
}

// ---------------------------------------------------------------- impressora

async function impressoraDoRecibo(conteudo) {
  const nomes = (await conteudo.getPrintersAsync()).map((p) => p.name);
  const escolhida = lerConfig().impressora;
  if (escolhida && nomes.includes(escolhida)) return escolhida;
  return nomes.find((n) => /\bi9\b/i.test(n) || /elgin/i.test(n)) ?? null;
}

ipcMain.handle("versao", () => app.getVersion());

ipcMain.handle("impressoras", async (ev) => ({
  nomes: (await ev.sender.getPrintersAsync()).map((p) => p.name),
  escolhida: lerConfig().impressora ?? null,
}));

ipcMain.handle("impressora:definir", (_ev, nome) => gravarConfig({ impressora: nome }));

ipcMain.handle("recibo:imprimir", async (ev, alturaMm) => {
  const deviceName = await impressoraDoRecibo(ev.sender);
  if (!deviceName) return { ok: false, erro: "Nenhuma impressora de recibos encontrada." };
  return new Promise((resolve) => {
    ev.sender.print(
      {
        silent: true,
        deviceName,
        printBackground: false,
        margins: { marginType: "none" },
        pageSize: { width: 80_000, height: Math.round(Number(alturaMm) * 1000) },
      },
      (ok, erro) => resolve({ ok, erro }),
    );
  });
});

// ---------------------------------------------------------------- backup

ipcMain.handle("backups:abrir", async () => {
  fs.mkdirSync(BACKUPS, { recursive: true });
  await shell.openPath(BACKUPS);
});

/** O SQLite do proprio servidor: fora do pacote, carregado so aqui. */
function abrirSqlite(arquivo, opcoes) {
  const Database = module.require(path.join(SERVIDOR, "node_modules", "better-sqlite3"));
  return new Database(arquivo, opcoes);
}

function conferirBackup(arquivo) {
  const db = abrirSqlite(arquivo, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma("quick_check", { simple: true }) !== "ok") return "O arquivo está com defeito.";
    const tem = db.prepare("select 1 from sqlite_master where type = 'table' and name = 'usuarios'").get();
    return tem ? null : "Este arquivo não é um backup do sistema.";
  } catch {
    return "Este arquivo não é um backup do sistema.";
  } finally {
    db.close();
  }
}

ipcMain.handle("backups:restaurar", async () => {
  const escolha = await dialog.showOpenDialog(janela, {
    title: "Escolha o backup",
    defaultPath: BACKUPS,
    filters: [{ name: "Backup do sistema", extensions: ["db"] }],
    properties: ["openFile"],
  });
  const arquivo = escolha.filePaths[0];
  if (!arquivo) return { ok: false };

  let defeito;
  try {
    defeito = conferirBackup(arquivo);
  } catch {
    defeito = "Este arquivo não é um backup do sistema.";
  }
  if (defeito) return { ok: false, erro: defeito };

  const confirma = await dialog.showMessageBox(janela, {
    type: "warning",
    title: "Restaurar backup",
    message: "Os dados atuais serão trocados pelos deste backup.",
    detail: `Tudo o que foi lançado depois dele deixa de aparecer. Uma cópia dos dados de agora fica guardada em:\n${DADOS}`,
    buttons: ["Restaurar", "Cancelar"],
    defaultId: 1,
    cancelId: 1,
  });
  if (confirma.response !== 0) return { ok: false };

  reiniciando = true;
  try {
    await pararServidor();
    // fecha o WAL no arquivo principal antes de copiar
    const atual = abrirSqlite(BANCO);
    atual.pragma("wal_checkpoint(TRUNCATE)");
    atual.close();
    const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    fs.copyFileSync(BANCO, path.join(DADOS, `antes-de-restaurar-${carimbo}.db`));
    for (const fim of ["-wal", "-shm"]) fs.rmSync(BANCO + fim, { force: true });
    fs.copyFileSync(arquivo, BANCO);
    await iniciarServidor();
    await janela?.loadURL(endereco);
    return { ok: true };
  } catch (e) {
    dialog.showErrorBox("Não foi possível restaurar", String(e?.message ?? e));
    app.quit();
    return { ok: false };
  } finally {
    reiniciando = false;
  }
});

// ---------------------------------------------------------------- atualizacao

function procurarAtualizacao() {
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // sem internet, ou repositorio privado: segue na versao atual, sem avisar
  autoUpdater.on("error", () => {});
  autoUpdater.checkForUpdates().catch(() => {});
}

// ---------------------------------------------------------------- partida

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela?.isMinimized()) janela.restore();
    janela?.focus();
  });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", () => {
    saindo = true;
    servidor?.kill();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    fs.mkdirSync(DADOS, { recursive: true });
    criarJanela();
    await janela.loadFile(path.join(__dirname, "carregando.html"));
    try {
      await iniciarServidor();
      await janela.loadURL(endereco);
      if (app.isPackaged) procurarAtualizacao();
    } catch (e) {
      dialog.showErrorBox("Não foi possível abrir o sistema", `${e?.message ?? e}\n\nDetalhes em:\n${LOG}`);
      app.quit();
    }
  });
}
