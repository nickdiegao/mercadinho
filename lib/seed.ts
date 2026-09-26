/**
 * Dados ficticios de uma distribuidora de bebidas.
 *
 * Empresa, CNPJ, clientes e fornecedores sao todos inventados. O catalogo usa
 * descricao generica ("Cerveja Pilsen Lata 350ml"), com excecao da linha de
 * cola, que leva a marca real por pedido do cliente — distribuidora de bebidas
 * revende o produto, entao listar a marca no catalogo e o que ela faz na vida
 * real. Trocar por generico e so editar CATALOGO.
 *
 * O historico de 60 dias e gerado por um PRNG com semente fixa: os numeros
 * mudam de dia (as datas sao relativas a hoje) mas nunca sao aleatorios de
 * verdade, entao a demo e sempre a mesma dentro do mesmo dia.
 */

import { custoUnitBase, novoCustoMedio, paraBase, precoAplicavel, totalItem, custoItem } from "./regras";
import type {
  CaixaMovimento,
  CaixaSessao,
  Categoria,
  Cliente,
  Documento,
  Entrada,
  EntradaItem,
  Estado,
  Fornecedor,
  MovimentoEstoque,
  Produto,
  Usuario,
  Venda,
  VendaItem,
  FormaPagamento,
} from "./tipos";

// ---------------------------------------------------------------- PRNG
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rnd = mulberry32(20260901);
const ri = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;

let seqId = 0;
const id = (prefixo: string) => `${prefixo}_${(++seqId).toString(36)}`;

// ---------------------------------------------------------------- estaticos
const empresa = {
  razaoSocial: "Distribuidora de Bebidas Ltda",
  nomeFantasia: "Distribuidora",
  cnpj: "97.318.905/0001-46",
  inscricaoEstadual: "112.480.339.117",
  regimeTributario: "Simples Nacional",
  endereco: "Av. das Palmeiras, 1420 — Distrito Industrial, Campinas/SP — CEP 13052-410",
  telefone: "(19) 3245-8890",
  email: "contato@distribuidora.com.br",
};

const usuarios: Usuario[] = [
  { id: "u_ana", nome: "Maria Conceição", email: "maria@distribuidora.com.br", perfil: "ADMIN", ativo: true },
  { id: "u_marcos", nome: "Marcos Antunes", email: "marcos@distribuidora.com.br", perfil: "CAIXA", ativo: true },
  { id: "u_jorge", nome: "Jorge Nakamura", email: "jorge@distribuidora.com.br", perfil: "ESTOQUE", ativo: true },
];

const categorias: Categoria[] = [
  { id: "c_cerveja", nome: "Cerveja" },
  { id: "c_refri", nome: "Refrigerante" },
  { id: "c_agua", nome: "Água" },
  { id: "c_energ", nome: "Energético" },
  { id: "c_suco", nome: "Suco" },
  { id: "c_dest", nome: "Destilado" },
  { id: "c_outros", nome: "Outros" },
  { id: "c_vasilhame", nome: "Vasilhame" },
];

const fornecedores: Fornecedor[] = [
  { id: "f_1", razaoSocial: "Atacadão de Bebidas Vale Verde S.A.", cnpj: "97.774.201/0001-88", telefone: "(19) 3388-1200", email: "pedidos@valeverde.com.br", endereco: "Rod. Anhanguera, km 98 — Sumaré/SP" },
  { id: "f_2", razaoSocial: "Cervejaria Monte Claro Ltda", cnpj: "97.556.930/0001-68", telefone: "(11) 4477-9021", email: "comercial@monteclaro.com.br", endereco: "Av. Industrial, 780 — Jundiaí/SP" },
  { id: "f_3", razaoSocial: "Águas Cristalinas do Sul Ltda", cnpj: "97.031.448/0001-04", telefone: "(19) 3521-4460", email: "vendas@aguascristalinas.com.br", endereco: "Estrada da Serra, 2100 — Águas de Lindóia/SP" },
  { id: "f_4", razaoSocial: "Refrigerantes Bom Sabor Indústria Ltda", cnpj: "97.902.318/0001-08", telefone: "(19) 3799-3311", email: "sac@bomsabor.ind.br", endereco: "Av. Getúlio Vargas, 5500 — Americana/SP" },
  { id: "f_5", razaoSocial: "Premium Spirits Importadora Ltda", cnpj: "97.408.226/0001-68", telefone: "(11) 5088-7744", email: "atendimento@premiumspirits.com.br", endereco: "Rua Funchal, 260 — São Paulo/SP" },
];

const clientes: Cliente[] = [
  { id: "cl_1", tipo: "PJ", nomeRazao: "Bar do Zeca Ltda ME", cpfCnpj: "97.808.114/0001-02", inscricaoEstadual: "336.902.114.005", telefone: "(19) 99771-4402", email: "bardozeca@gmail.com", endereco: "Rua Sete de Setembro, 340 — Centro, Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 300000, ativo: true },
  { id: "cl_2", tipo: "PJ", nomeRazao: "Mercearia Santa Luzia Ltda", cpfCnpj: "97.447.290/0001-58", inscricaoEstadual: "224.881.007.339", telefone: "(19) 3226-7781", email: "santaluzia@uol.com.br", endereco: "Av. Brasil, 1180 — Jd. Chapadão, Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 500000, ativo: true },
  { id: "cl_3", tipo: "PJ", nomeRazao: "Restaurante Sabor Mineiro Eireli", cpfCnpj: "97.129.760/0001-35", inscricaoEstadual: "441.205.998.220", telefone: "(19) 3244-1190", email: "sabormineiro@hotmail.com", endereco: "Rua Barão de Jaguara, 902 — Centro, Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 400000, ativo: true },
  { id: "cl_4", tipo: "PJ", nomeRazao: "Conveniência Posto Ipê Ltda", cpfCnpj: "97.663.508/0001-01", inscricaoEstadual: "118.774.320.661", telefone: "(19) 3877-2200", email: "postoipe@terra.com.br", endereco: "Rod. Dom Pedro I, km 132 — Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 600000, ativo: true },
  { id: "cl_5", tipo: "PJ", nomeRazao: "Adega Vinho & Cia Ltda ME", cpfCnpj: "97.220.877/0001-20", inscricaoEstadual: "552.019.443.870", telefone: "(19) 98812-3355", email: "adegavinhoecia@gmail.com", endereco: "Rua Coronel Quirino, 1455 — Cambuí, Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 250000, ativo: true },
  { id: "cl_6", tipo: "PJ", nomeRazao: "Lanchonete Estrela Azul Ltda", cpfCnpj: "97.905.332/0001-57", inscricaoEstadual: "667.443.001.229", telefone: "(19) 3255-8890", email: "estrelaazul@bol.com.br", endereco: "Av. John Boyd Dunlop, 3200 — Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 200000, ativo: true },
  { id: "cl_7", tipo: "PJ", nomeRazao: "Buffet Recanto das Flores Ltda", cpfCnpj: "97.774.019/0001-27", inscricaoEstadual: "993.107.556.418", telefone: "(19) 3298-4471", email: "recantodasflores@gmail.com", endereco: "Estrada da Rhodia, 890 — Barão Geraldo, Campinas/SP", tipoPreco: "ATACADO", limiteCredito: 350000, ativo: true },
  { id: "cl_8", tipo: "PF", nomeRazao: "Cláudia Ferreira Lima", cpfCnpj: "324.887.109-11", telefone: "(19) 99120-8834", endereco: "Rua das Acácias, 88 — Jd. Nova Europa, Campinas/SP", tipoPreco: "VAREJO", limiteCredito: 0, ativo: true },
  { id: "cl_9", tipo: "PF", nomeRazao: "Roberto Salgado Pinheiro", cpfCnpj: "118.442.907-35", telefone: "(19) 98844-1207", endereco: "Rua Tiradentes, 415 — Vila Industrial, Campinas/SP", tipoPreco: "VAREJO", limiteCredito: 0, ativo: true },
  { id: "cl_10", tipo: "PF", nomeRazao: "Simone Duarte Nogueira", cpfCnpj: "907.331.228-09", telefone: "(19) 99655-7710", endereco: "Av. Orosimbo Maia, 2200 — Centro, Campinas/SP", tipoPreco: "VAREJO", limiteCredito: 0, ativo: true },
  { id: "cl_11", tipo: "PF", nomeRazao: "Edson Batista da Silva", cpfCnpj: "445.019.663-51", telefone: "(19) 98330-9925", endereco: "Rua Amoreiras, 76 — Jd. Aurélia, Campinas/SP", tipoPreco: "VAREJO", limiteCredito: 0, ativo: true },
  { id: "cl_12", tipo: "PF", nomeRazao: "Patrícia Moraes Tavares", cpfCnpj: "662.774.310-80", telefone: "(19) 99441-2038", endereco: "Rua Sales de Oliveira, 1290 — Vila Industrial, Campinas/SP", tipoPreco: "VAREJO", limiteCredito: 0, ativo: true },
];

/** [nome, categoria, unCompra, fator, custoCompraCentavos, varejo, atacado, minAtacado, estMin, ncm, vasilhame?] */
type LinhaProduto = [string, string, string, number, number, number, number, number, number, string, string?];

const CATALOGO: LinhaProduto[] = [
  ["Cerveja Pilsen Lata 350ml", "c_cerveja", "CX", 12, 3840, 450, 380, 12, 240, "2203.00.00"],
  ["Cerveja Pilsen Lata 473ml", "c_cerveja", "CX", 12, 5040, 590, 500, 12, 180, "2203.00.00"],
  ["Cerveja Pilsen Garrafa 600ml", "c_cerveja", "ENG", 24, 9120, 550, 460, 24, 240, "2203.00.00", "v_600"],
  ["Cerveja Puro Malte Lata 350ml", "c_cerveja", "CX", 12, 4560, 520, 440, 12, 144, "2203.00.00"],
  ["Cerveja Puro Malte Long Neck 355ml", "c_cerveja", "CX", 24, 10800, 650, 550, 24, 120, "2203.00.00"],
  ["Cerveja de Trigo Long Neck 355ml", "c_cerveja", "CX", 24, 14880, 890, 760, 24, 72, "2203.00.00"],
  ["Cerveja Sem Álcool Lata 350ml", "c_cerveja", "CX", 12, 4200, 490, 420, 12, 96, "2202.91.00"],
  ["Cerveja Pilsen Litrão 1L", "c_cerveja", "ENG", 12, 7440, 890, 750, 12, 120, "2203.00.00", "v_1l"],
  ["Coca-Cola 2L", "c_refri", "FD", 6, 4740, 1090, 920, 6, 90, "2202.10.00"],
  ["Coca-Cola Lata 350ml", "c_refri", "CX", 12, 3120, 390, 320, 12, 144, "2202.10.00"],
  ["Coca-Cola 600ml", "c_refri", "FD", 12, 4560, 550, 460, 12, 120, "2202.10.00"],
  ["Refrigerante Guaraná 2L", "c_refri", "FD", 6, 4320, 990, 850, 6, 90, "2202.10.00"],
  ["Refrigerante Guaraná Lata 350ml", "c_refri", "CX", 12, 2880, 350, 300, 12, 144, "2202.10.00"],
  ["Refrigerante Laranja 2L", "c_refri", "FD", 6, 4140, 950, 810, 6, 60, "2202.10.00"],
  ["Refrigerante Limão 2L", "c_refri", "FD", 6, 4140, 950, 810, 6, 60, "2202.10.00"],
  ["Refrigerante Uva 2L", "c_refri", "FD", 6, 4200, 960, 820, 6, 60, "2202.10.00"],
  ["Água Mineral sem Gás 500ml", "c_agua", "FD", 12, 1440, 250, 180, 12, 240, "2201.10.00"],
  ["Água Mineral sem Gás 1,5L", "c_agua", "FD", 6, 1380, 390, 310, 6, 120, "2201.10.00"],
  ["Água Mineral com Gás 500ml", "c_agua", "FD", 12, 1800, 290, 220, 12, 120, "2201.10.00"],
  ["Água de Coco 1L", "c_agua", "CX", 12, 8280, 990, 850, 12, 72, "2009.89.00"],
  ["Energético Lata 250ml", "c_energ", "CX", 24, 11520, 750, 620, 24, 120, "2202.99.00"],
  ["Energético Lata 473ml", "c_energ", "CX", 12, 9480, 1190, 990, 12, 72, "2202.99.00"],
  ["Energético Tropical 269ml", "c_energ", "CX", 24, 10080, 690, 560, 24, 96, "2202.99.00"],
  ["Suco de Uva Integral 1L", "c_suco", "CX", 12, 10680, 1290, 1090, 12, 60, "2009.61.00"],
  ["Suco de Laranja 1L", "c_suco", "CX", 12, 7440, 890, 760, 12, 72, "2009.12.00"],
  ["Néctar de Manga 1L", "c_suco", "CX", 12, 5400, 690, 570, 12, 60, "2009.89.00"],
  ["Refresco em Pó Sortido 25g", "c_suco", "CX", 15, 1350, 180, 130, 15, 150, "2106.90.00"],
  ["Cachaça Prata 965ml", "c_dest", "CX", 12, 14280, 1790, 1490, 12, 48, "2208.40.00"],
  ["Vodka Nacional 900ml", "c_dest", "CX", 6, 14940, 3690, 3090, 6, 24, "2208.60.00"],
  ["Whisky Nacional 1L", "c_dest", "CX", 6, 23940, 5690, 4890, 6, 18, "2208.30.00"],
  ["Gin Nacional 750ml", "c_dest", "CX", 6, 19740, 4890, 4190, 6, 18, "2208.50.00"],
  ["Rum Nacional 700ml", "c_dest", "CX", 6, 16740, 3990, 3390, 6, 18, "2208.40.00"],
  ["Gelo em Cubo 5kg", "c_outros", "UN", 1, 480, 900, 700, 10, 60, "2201.90.00"],
  ["Carvão Vegetal 3kg", "c_outros", "UN", 1, 890, 1490, 1200, 10, 40, "4402.90.00"],
];

const VASILHAMES: Array<[string, string, number]> = [
  ["v_600", "Casco Garrafa 600ml", 150],
  ["v_1l", "Casco Garrafa 1L", 200],
];

// ---------------------------------------------------------------- gelado
/** Categorias que vao para a geladeira. Destilado, gelo e carvao nao. */
const CATEGORIAS_GELADAS = new Set(["c_cerveja", "c_refri", "c_agua", "c_energ", "c_suco"]);
const NAO_GELA = new Set(["Refresco em Pó Sortido 25g"]);

/**
 * Preco gelado inicial do catalogo ficticio: varejo + um adicional por faixa.
 * E so o ponto de partida da demonstracao — no sistema o preco gelado e fixo
 * e editavel por produto.
 */
export function geladoPadrao(nome: string, categoriaId: string, varejo: number) {
  if (!CATEGORIAS_GELADAS.has(categoriaId) || NAO_GELA.has(nome)) return null;
  const adicional = varejo <= 400 ? 50 : varejo <= 700 ? 70 : varejo <= 1000 ? 100 : 150;
  return varejo + adicional;
}

// ---------------------------------------------------------------- geracao
const DIA = 86400000;

function diaAs(base: Date, diasAtras: number, hora: number, minuto: number) {
  const d = new Date(base.getTime() - diasAtras * DIA);
  d.setHours(hora, minuto, ri(0, 59), 0);
  return d;
}

export function gerarEstado(): Estado {
  rnd = mulberry32(20260901);
  seqId = 0;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const produtos: Produto[] = [];
  const movimentos: MovimentoEstoque[] = [];
  const entradas: Entrada[] = [];
  const vendas: Venda[] = [];
  const caixaSessoes: CaixaSessao[] = [];
  const caixaMovimentos: CaixaMovimento[] = [];
  const documentos: Documento[] = [];

  // ---- vasilhames primeiro (produtos apontam para eles)
  for (const [vid, nome, custo] of VASILHAMES) {
    produtos.push({
      id: vid,
      sku: vid.toUpperCase().replace("_", "-"),
      codigoBarras: "",
      nome,
      categoriaId: "c_vasilhame",
      tipo: "VASILHAME",
      unidadeBase: "UN",
      unidadeCompra: "UN",
      fatorConversao: 1,
      custoMedio: custo * 100,
      custoUltimaCompra: custo * 100,
      precoVarejo: 0,
      precoAtacado: 0,
      qtdMinimaAtacado: 0,
      estoqueMinimo: 0,
      saldoAtual: 0, // para vasilhame: unidades na rua
      ncm: "7010.90.21",
      ativo: true,
    });
  }

  // ---- catalogo
  CATALOGO.forEach((l, i) => {
    const [nome, cat, unC, fator, custoCompra, varejo, atacado, minAt, estMin, ncm, vasilhame] = l;
    const custoBase = custoUnitBase(custoCompra, fator);
    produtos.push({
      id: `p_${i + 1}`,
      sku: `SKU${String(i + 1).padStart(4, "0")}`,
      codigoBarras: `789${String(1000000 + i * 7919).padStart(10, "0")}`,
      nome,
      categoriaId: cat,
      tipo: "NORMAL",
      vasilhameId: vasilhame,
      unidadeBase: "UN",
      unidadeCompra: unC as Produto["unidadeCompra"],
      fatorConversao: fator,
      custoMedio: custoBase,
      custoUltimaCompra: custoBase,
      precoVarejo: varejo,
      precoAtacado: atacado,
      ...(() => {
        const g = geladoPadrao(nome, cat, varejo);
        return g ? { vendeGelado: true, precoGelado: g } : { vendeGelado: false };
      })(),
      qtdMinimaAtacado: minAt,
      estoqueMinimo: estMin,
      saldoAtual: 0,
      ncm,
      ativo: true,
    });
  });

  const porId = new Map(produtos.map((p) => [p.id, p]));
  const normais = produtos.filter((p) => p.tipo === "NORMAL");

  function mover(
    produtoId: string,
    qtd: number,
    tipo: MovimentoEstoque["tipo"],
    origemTipo: MovimentoEstoque["origemTipo"],
    origemId: string | undefined,
    quando: Date,
    usuarioId: string,
    motivo?: string,
  ) {
    const p = porId.get(produtoId)!;
    p.saldoAtual = Math.round((p.saldoAtual + qtd) * 1000) / 1000;
    movimentos.push({
      id: id("mv"),
      produtoId,
      data: quando.toISOString(),
      tipo,
      qtd,
      saldoApos: p.saldoAtual,
      custoUnitNoMomento: p.custoMedio,
      origemTipo,
      origemId,
      usuarioId,
      motivo,
    });
  }

  // ---- carga inicial, 70 dias atras
  const dataCarga = diaAs(hoje, 70, 8, 30);
  for (const p of normais) {
    const cxs = Math.max(3, Math.round((p.estoqueMinimo * ri(280, 430)) / 100 / p.fatorConversao));
    mover(p.id, cxs * p.fatorConversao, "INVENTARIO_INICIAL", "CARGA_INICIAL", undefined, dataCarga, "u_jorge", "Inventário de abertura");
  }

  let numEntrada = 1;
  let numVenda = 1;
  let numDoc = 1;

  const fornecedorDoProduto = (catId: string) => {
    if (catId === "c_cerveja") return "f_2";
    if (catId === "c_refri") return "f_4";
    if (catId === "c_agua") return "f_3";
    if (catId === "c_dest") return "f_5";
    return "f_1";
  };
  const custoTabela = new Map(CATALOGO.map((c) => [c[0], c[4] as number]));

  const clientesAtacado = clientes.filter((c) => c.tipoPreco === "ATACADO");
  const clientesVarejo = clientes.filter((c) => c.tipoPreco === "VAREJO");
  const formas: FormaPagamento[] = ["DINHEIRO", "PIX", "PIX", "DEBITO", "CREDITO", "DINHEIRO", "FIADO"];

  /**
   * Um unico loop por dia, do mais antigo para hoje: primeiro a carga que
   * chega de manha, depois as vendas do dia. E o que garante que o saldoApos
   * de cada movimento bata com a ordem cronologica do extrato — se as entradas
   * fossem geradas todas antes, o kardex mostraria saldo que nunca existiu.
   */
  for (let d = 69; d >= 0; d -= 1) {
    const dow = new Date(hoje.getTime() - d * DIA).getDay();
    const domingo = dow === 0;

    // ---------- reposicao da manha
    if (!domingo && chance(0.85)) {
      // o comprador atende primeiro o fornecedor com mais produto faltando —
      // e o que mantem a prateleira cheia sem precisar de carga todo dia
      const precisando = (fid: string) =>
        normais.filter(
          (p) =>
            fornecedorDoProduto(p.categoriaId) === fid &&
            p.saldoAtual < p.estoqueMinimo * 2.6,
        );
      const forn = [...fornecedores].sort(
        (a, b) => precisando(b.id).length - precisando(a.id).length,
      )[0];
      const candidatos = precisando(forn.id);

      if (candidatos.length) {
        const quando = diaAs(hoje, d, ri(7, 10), ri(0, 59));
        const itens: EntradaItem[] = [];
        const escolhidos = candidatos
          .sort((a, b) => a.saldoAtual / a.estoqueMinimo - b.saldoAtual / b.estoqueMinimo)
          .slice(0, ri(6, 12));

        for (const p of escolhidos) {
          // compra o suficiente para voltar a uns 3,5x o estoque minimo
          const alvo = p.estoqueMinimo * 4.2;
          const faltam = Math.max(p.fatorConversao, alvo - p.saldoAtual);
          const qtdCompra = Math.max(2, Math.ceil(faltam / p.fatorConversao));

          // o fornecedor varia o preco entre -4% e +9% a cada carga
          const tabela = custoTabela.get(p.nome)!;
          const custoUnitCompra = Math.round(tabela * (1 + ri(-40, 90) / 1000));
          const cBase = custoUnitBase(custoUnitCompra, p.fatorConversao);
          const qtdBase = paraBase(qtdCompra, p.fatorConversao);

          // regra 2: o custo medio so muda aqui, e antes do saldo mudar
          p.custoMedio = novoCustoMedio(p.saldoAtual, p.custoMedio, qtdBase, cBase);
          p.custoUltimaCompra = cBase;

          itens.push({
            id: id("ei"),
            produtoId: p.id,
            qtdCompra,
            unidadeCompra: p.unidadeCompra,
            fatorConversao: p.fatorConversao,
            qtdBase,
            custoUnitCompra,
            custoUnitBase: cBase,
            valorTotal: qtdCompra * custoUnitCompra,
          });
        }

        if (itens.length) {
          const entrada: Entrada = {
            id: id("en"),
            numero: numEntrada++,
            fornecedorId: forn.id,
            data: quando.toISOString(),
            documentoFornecedor: `NF ${ri(10000, 99999)}`,
            itens,
            valorTotal: itens.reduce((a, i) => a + i.valorTotal, 0),
            usuarioId: "u_jorge",
          };
          for (const it of itens) {
            mover(it.produtoId, it.qtdBase, "ENTRADA", "ENTRADA", entrada.id, quando, "u_jorge");
          }
          entradas.push(entrada);
        }
      }
    }

    if (domingo) continue; // loja fechada: sem vendas e sem caixa

    // ---------- vendas do dia
    const sessao: CaixaSessao = {
      id: id("cs"),
      usuarioId: "u_marcos",
      abertaEm: diaAs(hoje, d, 8, 0).toISOString(),
      fundoTroco: 20000,
      status: "ABERTA",
    };

    // sexta e sabado vendem mais
    const quantasVendas = dow === 5 || dow === 6 ? ri(11, 18) : ri(5, 11);

    for (let v = 0; v < quantasVendas; v++) {
      const atacado = chance(0.42);
      const cliente = atacado
        ? pick(clientesAtacado)
        : chance(0.45)
          ? pick(clientesVarejo)
          : null;

      const quando = diaAs(hoje, d, ri(8, 18), ri(0, 59));
      if (quando.getTime() > Date.now()) {
        quando.setTime(Date.now() - ri(120000, 5400000));
      }

      const nItens = atacado ? ri(2, 6) : ri(1, 3);
      const itens: VendaItem[] = [];
      const usados = new Set<string>();

      for (let k = 0; k < nItens; k++) {
        const p = pick(normais);
        if (usados.has(p.id)) continue;
        usados.add(p.id);

        let qtd = atacado
          ? p.fatorConversao * ri(1, 4)
          : ri(1, Math.max(2, Math.round(p.fatorConversao / 2)));

        // nunca vende mais do que existe: o saldo do mockup nao fica negativo
        qtd = Math.min(qtd, Math.max(0, Math.floor(p.saldoAtual)));
        if (qtd <= 0) continue;

        // no balcao, boa parte de quem leva cerveja e refrigerante quer gelado
        const querGelado = !atacado && p.vendeGelado === true && chance(0.55);
        const { tipo, preco, gelado } = precoAplicavel(p, qtd, cliente, querGelado);
        itens.push({
          id: id("vi"),
          produtoId: p.id,
          descricao: p.nome,
          qtd,
          precoUnit: preco,
          custoUnit: p.custoMedio, // regra 3: congela aqui
          tipoPrecoAplicado: tipo,
          ...(gelado
            ? { gelado: true, adicionalGelado: preco - p.precoVarejo }
            : {}),
          total: totalItem(qtd, preco),
        });
      }

      if (!itens.length) continue;

      const subtotal = itens.reduce((a, i) => a + i.total, 0);
      const desconto = atacado && chance(0.3) ? Math.round(subtotal * (ri(1, 4) / 100)) : 0;
      const custoTotal = itens.reduce((a, i) => a + custoItem(i.qtd, i.custoUnit), 0);
      const forma = atacado ? pick(formas) : pick(formas.filter((f) => f !== "FIADO"));

      const venda: Venda = {
        id: id("vd"),
        numero: numVenda++,
        clienteId: cliente?.id,
        data: quando.toISOString(),
        usuarioId: "u_marcos",
        caixaSessaoId: sessao.id,
        tipoPreco: itens[0].tipoPrecoAplicado,
        itens,
        subtotal,
        desconto,
        total: subtotal - desconto,
        custoTotal,
        formaPagamento: forma,
        status: "FECHADA",
      };
      vendas.push(venda);

      for (const it of itens) {
        mover(it.produtoId, -it.qtd, "SAIDA", "VENDA", venda.id, quando, "u_marcos");
        // regra 5: o casco sai junto com a garrafa
        const prod = porId.get(it.produtoId)!;
        if (prod.vasilhameId) {
          mover(prod.vasilhameId, it.qtd, "ENTRADA", "VENDA", venda.id, quando, "u_marcos", "Casco com o cliente");
        }
      }

      // regra 4: fiado nao entra no caixa
      if (forma !== "FIADO") {
        caixaMovimentos.push({
          id: id("cm"),
          caixaSessaoId: sessao.id,
          data: quando.toISOString(),
          tipo: "VENDA",
          formaPagamento: forma,
          valor: venda.total,
          vendaId: venda.id,
          descricao: `Venda ${String(venda.numero).padStart(5, "0")}`,
        });
      }

      if (cliente && chance(0.35)) {
        documentos.push({
          id: id("dc"),
          vendaId: venda.id,
          tipo: "RECIBO",
          numero: numDoc++,
          emitidoEm: quando.toISOString(),
          emitenteSnapshot: { ...empresa },
          destinatarioSnapshot: { ...cliente },
        });
      }
    }

    // ---------- devolucao de casco no fim da tarde
    for (const [vid] of VASILHAMES) {
      const p = porId.get(vid)!;
      if (p.saldoAtual > 40 && chance(0.55)) {
        const volta = Math.round(p.saldoAtual * (ri(20, 55) / 100));
        if (volta > 0) {
          mover(vid, -volta, "DEVOLUCAO", "AJUSTE", undefined, diaAs(hoje, d, 16, 30), "u_jorge", "Casco devolvido pelo cliente");
        }
      }
    }

    // ---------- movimentos de caixa avulsos
    // Sangria e despesa saem da gaveta, entao nunca podem passar do dinheiro
    // vivo que esta la dentro — senao o caixa esperado fica negativo, coisa
    // que nao existe na vida real.
    const dinheiroNaGaveta = () =>
      sessao.fundoTroco +
      caixaMovimentos
        .filter(
          (m) =>
            m.caixaSessaoId === sessao.id &&
            (!m.formaPagamento || m.formaPagamento === "DINHEIRO"),
        )
        .reduce((a, m) => a + m.valor, 0);

    if (chance(0.25)) {
      const teto = Math.floor(dinheiroNaGaveta() * 0.3);
      if (teto > 3000) {
        caixaMovimentos.push({
          id: id("cm"),
          caixaSessaoId: sessao.id,
          data: diaAs(hoje, d, 12, 0).toISOString(),
          tipo: "DESPESA",
          valor: -Math.min(teto, ri(3, 18) * 1000),
          descricao: pick([
            "Combustível da entrega",
            "Almoço da equipe",
            "Material de limpeza",
            "Frete avulso",
          ]),
        });
      }
    }

    if (chance(0.4)) {
      const teto = Math.floor(dinheiroNaGaveta() * 0.6);
      if (teto > 10000) {
        caixaMovimentos.push({
          id: id("cm"),
          caixaSessaoId: sessao.id,
          data: diaAs(hoje, d, 17, 30).toISOString(),
          tipo: "SANGRIA",
          valor: -Math.min(teto, ri(20, 90) * 1000),
          descricao: "Sangria para o cofre",
        });
      }
    }

    // o dia de hoje fica com o caixa aberto, para a demo poder fechar
    if (d > 0) {
      const esperado =
        sessao.fundoTroco +
        caixaMovimentos
          .filter(
            (m) =>
              m.caixaSessaoId === sessao.id &&
              (!m.formaPagamento || m.formaPagamento === "DINHEIRO"),
          )
          .reduce((a, m) => a + m.valor, 0);
      sessao.fechadaEm = diaAs(hoje, d, 18, 30).toISOString();
      // de vez em quando a gaveta fecha com diferenca, que e o normal da vida real
      sessao.valorContado = esperado + (chance(0.25) ? ri(-800, 800) : 0);
      sessao.status = "FECHADA";
    }
    caixaSessoes.push(sessao);
  }

  movimentos.sort((a, b) => a.data.localeCompare(b.data));
  vendas.sort((a, b) => b.data.localeCompare(a.data));
  entradas.sort((a, b) => b.data.localeCompare(a.data));

  return {
    versao: 2,
    empresa,
    usuarios,
    usuarioAtualId: null,
    categorias,
    fornecedores,
    clientes,
    produtos,
    entradas,
    vendas,
    movimentos,
    caixaSessoes,
    caixaMovimentos,
    documentos,
    logs: [],
  };
}

/**
 * Estado minimo para o primeiro render, antes de ler o localStorage.
 *
 * Antes o provider chamava gerarEstado() em todo carregamento de pagina e
 * jogava o resultado fora logo depois, quando lia os dados salvos. Agora o
 * historico ficticio so e gerado quando nao ha nada salvo.
 */
export function estadoVazio(): Estado {
  return {
    versao: 2,
    empresa: { ...empresa },
    usuarios: usuarios.map((u) => ({ ...u })),
    usuarioAtualId: null,
    categorias: categorias.map((c) => ({ ...c })),
    fornecedores: [],
    clientes: [],
    produtos: [],
    entradas: [],
    vendas: [],
    movimentos: [],
    caixaSessoes: [],
    caixaMovimentos: [],
    documentos: [],
    logs: [],
  };
}

/**
 * Os documentos do catalogo ficticio da versao 1 tinham digito verificador
 * errado. A migracao troca pelos numeros validos — conferidos na Receita
 * para nao coincidir com nenhuma empresa real.
 */
export const DOCUMENTOS_V1: Record<string, string> = {
  "08.774.201/0001-32": "97.774.201/0001-88",
  "16.905.332/0001-77": "97.905.332/0001-57",
  "17.556.930/0001-08": "97.556.930/0001-68",
  "19.447.290/0001-13": "97.447.290/0001-58",
  "23.808.114/0001-59": "97.808.114/0001-02",
  "27.663.508/0001-24": "97.663.508/0001-01",
  "29.031.447/0001-75": "97.031.448/0001-04",
  "31.408.226/0001-90": "97.408.226/0001-68",
  "34.129.760/0001-88": "97.129.760/0001-35",
  "38.774.019/0001-52": "97.774.019/0001-27",
  "41.220.877/0001-06": "97.220.877/0001-20",
  "42.318.905/0001-64": "97.318.905/0001-46",
  "55.902.318/0001-41": "97.902.318/0001-08",
  "118.442.907-31": "118.442.907-35",
  "324.887.109-55": "324.887.109-11",
  "445.019.663-72": "445.019.663-51",
  "662.774.310-19": "662.774.310-80",
  "907.331.228-04": "907.331.228-09"
};
