"use server";

/**
 * As acoes de conta (lib/servidor/contas.ts). So existem com banco. Cada uma
 * confere sessao e perfil aqui, antes de chamar a regra — so a primeira
 * abertura e a recuperacao de senha funcionam sem login.
 */

import { sessaoAtual } from "@/lib/servidor/auth";
import { fazerBackup, situacaoBackup } from "@/lib/servidor/backup";
import { temBanco } from "@/lib/servidor/db";
import {
  ErroConta,
  alterarUsuario,
  configurar,
  criarUsuario,
  novoCodigoRecuperacao,
  precisaConfigurar,
  recuperarSenha,
  redefinirSenha,
  salvarEmpresa,
  trocarMinhaSenha,
  type DadosConfiguracao,
} from "@/lib/servidor/contas";
import type { Empresa, Perfil, Usuario } from "@/lib/tipos";

export type Resposta<T> = { ok: true; valor: T } | { ok: false; erro: string };

async function tentar<T>(nome: string, fazer: () => T | Promise<T>): Promise<Resposta<T>> {
  try {
    return { ok: true, valor: await fazer() };
  } catch (e) {
    if (e instanceof ErroConta) return { ok: false, erro: e.message };
    console.error(`[${nome}]`, e);
    return { ok: false, erro: "Não foi possível gravar no banco. Tente de novo." };
  }
}

async function logado() {
  const s = await sessaoAtual();
  if (!s) throw new ErroConta("Sua sessão expirou. Entre de novo.");
  return s;
}

async function administracao() {
  const s = await logado();
  if (s.perfil !== "ADMIN") throw new ErroConta("Só a administração pode fazer isso.");
  return s;
}

export async function situacaoInicial() {
  return { precisaConfigurar: temBanco() && precisaConfigurar() };
}

export async function configurarSistema(d: DadosConfiguracao) {
  return tentar("configurar", () => configurar(d));
}

export async function recuperarAcesso(d: { email: string; codigo: string; novaSenha: string }) {
  return tentar("recuperar", () => recuperarSenha(d));
}

export async function trocarSenha(d: { atual: string; nova: string }) {
  return tentar("trocar senha", async () => trocarMinhaSenha((await logado()).usuarioId, d));
}

export async function gerarCodigoRecuperacao(senha: string) {
  return tentar("novo codigo", async () => novoCodigoRecuperacao((await administracao()).usuarioId, senha));
}

export async function cadastrarUsuario(d: { nome: string; email: string; perfil: Perfil; senha: string }) {
  return tentar<Usuario>("criar usuario", async () => criarUsuario((await administracao()).usuarioId, d));
}

export async function editarUsuario(d: { id: string; nome: string; email: string; perfil: Perfil; ativo: boolean }) {
  return tentar("alterar usuario", async () => alterarUsuario((await administracao()).usuarioId, d));
}

export async function definirSenhaDoUsuario(d: { id: string; senha: string }) {
  return tentar("redefinir senha", async () => redefinirSenha((await administracao()).usuarioId, d));
}

export async function gravarEmpresa(e: Empresa) {
  return tentar("empresa", async () => salvarEmpresa((await administracao()).usuarioId, e));
}

export async function lerSituacaoBackup() {
  return tentar("situacao do backup", async () => {
    await administracao();
    return situacaoBackup();
  });
}

export async function fazerBackupAgora() {
  return tentar("backup", async () => {
    await administracao();
    await fazerBackup();
    return situacaoBackup();
  });
}
