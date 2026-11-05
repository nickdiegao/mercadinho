/** Leituras derivadas do estado. Nada aqui grava — so soma. */

import { custoItem, entraNoCaixa, estoqueValorizado, precisaRepor } from "./regras";
import type { Estado, Produto, TipoPreco, Venda } from "./tipos";

const DIA = 86400000;

export const inicioDoDia = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function vendasEntre(estado: Estado, de: Date, ate: Date): Venda[] {
  const a = de.getTime();
  const b = ate.getTime();
  return estado.vendas.filter((v) => {
    if (v.status !== "FECHADA") return false;
    const t = new Date(v.data).getTime();
    return t >= a && t <= b;
  });
}

export function totais(vendas: Venda[]) {
  const receita = vendas.reduce((a, v) => a + v.total, 0);
  const custo = vendas.reduce((a, v) => a + v.custoTotal, 0);
  return {
    receita,
    custo,
    lucro: receita - custo,
    margem: receita > 0 ? (receita - custo) / receita : 0,
    quantidade: vendas.length,
    ticket: vendas.length ? Math.round(receita / vendas.length) : 0,
  };
}

/** Serie diaria de receita e lucro para o grafico do painel. */
export function serieDiaria(estado: Estado, dias: number) {
  const hoje = inicioDoDia();
  const mapa = new Map<string, { receita: number; lucro: number }>();

  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * DIA);
    mapa.set(d.toISOString().slice(0, 10), { receita: 0, lucro: 0 });
  }

  for (const v of estado.vendas) {
    if (v.status !== "FECHADA") continue;
    const chave = v.data.slice(0, 10);
    const item = mapa.get(chave);
    if (!item) continue;
    item.receita += v.total;
    item.lucro += v.total - v.custoTotal;
  }

  return [...mapa.entries()].map(([dia, v]) => ({
    dia,
    receita: v.receita / 100,
    lucro: v.lucro / 100,
  }));
}

/** Ranking de produtos por receita, com lucro e quantidade. */
export function rankingProdutos(estado: Estado, vendas: Venda[]) {
  const acc = new Map<
    string,
    { produtoId: string; nome: string; qtd: number; receita: number; lucro: number }
  >();

  for (const v of vendas) {
    for (const it of v.itens) {
      const atual =
        acc.get(it.produtoId) ??
        { produtoId: it.produtoId, nome: it.descricao, qtd: 0, receita: 0, lucro: 0 };
      atual.qtd += it.qtd;
      atual.receita += it.total;
      atual.lucro += it.total - custoItem(it.qtd, it.custoUnit);
      acc.set(it.produtoId, atual);
    }
  }

  return [...acc.values()].sort((a, b) => b.receita - a.receita);
}

export function porCategoria(estado: Estado, vendas: Venda[]) {
  const nomeCat = new Map(estado.categorias.map((c) => [c.id, c.nome]));
  const catDoProduto = new Map(estado.produtos.map((p) => [p.id, p.categoriaId]));
  const acc = new Map<string, { nome: string; receita: number; lucro: number; qtd: number }>();

  for (const v of vendas) {
    for (const it of v.itens) {
      const cat = catDoProduto.get(it.produtoId) ?? "c_outros";
      const atual =
        acc.get(cat) ?? { nome: nomeCat.get(cat) ?? "Outros", receita: 0, lucro: 0, qtd: 0 };
      atual.receita += it.total;
      atual.lucro += it.total - custoItem(it.qtd, it.custoUnit);
      atual.qtd += it.qtd;
      acc.set(cat, atual);
    }
  }
  return [...acc.values()].sort((a, b) => b.receita - a.receita);
}

/**
 * Quanto o gelado rendeu a mais. Soma o adicional congelado em cada item —
 * a diferenca entre o preco gelado e o natural da mesma forma de venda (unidade
 * ou caixa) no dia da venda. E o numero que a dona compara com a conta de luz.
 */
export function resumoGelado(vendas: Venda[]) {
  let avulsas = 0;
  let emCaixa = 0;
  let receita = 0;
  let adicional = 0;
  for (const v of vendas) {
    for (const it of v.itens) {
      if (!it.gelado) continue;
      if (it.tipoPrecoAplicado === "ATACADO") emCaixa += it.qtd;
      else avulsas += it.qtd;
      receita += it.total;
      adicional += Math.round(it.qtd * (it.adicionalGelado ?? 0));
    }
  }
  return {
    unidades: avulsas + emCaixa,
    /** lata ou garrafa avulsa */
    avulsas,
    /** caixa ou fardo gelado */
    emCaixa,
    receita,
    adicional,
  };
}

/** Separa caixa de unidade — a leitura que o dono mais pede. */
export function porCanal(vendas: Venda[]) {
  const zera = () => ({ receita: 0, lucro: 0, itens: 0 });
  const canais: Record<TipoPreco, ReturnType<typeof zera>> = {
    ATACADO: zera(),
    VAREJO: zera(),
  };
  for (const v of vendas) {
    for (const it of v.itens) {
      const c = canais[it.tipoPrecoAplicado];
      c.receita += it.total;
      c.lucro += it.total - custoItem(it.qtd, it.custoUnit);
      c.itens += 1;
    }
  }
  return canais;
}

export function formasDePagamento(vendas: Venda[]) {
  const acc = new Map<string, number>();
  for (const v of vendas) {
    acc.set(v.formaPagamento, (acc.get(v.formaPagamento) ?? 0) + v.total);
  }
  return [...acc.entries()]
    .map(([forma, valor]) => ({ forma, valor }))
    .sort((a, b) => b.valor - a.valor);
}

// ---------------------------------------------------------------- caixa
export function sessaoAberta(estado: Estado) {
  return estado.caixaSessoes.find((c) => c.status === "ABERTA") ?? null;
}

/**
 * So dinheiro vivo compoe o valor esperado na gaveta.
 * PIX, debito e credito entram no faturamento, mas nao na contagem.
 */
export function resumoCaixa(estado: Estado, sessaoId?: string) {
  const sessao = sessaoId
    ? estado.caixaSessoes.find((c) => c.id === sessaoId)
    : sessaoAberta(estado);
  if (!sessao) return null;

  const movs = estado.caixaMovimentos
    .filter((m) => m.caixaSessaoId === sessao.id)
    .sort((a, b) => a.data.localeCompare(b.data));

  const emDinheiro = movs.filter(
    (m) => !m.formaPagamento || m.formaPagamento === "DINHEIRO",
  );
  const esperado = sessao.fundoTroco + emDinheiro.reduce((a, m) => a + m.valor, 0);
  // estorno de venda cancelada abate o faturado da sessao
  const faturado = movs
    .filter((m) => m.tipo === "VENDA" || m.tipo === "ESTORNO")
    .reduce((a, m) => a + m.valor, 0);

  return {
    sessao,
    movimentos: movs,
    esperado,
    faturado,
    sangrias: movs.filter((m) => m.tipo === "SANGRIA").reduce((a, m) => a + m.valor, 0),
    despesas: movs.filter((m) => m.tipo === "DESPESA").reduce((a, m) => a + m.valor, 0),
    diferenca:
      sessao.valorContado != null ? sessao.valorContado - esperado : null,
  };
}

// ---------------------------------------------------------------- estoque
export function vasilhames(estado: Estado): Produto[] {
  return estado.produtos.filter((p) => p.tipo === "VASILHAME");
}

export function cascosNaRua(estado: Estado): number {
  return vasilhames(estado).reduce((a, p) => a + p.saldoAtual, 0);
}

export function extrato(estado: Estado, produtoId: string) {
  return estado.movimentos
    .filter((m) => m.produtoId === produtoId)
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Painel: os numeros de cima. */
export function resumoPainel(estado: Estado) {
  const hoje = inicioDoDia();
  const agora = new Date();
  // janela movel de 30 dias em vez de mes corrente: num dia 1o o mes
  // corrente mostraria so o dia de hoje, e o painel pareceria vazio
  const inicioJanela = new Date(hoje.getTime() - 29 * DIA);

  const doDia = vendasEntre(estado, hoje, agora);
  const doMes = vendasEntre(estado, inicioJanela, agora);
  const normais = estado.produtos.filter((p) => p.tipo === "NORMAL" && p.ativo);

  return {
    dia: totais(doDia),
    mes: totais(doMes),
    estoque: estoqueValorizado(normais),
    itensEstoque: normais.reduce((a, p) => a + p.saldoAtual, 0),
    abaixoMinimo: normais.filter(precisaRepor),
    cascos: cascosNaRua(estado),
    caixa: resumoCaixa(estado),
    fiadoAberto: estado.vendas
      .filter((v) => v.status === "FECHADA" && v.formaPagamento === "FIADO")
      .reduce((a, v) => a + v.total, 0),
  };
}

export { entraNoCaixa };
