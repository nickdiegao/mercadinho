/**
 * O que sai do servidor para o navegador de cada perfil.
 *
 * Esconder custo na tela nao basta: o dado chegaria no navegador e qualquer
 * um veria pelas ferramentas do desenvolvedor. Por isso o servidor tira o
 * custo e o lucro antes de mandar.
 *
 *   CAIXA    nao recebe custo nem lucro, nem as entradas de mercadoria
 *   ESTOQUE  recebe custo, mas nao o lucro das vendas
 */

import type { Efeitos } from "./operacoes";
import type { Entrada, Estado, MovimentoEstoque, Perfil, Produto, Venda } from "./tipos";

/**
 * O caixa nao recebe o custo — so o sinal de que existe (1 = tem custo), para
 * a tela saber diferenciar "aguarda 1a entrada" de produto ja custeado.
 */
const sinalDeCusto = (c: number | undefined) => (c && c > 0 ? 1 : 0);

function produto(p: Partial<Produto>, perfil: Perfil): Partial<Produto> {
  if (perfil !== "CAIXA") return p;
  const r = { ...p };
  if ("custoMedio" in r) r.custoMedio = sinalDeCusto(r.custoMedio);
  if ("custoUltimaCompra" in r) r.custoUltimaCompra = sinalDeCusto(r.custoUltimaCompra);
  return r;
}

function venda(v: Partial<Venda>, perfil: Perfil): Partial<Venda> {
  if (perfil === "ADMIN") return v;
  const r = { ...v };
  if ("custoTotal" in r) r.custoTotal = 0;
  if (r.itens) r.itens = r.itens.map((i) => ({ ...i, custoUnit: 0 }));
  return r;
}

function movimento(m: MovimentoEstoque, perfil: Perfil): MovimentoEstoque {
  return perfil === "CAIXA" ? { ...m, custoUnitNoMomento: 0 } : m;
}

const entradas = (lista: Entrada[], perfil: Perfil) => (perfil === "CAIXA" ? [] : lista);

export const redigirVenda = (v: Venda, perfil: Perfil) => venda(v, perfil) as Venda;
export const redigirProduto = (p: Produto, perfil: Perfil) => produto(p, perfil) as Produto;

export function redigirEstado(e: Estado, perfil: Perfil): Estado {
  if (perfil === "ADMIN") return e;
  return {
    ...e,
    produtos: e.produtos.map((p) => produto(p, perfil) as Produto),
    vendas: e.vendas.map((v) => venda(v, perfil) as Venda),
    entradas: entradas(e.entradas, perfil),
    movimentos: e.movimentos.map((m) => movimento(m, perfil)),
  };
}

export function redigirEfeitos(ef: Efeitos, perfil: Perfil): Efeitos {
  if (perfil === "ADMIN") return ef;
  const { inserir, atualizar } = ef;
  return {
    inserir: {
      ...inserir,
      ...(inserir.produtos && { produtos: inserir.produtos.map((p) => produto(p, perfil) as Produto) }),
      ...(inserir.vendas && { vendas: inserir.vendas.map((v) => venda(v, perfil) as Venda) }),
      ...(inserir.entradas && { entradas: entradas(inserir.entradas, perfil) }),
      ...(inserir.movimentos && { movimentos: inserir.movimentos.map((m) => movimento(m, perfil)) }),
    },
    atualizar: {
      ...atualizar,
      ...(atualizar.produtos && {
        produtos: atualizar.produtos.map((p) => produto(p, perfil) as Partial<Produto> & { id: string }),
      }),
      ...(atualizar.vendas && {
        vendas: atualizar.vendas.map((v) => venda(v, perfil) as Partial<Venda> & { id: string }),
      }),
    },
  };
}
