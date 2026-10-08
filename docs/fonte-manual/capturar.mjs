/**
 * Tira os prints do manual a partir do sistema rodando em producao local.
 *
 *   npm run build && npm run start -- -p 3001   (na raiz do projeto)
 *   npm i playwright-core                        (nesta pasta, uma vez)
 *   node capturar.mjs
 *
 * Tambem roda contra o servidor de desenvolvimento, sem a bolinha do Next:
 *   BASE=http://localhost:3830 node capturar.mjs
 *
 * Usa o Chrome instalado na maquina. Zera o localStorage antes: os dados
 * dos prints sao sempre os ficticios do seed.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// contra o servidor de desenvolvimento, grave fora do projeto (SAIDA=...) e copie
// depois: arquivo novo dentro do projeto faz o Next recompilar no meio do roteiro
const PASTA = process.env.SAIDA ?? join(dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(PASTA, { recursive: true });
process.chdir(PASTA);

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:3001";

/** Some com o indicador do modo de desenvolvimento, que nao existe em producao. */
const semIndicador = () => {
  document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(s);
  });
};

const nav = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await nav.newContext({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
  locale: "pt-BR",
});
await ctx.addInitScript(semIndicador);
const pg = await ctx.newPage();
const erros = [];
pg.on("pageerror", (e) => erros.push(String(e)));
const espera = (ms) => pg.waitForTimeout(ms);

async function ir(rota, largura = 1280) {
  await pg.setViewportSize({ width: largura, height: 1000 });
  await pg.goto(BASE + rota, { waitUntil: "networkidle" });
  await espera(1300);
}

async function foto(arquivo, altura, largura = 1280) {
  await espera(700);
  await pg.screenshot({ path: arquivo, clip: { x: 0, y: 0, width: largura, height: altura } });
  console.log("ok:", arquivo);
}

/** Painel lateral inteiro, sem a sombra da tela de tras. */
async function fotoPainel(arquivo) {
  const alturaTotal = await pg.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    const miolo = d.querySelector(".overflow-y-auto");
    const fixo = d.offsetHeight - miolo.clientHeight;
    return Math.ceil(fixo + miolo.scrollHeight);
  });
  await pg.setViewportSize({ width: 1280, height: Math.max(700, alturaTotal) });
  await espera(600);
  const caixa = await pg.locator("[role=dialog]").boundingBox();
  await pg.screenshot({ path: arquivo, clip: caixa });
  console.log("ok:", arquivo, Math.round(caixa.width), "x", Math.round(caixa.height));
}

// ---------------------------------------------------------------- login
await pg.goto(BASE, { waitUntil: "networkidle" });
await pg.evaluate(() => localStorage.clear());
await pg.goto(BASE, { waitUntil: "networkidle" });
await espera(1500);
await foto("01-login.png", 700);
await pg.locator("button", { hasText: "Maria Conceição" }).first().click();
await espera(1500);

// ---------------------------------------------------------------- venda
// tres jeitos na mesma venda: engradado natural, caixa gelada e lata avulsa gelada
await ir("/vendas/nova");
const busca = pg.locator('input[placeholder*="Buscar produto"]');
const primeiro = () => pg.locator("main ul").first().locator("li").first();
await busca.fill("Cerveja Pilsen Garrafa");
await espera(600);
await primeiro().locator('button[aria-label^="Adicionar 1 engradado"]').click();
await espera(500);
await busca.fill("Cerveja Pilsen Lata 350");
await espera(600);
await primeiro().locator('button[aria-label^="Adicionar 1 caixa"]').click();
await espera(500);
await pg.locator("li", { hasText: "Cerveja Pilsen Lata 350ml" }).first()
  .locator("button", { hasText: /^gelado R\$/ }).click();
await espera(400);
await busca.fill("Coca-Cola 600");
await espera(600);
await primeiro().locator('button[aria-label^="Adicionar 1 unidade"]').click();
await espera(500);
await pg.locator("li", { hasText: "Coca-Cola 600ml" }).first()
  .locator("button", { hasText: /^gelado R\$/ }).click();
await espera(400);
// a busca aberta mostra os dois botoes de cada produto
await busca.fill("Cerveja Pilsen");
await espera(700);
await foto("04-venda.png", 1000);
await busca.fill("");
await espera(400);

// ---------------------------------------------------------------- recibo e cancelamento
const idVenda = await pg.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("mercadinho.estado.v1"));
  const v = st.vendas.find(
    (x) => x.clienteId && x.itens.length >= 2 && x.status !== "CANCELADA" && x.formaPagamento !== "FIADO",
  );
  return v ? v.id : st.vendas[0].id;
});
await ir(`/vendas/${idVenda}`);
await foto("05-recibo.png", 880);

await pg.locator("button", { hasText: "Cancelar venda" }).first().click();
await espera(500);
await pg.locator("[role=dialog] textarea").fill("Cliente desistiu antes de carregar");
await fotoPainel("17-cancelar.png");
await pg.keyboard.press("Escape");

// ---------------------------------------------------------------- entrada, estoque, produtos
await ir("/entradas/nova");
const buscaEnt = pg.locator('input[placeholder*="Buscar produto"]');
const primeiroEnt = () => pg.locator("main ul").first().locator("li").first();
// fardos fechados e garrafas avulsas na mesma carga
await buscaEnt.fill("Coca-Cola 2L");
await espera(600);
await primeiroEnt().locator('button[aria-label^="Lançar em fardo"]').click();
await espera(400);
await pg.locator("tr", { hasText: "Coca-Cola 2L" }).first().locator("input").first().fill("10");
await buscaEnt.fill("Whisky Nacional");
await espera(600);
await primeiroEnt().locator('button[aria-label^="Lançar em unidade"]').click();
await espera(400);
await pg.locator("tr", { hasText: "Whisky Nacional 1L" }).first().locator("input").first().fill("6");
await espera(500);
await foto("07-entrada.png", 800);

await ir("/estoque");
await foto("08-estoque.png", 760);

await ir("/produtos");
await pg.locator("tbody tr").first().click();
await foto("09-produtos.png", 760);

// cadastro de produto: o exemplo que o cliente perguntou — produto que ainda nao tem no deposito
await ir("/produtos");
await pg.locator("button", { hasText: "Novo produto" }).first().click();
await espera(500);
const dlg = pg.locator("[role=dialog]");
await dlg.locator('input[placeholder^="Ex.:"]').fill("Cerveja Pilsen Lata 269ml");
await dlg.locator('input[placeholder="7891234567890"]').fill("7890000269014");
const precos = dlg.locator('input[placeholder="0,00"]');
await precos.nth(0).fill("3,90");
await precos.nth(1).fill("3,30");
await dlg.locator("label", { hasText: "Vende gelado" }).locator("input").check();
await espera(300);
await dlg.locator('input[placeholder="0,00"]').nth(2).fill("4,50");
await dlg.locator('input[placeholder="0"]').first().fill("48");
await fotoPainel("16-novo-produto.png");
await pg.keyboard.press("Escape");

// ---------------------------------------------------------------- caixa, relatorios, carga, clientes
await ir("/caixa");
await foto("10-caixa.png", 720);

await ir("/relatorios");
await foto("11-relatorios.png", 760);

const titGelado = pg.getByText("Gelado — a geladeira se paga?");
await titGelado.scrollIntoViewIfNeeded();
await pg.locator('input[placeholder="0,00"]').last().fill("600,00");
await espera(500);
const cartao = titGelado.locator("xpath=ancestor::*[contains(@class,'rounded')][1]");
await cartao.screenshot({ path: "19-gelado.png" });
console.log("ok: 19-gelado.png");
// numeros do cartao, para conferir a legenda do manual
console.log("gelado:", (await cartao.innerText()).replace(/\s+/g, " ").slice(0, 300));

await ir("/carga-inicial");
await foto("12-carga-inicial.png", 720);

// mais largo: em 1280 a coluna Fiado aberto, citada na legenda, fica fora da tela
await ir("/clientes", 1440);
await foto("13-clientes.png", 640, 1440);
await pg.setViewportSize({ width: 1280, height: 1000 });
await espera(500);

await pg.locator("button", { hasText: "Novo cliente" }).first().click();
await espera(500);
await fotoPainel("18-novo-cliente.png");
await pg.keyboard.press("Escape");

// ---------------------------------------------------------------- perfil do caixa
await pg.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("mercadinho.estado.v1"));
  st.usuarioAtualId = "u_marcos";
  localStorage.setItem("mercadinho.estado.v1", JSON.stringify(st));
});
await ir("/painel");
await foto("14-painel-caixa.png", 460);

// ---------------------------------------------------------------- celular
const ctxMob = await nav.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  locale: "pt-BR",
  isMobile: true,
  hasTouch: true,
});
await ctxMob.addInitScript(semIndicador);
const mob = await ctxMob.newPage();
await mob.goto(BASE, { waitUntil: "networkidle" });
await mob.waitForTimeout(1300);
await mob.locator("button", { hasText: "Maria Conceição" }).first().click();
await mob.waitForTimeout(1500);
await mob.goto(BASE + "/vendas", { waitUntil: "networkidle" });
await mob.waitForTimeout(1500);
const cartoes = mob.locator('li [role="button"][aria-expanded]');
await cartoes.nth(1).click();
await mob.waitForTimeout(700);
await cartoes.nth(1).scrollIntoViewIfNeeded();
await mob.waitForTimeout(500);
await mob.screenshot({ path: "15-celular.png" });
console.log("ok: 15-celular.png");

await nav.close();
console.log("erros de pagina:", erros.length ? erros : "nenhum");
