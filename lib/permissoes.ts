/**
 * Quem pode o que — a matriz do blueprint, num lugar so.
 *
 * A tela usa para esconder botao (conveniencia). O servidor usa a mesma
 * funcao para recusar a acao (seguranca): quem chama a acao direto, sem passar
 * pela tela, cai na mesma regra.
 */

import type { Perfil } from "./tipos";

export function permissoes(perfil: Perfil | null | undefined) {
  const admin = perfil === "ADMIN";
  const caixa = perfil === "CAIXA";
  const estoque = perfil === "ESTOQUE";
  return {
    /** O operador de caixa nao ve custo nem lucro. */
    podeVerCusto: admin || estoque,
    podeVerLucro: admin,
    podeVender: admin || caixa,
    podeEstoque: admin || estoque,
    ehAdmin: admin,
    /** O caixa cadastra cliente no meio da venda; o estoque, nao. */
    podeCadastrarCliente: admin || caixa,
    /** O estoque cadastra produto novo quando chega carga, mas sem preco. */
    podeCadastrarProduto: admin || estoque,
    podeCadastrarFornecedor: admin || estoque,
    /** Preco de venda, tabela de atacado e limite de credito: so a dona. */
    podeDefinirPreco: admin,
    podeCancelarVenda: admin,
    /** Desativar cliente ou fornecedor tira da lista de todo mundo. */
    podeDesativarCadastro: admin,
  };
}

export type Permissoes = ReturnType<typeof permissoes>;
