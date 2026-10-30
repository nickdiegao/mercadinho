/**
 * Login com e-mail e senha (next-auth v4, Credentials).
 *
 *   - a senha nunca e guardada: so o hash bcrypt (custo 12)
 *   - 5 erros seguidos travam a conta por 15 minutos
 *   - cada entrada e cada falha vao para a trilha de auditoria
 *   - a sessao e um cookie httpOnly assinado: JavaScript nenhum le, entao um
 *     XSS nao rouba sessao
 */

import { eq, sql } from "drizzle-orm";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Perfil } from "../tipos";
import { banco } from "./db";
import * as t from "./schema";

const TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

/** Mensagens que a tela de login entende (vem no campo "error" do signIn). */
export const ERRO_LOGIN = {
  credenciais: "CredentialsSignin",
  bloqueado: "BLOQUEADO",
} as const;

let contador = 0;
const idLog = () => `lg_${Date.now().toString(36)}${(contador++).toString(36)}`;

function auditar(usuarioId: string | null, acao: "LOGIN" | "LOGIN_FALHA", detalhe: string) {
  banco()
    .insert(t.logAuditoria)
    .values({
      id: idLog(),
      ocorridoEm: new Date().toISOString(),
      usuarioId,
      acao,
      entidade: "usuario",
      entidadeId: usuarioId ?? "",
      detalhe,
    })
    .run();
}

async function autenticar(emailBruto: string, senha: string) {
  const email = emailBruto.trim().toLowerCase();
  if (!email || !senha) return null;

  const u = banco()
    .select()
    .from(t.usuarios)
    .where(sql`lower(${t.usuarios.email}) = ${email}`)
    .limit(1)
    .get();

  if (!u || !u.ativo) {
    auditar(u?.id ?? null, "LOGIN_FALHA", u ? `${email}: usuário desativado` : `${email}: e-mail não cadastrado`);
    return null;
  }

  if (u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date()) {
    auditar(u.id, "LOGIN_FALHA", `${email}: tentativa com a conta bloqueada`);
    throw new Error(ERRO_LOGIN.bloqueado);
  }

  if (!(await compare(senha, u.senhaHash))) {
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
    auditar(u.id, "LOGIN_FALHA", bloqueia ? `${email}: senha errada, conta bloqueada por 15 min` : `${email}: senha errada (${tentativas}/${TENTATIVAS})`);
    if (bloqueia) throw new Error(ERRO_LOGIN.bloqueado);
    return null;
  }

  banco()
    .update(t.usuarios)
    .set({ tentativasFalhas: 0, bloqueadoAte: null })
    .where(eq(t.usuarios.id, u.id))
    .run();
  auditar(u.id, "LOGIN", email);
  return { id: u.id, name: u.nome, email: u.email, perfil: u.perfil };
}

export const opcoesAuth: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // um turno de loja
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: { email: { type: "email" }, senha: { type: "password" } },
      authorize: (c) => autenticar(c?.email ?? "", c?.senha ?? ""),
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.perfil = (user as unknown as { perfil: Perfil }).perfil;
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, uid: token.uid, perfil: token.perfil } as typeof session;
    },
  },
};

export interface SessaoDoSistema {
  usuarioId: string;
  perfil: Perfil;
}

/**
 * Quem esta logado, conferido no banco a cada chamada: usuario desativado ou
 * com perfil trocado perde o acesso na hora, sem esperar o cookie vencer.
 */
export async function sessaoAtual(): Promise<SessaoDoSistema | null> {
  const s = (await getServerSession(opcoesAuth)) as { uid?: string } | null;
  if (!s?.uid) return null;
  const u = banco()
    .select({ id: t.usuarios.id, perfil: t.usuarios.perfil, ativo: t.usuarios.ativo })
    .from(t.usuarios)
    .where(eq(t.usuarios.id, s.uid))
    .limit(1)
    .get();
  if (!u?.ativo) return null;
  return { usuarioId: u.id, perfil: u.perfil };
}
