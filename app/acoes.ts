"use server";

/**
 * As unicas portas do navegador para o banco.
 *
 * Toda chamada passa pelo mesmo caminho, nesta ordem:
 *   1. sessao      quem esta logado (conferido no banco)
 *   2. permissao   o perfil pode fazer isso? (lib/permissoes.ts)
 *   3. transacao   com trava: duas vendas ao mesmo tempo nao pegam o mesmo
 *                  numero nem baixam o mesmo saldo em dobro
 *   4. operacao    a regra de negocio (lib/operacoes.ts), a mesma da demo
 *   5. gravacao    tudo o que a operacao produziu, ou nada
 *   6. resposta    so o que o perfil pode ver (lib/redigir.ts)
 */

import { sql } from "drizzle-orm";
import {
  ErroOperacao,
  OPERACOES,
  executarOperacao,
  type DadosDe,
  type Efeitos,
  type NomeOperacao,
  type ValorDe,
} from "@/lib/operacoes";
import { redigirEfeitos, redigirEstado, redigirProduto, redigirVenda } from "@/lib/redigir";
import { banco } from "@/lib/servidor/db";
import { gravarEfeitos, lerEstado } from "@/lib/servidor/estado";
import { sessaoAtual } from "@/lib/servidor/auth";
import type { Estado, Perfil, Produto, Venda } from "@/lib/tipos";

/** Uma trava so para a loja inteira: escrita e uma de cada vez. */
const TRAVA_DA_LOJA = 7_424_201;

let contador = 0;
const novoId = (prefixo: string) =>
  `${prefixo}_${Date.now().toString(36)}${(contador++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export type RespostaCarga = { ok: true; estado: Estado } | { ok: false; erro: "sem-sessao" | string };

export async function carregarEstado(): Promise<RespostaCarga> {
  const sessao = await sessaoAtual();
  if (!sessao) return { ok: false, erro: "sem-sessao" };
  const estado = await lerEstado(banco());
  return { ok: true, estado: redigirEstado({ ...estado, usuarioAtualId: sessao.usuarioId }, sessao.perfil) };
}

export type RespostaOperacao<N extends NomeOperacao> =
  | { ok: true; valor: ValorDe<N>; efeitos: Efeitos }
  | { ok: false; erro: string; semSessao?: boolean };

export async function executar<N extends NomeOperacao>(
  nome: N,
  dados: DadosDe<N>,
): Promise<RespostaOperacao<N>> {
  if (!Object.hasOwn(OPERACOES, nome)) return { ok: false, erro: "Operação desconhecida." };

  const sessao = await sessaoAtual();
  if (!sessao) return { ok: false, erro: "Sua sessão expirou. Entre de novo.", semSessao: true };

  try {
    const r = await banco().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${TRAVA_DA_LOJA})`);
      const estado = await lerEstado(tx);
      const ctx = {
        agora: new Date().toISOString(),
        usuarioId: sessao.usuarioId,
        perfil: sessao.perfil,
        novoId,
      };
      // a permissao e checada aqui dentro, com o perfil que veio do banco
      const resultado = executarOperacao(nome, estado, ctx, dados);
      await gravarEfeitos(tx, resultado.efeitos);
      return resultado;
    });

    return {
      ok: true,
      valor: filtrarValor(nome, r.valor, sessao.perfil) as ValorDe<N>,
      efeitos: redigirEfeitos(r.efeitos, sessao.perfil),
    };
  } catch (e) {
    if (e instanceof ErroOperacao) return { ok: false, erro: e.message };
    console.error(`[executar ${nome}]`, e);
    return { ok: false, erro: "Não foi possível gravar no banco. Tente de novo." };
  }
}

/** O valor devolvido passa pelo mesmo filtro: venda sem custo para o caixa. */
function filtrarValor(nome: NomeOperacao, valor: unknown, perfil: Perfil) {
  if (nome === "registrarVenda" || nome === "cancelarVenda") return redigirVenda(valor as Venda, perfil);
  if (nome === "salvarProduto" || nome === "cadastrarProduto") return redigirProduto(valor as Produto, perfil);
  // entrada so e lancada por quem ve custo; o resto nao carrega custo
  return valor;
}
