/**
 * Simula a primeira abertura: banco novo, sem ninguem, e a tela "Criar e continuar".
 * Usado por scripts/checar-instalador.mjs. Sai com 0 se criou tudo.
 */
import { banco, migrar } from "../lib/servidor/db";
import { configurar } from "../lib/servidor/contas";
import { estadoVazio } from "../lib/seed";

(async () => {
  migrar();
  const empresa = { ...(estadoVazio() as any).empresa, nomeFantasia: "Teste", razaoSocial: "Teste" };
  await configurar({ empresa, nome: "Teste", email: "teste@teste.com", senha: "Senha-de-teste-1" });
  const c = banco().$client;
  const produtos = (c.prepare("select count(*) n from produtos").get() as { n: number }).n;
  const usuarios = (c.prepare("select count(*) n from usuarios").get() as { n: number }).n;
  if (produtos !== 53 || usuarios !== 1) throw new Error(`produtos=${produtos} usuarios=${usuarios}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
