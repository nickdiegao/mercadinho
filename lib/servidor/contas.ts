/**
 * Contas de acesso: primeira abertura, usuarios, senhas e recuperacao.
 *
 * Fica fora de lib/operacoes.ts porque mexe com senha, e senha so existe no
 * servidor: a demonstracao nao tem nada disso.
 *
 *   - nenhuma senha vem pronta no instalador: a primeira abertura cria a
 *     administracao, e so funciona enquanto nao existe usuario nenhum
 *   - sistema local nao tem "esqueci a senha" por e-mail: a administracao
 *     recebe um codigo de recuperacao, mostrado uma vez e guardado so em hash
 *   - os outros usuarios recuperam a senha com a administracao
 */

import { compare, hash } from "bcryptjs";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { validarCNPJ } from "../documentos";
import { catalogoInicial, estadoVazio } from "../seed";
import type { Empresa, Perfil, Usuario } from "../tipos";
import { auditar } from "./auditoria";
import { banco, type Conexao } from "./db";
import { gravarEfeitos } from "./estado";
import * as t from "./schema";

const CUSTO_BCRYPT = 12;
const TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const PERFIS: Perfil[] = ["ADMIN", "CAIXA", "ESTOQUE"];

/** Recusa com mensagem para a tela. */
export class ErroConta extends Error {}

function falha(mensagem: string): never {
  throw new ErroConta(mensagem);
}

// ---------------------------------------------------------------- validacao

function validarSenha(senha: string) {
  if (senha.length < 8) falha("A senha precisa de pelo menos 8 caracteres.");
  // o bcrypt so olha os primeiros 72 bytes
  if (Buffer.byteLength(senha) > 72) falha("A senha pode ter no máximo 72 caracteres.");
}

function limparEmail(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) falha("Informe um e-mail válido.");
  return limpo;
}

function limparNome(nome: string) {
  const limpo = nome.trim();
  if (!limpo) falha("Informe o nome.");
  return limpo;
}

function limparEmpresa(e: Empresa): Empresa {
  const limpa = {
    razaoSocial: e.razaoSocial.trim(),
    nomeFantasia: e.nomeFantasia.trim(),
    cnpj: e.cnpj.trim(),
    inscricaoEstadual: e.inscricaoEstadual.trim(),
    regimeTributario: e.regimeTributario.trim(),
    endereco: e.endereco.trim(),
    telefone: e.telefone.trim(),
    email: e.email.trim(),
  };
  if (!limpa.razaoSocial) falha("Informe a razão social.");
  if (!limpa.nomeFantasia) falha("Informe o nome da empresa.");
  if (!validarCNPJ(limpa.cnpj)) falha("CNPJ inválido: confira os números.");
  return limpa;
}

function emailEmUso(db: Conexao, email: string, outroQue = "") {
  return Boolean(
    db
      .select({ id: t.usuarios.id })
      .from(t.usuarios)
      .where(and(sql`lower(${t.usuarios.email}) = ${email}`, ne(t.usuarios.id, outroQue)))
      .limit(1)
      .get(),
  );
}

const novoId = () => `u_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

// ---------------------------------------------------------------- recuperacao

// sem 0, O, 1 e I, que se confundem no papel
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** XXXX-XXXX-XXXX-XXXX: 80 bits, longe de qualquer tentativa no chute. */
function gerarCodigo() {
  const letras = [...randomBytes(16)].map((b) => ALFABETO[b % ALFABETO.length]).join("");
  return letras.match(/.{4}/g)!.join("-");
}

const normalizarCodigo = (codigo: string) => codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");

const hashCodigo = (codigo: string) => hash(normalizarCodigo(codigo), CUSTO_BCRYPT);

// ---------------------------------------------------------------- primeira abertura

/** So e verdade enquanto nao existe usuario nenhum. */
export function precisaConfigurar() {
  return (banco().select({ n: count() }).from(t.usuarios).get()?.n ?? 0) === 0;
}

export interface DadosConfiguracao {
  empresa: Empresa;
  nome: string;
  email: string;
  senha: string;
}

/** Cria a empresa e a administracao. Devolve o codigo de recuperacao. */
export async function configurar(d: DadosConfiguracao) {
  if (!precisaConfigurar()) falha("Este sistema já foi configurado.");
  const empresa = limparEmpresa(d.empresa);
  const nome = limparNome(d.nome);
  const email = limparEmail(d.email);
  validarSenha(d.senha);

  const codigo = gerarCodigo();
  const senhaHash = await hash(d.senha, CUSTO_BCRYPT);
  const recuperacaoHash = await hashCodigo(codigo);
  const id = novoId();

  banco().transaction(
    (tx) => {
      // conferido de novo aqui dentro: duas abas enviando juntas criam uma so
      const n = tx.select({ n: count() }).from(t.usuarios).get()?.n ?? 0;
      if (n > 0) falha("Este sistema já foi configurado.");
      tx.insert(t.empresa).values({ id: 1, ...empresa }).run();
      tx.insert(t.categorias).values(estadoVazio().categorias).run();
      // estoque ja cadastrado, com saldo 0
      gravarEfeitos(tx, { inserir: { produtos: catalogoInicial() }, atualizar: {} });
      auditar(tx, { usuarioId: id, acao: "CATALOGO_INICIAL", entidade: "produtos", detalhe: "catálogo inicial carregado" });
      tx.insert(t.usuarios).values({ id, nome, email, senhaHash, recuperacaoHash, perfil: "ADMIN" }).run();
      auditar(tx, { usuarioId: id, acao: "SISTEMA_CONFIGURADO", entidade: "empresa", detalhe: empresa.nomeFantasia });
    },
    { behavior: "immediate" },
  );
  return codigo;
}

/**
 * Banco criado antes de existir o catalogo inicial: carrega os produtos uma
 * unica vez, e so se o sistema ainda nao tem produto, venda nem movimento.
 * Quem ja cadastrou algo, ou ja apagou o catalogo, nao recebe nada de novo.
 */
export function carregarCatalogoSeVazio() {
  if (precisaConfigurar()) return false; // ainda nao abriu: a primeira abertura carrega
  const db = banco();
  const n = (tabela: typeof t.produtos | typeof t.vendas | typeof t.movimentosEstoque) =>
    db.select({ n: count() }).from(tabela).get()?.n ?? 0;
  if (n(t.produtos) > 0 || n(t.vendas) > 0 || n(t.movimentosEstoque) > 0) return false;
  const jaFoi = db.select({ n: count() }).from(t.logAuditoria).where(eq(t.logAuditoria.acao, "CATALOGO_INICIAL")).get()?.n ?? 0;
  if (jaFoi > 0) return false;

  db.transaction(
    (tx) => {
      gravarEfeitos(tx, { inserir: { produtos: catalogoInicial() }, atualizar: {} });
      auditar(tx, { usuarioId: null, acao: "CATALOGO_INICIAL", entidade: "produtos", detalhe: "catálogo inicial carregado na atualização" });
    },
    { behavior: "immediate" },
  );
  return true;
}

/** Sem usuario logado: quem prova ter o codigo troca a senha. */
export async function recuperarSenha(d: { email: string; codigo: string; novaSenha: string }) {
  validarSenha(d.novaSenha);
  const email = d.email.trim().toLowerCase();
  const u = banco()
    .select()
    .from(t.usuarios)
    .where(sql`lower(${t.usuarios.email}) = ${email}`)
    .limit(1)
    .get();

  const recusa = "E-mail ou código incorretos.";
  if (!u?.recuperacaoHash || !u.ativo) falha(recusa);
  if (u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date()) {
    falha("Conta bloqueada por 15 minutos depois de 5 tentativas erradas.");
  }

  if (!(await compare(normalizarCodigo(d.codigo), u.recuperacaoHash))) {
    const tentativas = u.tentativasFalhas + 1;
    const bloqueia = tentativas >= TENTATIVAS;
    banco()
      .update(t.usuarios)
      .set({
        tentativasFalhas: bloqueia ? 0 : tentativas,
        bloqueadoAte: bloqueia ? new Date(Date.now() + BLOQUEIO_MS).toISOString() : null,
      })
      .where(eq(t.usuarios.id, u.id))
      .run();
    auditar(banco(), { usuarioId: u.id, acao: "RECUPERACAO_FALHA", entidade: "usuario", entidadeId: u.id, detalhe: "código incorreto" });
    falha(recusa);
  }

  // o codigo usado morre aqui: quem o viu nao entra de novo
  const novo = gerarCodigo();
  const senhaHash = await hash(d.novaSenha, CUSTO_BCRYPT);
  const recuperacaoHash = await hashCodigo(novo);
  banco().transaction((tx) => {
    tx.update(t.usuarios)
      .set({ senhaHash, recuperacaoHash, tentativasFalhas: 0, bloqueadoAte: null })
      .where(eq(t.usuarios.id, u.id))
      .run();
    auditar(tx, { usuarioId: u.id, acao: "SENHA_RECUPERADA", entidade: "usuario", entidadeId: u.id, detalhe: "com o código de recuperação" });
  });
  return novo;
}

// ---------------------------------------------------------------- minha conta

async function conferirSenha(usuarioId: string, senha: string) {
  const u = banco().select().from(t.usuarios).where(eq(t.usuarios.id, usuarioId)).limit(1).get();
  if (!u || !(await compare(senha, u.senhaHash))) falha("A senha atual não confere.");
  return u;
}

export async function trocarMinhaSenha(usuarioId: string, d: { atual: string; nova: string }) {
  validarSenha(d.nova);
  await conferirSenha(usuarioId, d.atual);
  const senhaHash = await hash(d.nova, CUSTO_BCRYPT);
  banco().transaction((tx) => {
    tx.update(t.usuarios).set({ senhaHash }).where(eq(t.usuarios.id, usuarioId)).run();
    auditar(tx, { usuarioId, acao: "SENHA_TROCADA", entidade: "usuario", entidadeId: usuarioId, detalhe: "pelo próprio usuário" });
  });
}

/** O codigo anterior deixa de valer. */
export async function novoCodigoRecuperacao(usuarioId: string, senha: string) {
  const u = await conferirSenha(usuarioId, senha);
  if (u.perfil !== "ADMIN") falha("Só a administração tem código de recuperação.");
  const codigo = gerarCodigo();
  const recuperacaoHash = await hashCodigo(codigo);
  banco().transaction((tx) => {
    tx.update(t.usuarios).set({ recuperacaoHash }).where(eq(t.usuarios.id, usuarioId)).run();
    auditar(tx, { usuarioId, acao: "CODIGO_RECUPERACAO_GERADO", entidade: "usuario", entidadeId: usuarioId, detalhe: "código novo gerado" });
  });
  return codigo;
}

// ---------------------------------------------------------------- usuarios

function adminsAtivos(db: Conexao, excetoId: string) {
  return (
    db
      .select({ n: count() })
      .from(t.usuarios)
      .where(and(eq(t.usuarios.perfil, "ADMIN"), eq(t.usuarios.ativo, true), ne(t.usuarios.id, excetoId)))
      .get()?.n ?? 0
  );
}

export async function criarUsuario(
  autorId: string,
  d: { nome: string; email: string; perfil: Perfil; senha: string },
): Promise<Usuario> {
  const nome = limparNome(d.nome);
  const email = limparEmail(d.email);
  if (!PERFIS.includes(d.perfil)) falha("Perfil inválido.");
  validarSenha(d.senha);
  const senhaHash = await hash(d.senha, CUSTO_BCRYPT);
  const id = novoId();

  banco().transaction(
    (tx) => {
      if (emailEmUso(tx, email)) falha("Já existe um usuário com este e-mail.");
      tx.insert(t.usuarios).values({ id, nome, email, senhaHash, perfil: d.perfil }).run();
      auditar(tx, { usuarioId: autorId, acao: "USUARIO_CRIADO", entidade: "usuario", entidadeId: id, detalhe: `${nome} (${d.perfil})` });
    },
    { behavior: "immediate" },
  );
  return { id, nome, email, perfil: d.perfil, ativo: true };
}

export function alterarUsuario(
  autorId: string,
  d: { id: string; nome: string; email: string; perfil: Perfil; ativo: boolean },
) {
  const nome = limparNome(d.nome);
  const email = limparEmail(d.email);
  if (!PERFIS.includes(d.perfil)) falha("Perfil inválido.");

  banco().transaction(
    (tx) => {
      const atual = tx.select().from(t.usuarios).where(eq(t.usuarios.id, d.id)).limit(1).get();
      if (!atual) falha("Usuário não encontrado.");
      if (emailEmUso(tx, email, d.id)) falha("Já existe um usuário com este e-mail.");
      if (d.id === autorId && !d.ativo) falha("Você não pode desativar o próprio acesso.");
      // sem isso, ninguem mais conseguiria administrar o sistema
      const deixaDeSerAdmin = atual.perfil === "ADMIN" && atual.ativo && (d.perfil !== "ADMIN" || !d.ativo);
      if (deixaDeSerAdmin && adminsAtivos(tx, d.id) === 0) {
        falha("O sistema precisa de pelo menos uma administração ativa.");
      }
      tx.update(t.usuarios)
        .set({ nome, email, perfil: d.perfil, ativo: d.ativo })
        .where(eq(t.usuarios.id, d.id))
        .run();
      auditar(tx, {
        usuarioId: autorId,
        acao: "USUARIO_ALTERADO",
        entidade: "usuario",
        entidadeId: d.id,
        detalhe: `${nome} (${d.perfil}, ${d.ativo ? "ativo" : "desativado"})`,
      });
    },
    { behavior: "immediate" },
  );
}

/** A administracao define uma senha nova para quem esqueceu. Tira o bloqueio junto. */
export async function redefinirSenha(autorId: string, d: { id: string; senha: string }) {
  validarSenha(d.senha);
  const senhaHash = await hash(d.senha, CUSTO_BCRYPT);
  banco().transaction((tx) => {
    const alvo = tx.select({ nome: t.usuarios.nome }).from(t.usuarios).where(eq(t.usuarios.id, d.id)).limit(1).get();
    if (!alvo) falha("Usuário não encontrado.");
    tx.update(t.usuarios)
      .set({ senhaHash, tentativasFalhas: 0, bloqueadoAte: null })
      .where(eq(t.usuarios.id, d.id))
      .run();
    auditar(tx, { usuarioId: autorId, acao: "SENHA_REDEFINIDA", entidade: "usuario", entidadeId: d.id, detalhe: alvo.nome });
  });
}

// ---------------------------------------------------------------- empresa

export function salvarEmpresa(autorId: string, e: Empresa) {
  const empresa = limparEmpresa(e);
  banco().transaction((tx) => {
    tx.update(t.empresa).set(empresa).where(eq(t.empresa.id, 1)).run();
    auditar(tx, { usuarioId: autorId, acao: "EMPRESA_ALTERADA", entidade: "empresa", detalhe: empresa.nomeFantasia });
  });
  return empresa;
}
