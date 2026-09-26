"use client";

/**
 * Estado do mockup, guardado no localStorage.
 *
 * Na fase 2 isto vira Postgres + Server Actions. A forma das acoes aqui foi
 * escolhida pensando nisso: cada acao e uma transacao unica que grava tudo o
 * que a venda ou a entrada produz — nunca meia gravacao.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DOCUMENTOS_V1, estadoVazio, geladoPadrao, gerarEstado } from "./seed";
import { custoItem, novoCustoMedio, paraBase, custoUnitBase } from "./regras";
import type {
  CaixaMovimento,
  Cliente,
  Documento,
  Entrada,
  EntradaItem,
  Estado,
  FormaPagamento,
  Fornecedor,
  MovimentoEstoque,
  Produto,
  TipoMovimento,
  TipoPreco,
  Venda,
  VendaItem,
} from "./tipos";

const CHAVE = "mercadinho.estado.v1";

let contador = 0;
const novoId = (p: string) =>
  `${p}_${Date.now().toString(36)}${(contador++).toString(36)}`;

interface ItemNovaVenda {
  produtoId: string;
  qtd: number;
  precoUnit: number;
  tipoPrecoAplicado: TipoPreco;
  gelado?: boolean;
  adicionalGelado?: number;
}

interface ItemNovaEntrada {
  produtoId: string;
  qtdCompra: number;
  custoUnitCompra: number;
}

interface Ctx {
  estado: Estado;
  carregado: boolean;
  entrar: (usuarioId: string) => void;
  sair: () => void;
  resetar: () => void;
  registrarVenda: (dados: {
    clienteId?: string;
    itens: ItemNovaVenda[];
    desconto: number;
    formaPagamento: FormaPagamento;
    emitirRecibo: boolean;
  }) => Venda;
  registrarEntrada: (dados: {
    fornecedorId: string;
    documentoFornecedor: string;
    itens: ItemNovaEntrada[];
    observacao?: string;
  }) => Entrada;
  ajustarEstoque: (
    produtoId: string,
    novaQtd: number,
    tipo: TipoMovimento,
    motivo: string,
  ) => void;
  salvarProduto: (p: Produto) => void;
  /**
   * Cria produto novo. Com estoque inicial, o custo informado vira o custo
   * medio e o saldo entra como inventario de abertura — tudo numa gravacao so.
   * Sem estoque inicial o produto nasce sem custo, ate a primeira entrada.
   */
  cadastrarProduto: (
    p: Produto,
    estoqueInicial?: { qtdCompra: number; custoUnitCompra: number },
  ) => Produto;
  /** Cria ou atualiza. Registro sem id ganha um novo. Devolve o que foi gravado. */
  salvarCliente: (c: Cliente) => Cliente;
  salvarFornecedor: (f: Fornecedor) => Fornecedor;
  /** Devolve os itens ao estoque, os cascos ao deposito e o dinheiro pelo caixa. */
  cancelarVenda: (vendaId: string, motivo: string) => void;
  lancarCaixa: (
    tipo: CaixaMovimento["tipo"],
    valor: number,
    descricao: string,
  ) => void;
  fecharCaixa: (valorContado: number) => void;
  abrirCaixa: (fundoTroco: number) => void;
}

const EstadoCtx = createContext<Ctx | null>(null);

export function EstadoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(estadoVazio);
  const [carregado, setCarregado] = useState(false);

  // localStorage so existe no navegador — por isso a carga acontece aqui.
  // O historico ficticio so e gerado quando nao ha nada salvo; antes ele era
  // gerado em todo carregamento e jogado fora logo em seguida.
  useEffect(() => {
    let inicial: Estado | null = null;
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (bruto) inicial = migrar(JSON.parse(bruto) as Estado);
    } catch {
      /* localStorage bloqueado ou dado corrompido: cai no seed */
    }
    setEstado(inicial ?? gerarEstado());
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      /* cota estourada: o mockup continua funcionando em memoria */
    }
  }, [estado, carregado]);

  const registrar = useCallback(
    (
      st: Estado,
      acao: string,
      entidade: string,
      entidadeId: string,
      detalhe: string,
    ) => {
      st.logs = [
        {
          id: novoId("lg"),
          ocorridoEm: new Date().toISOString(),
          usuarioId: st.usuarioAtualId ?? "u_ana",
          acao,
          entidade,
          entidadeId,
          detalhe,
        },
        ...st.logs,
      ].slice(0, 300);
    },
    [],
  );

  const entrar = useCallback((usuarioId: string) => {
    setEstado((s) => ({ ...s, usuarioAtualId: usuarioId }));
  }, []);

  const sair = useCallback(() => {
    setEstado((s) => ({ ...s, usuarioAtualId: null }));
  }, []);

  const resetar = useCallback(() => {
    const novo = gerarEstado();
    setEstado(novo);
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      /* ignora */
    }
  }, []);

  const registrarVenda = useCallback<Ctx["registrarVenda"]>(
    (dados) => {
      let criada!: Venda;
      setEstado((s) => {
        const st = estruturar(s);
        const agora = new Date().toISOString();
        const usuarioId = st.usuarioAtualId ?? "u_marcos";
        const sessao = st.caixaSessoes.find((c) => c.status === "ABERTA");

        const itens: VendaItem[] = dados.itens.map((i) => {
          const p = st.produtos.find((x) => x.id === i.produtoId)!;
          return {
            id: novoId("vi"),
            produtoId: p.id,
            descricao: p.nome,
            qtd: i.qtd,
            precoUnit: i.precoUnit,
            custoUnit: p.custoMedio, // regra 3: congela o custo aqui
            tipoPrecoAplicado: i.tipoPrecoAplicado,
            ...(i.gelado
              ? { gelado: true, adicionalGelado: i.adicionalGelado ?? 0 }
              : {}),
            total: Math.round(i.qtd * i.precoUnit),
          };
        });

        const subtotal = itens.reduce((a, i) => a + i.total, 0);
        const custoTotal = itens.reduce(
          (a, i) => a + custoItem(i.qtd, i.custoUnit),
          0,
        );
        const numero =
          st.vendas.reduce((m, v) => Math.max(m, v.numero), 0) + 1;

        const venda: Venda = {
          id: novoId("vd"),
          numero,
          clienteId: dados.clienteId,
          data: agora,
          usuarioId,
          caixaSessaoId: sessao?.id,
          tipoPreco: itens[0]?.tipoPrecoAplicado ?? "VAREJO",
          itens,
          subtotal,
          desconto: dados.desconto,
          total: subtotal - dados.desconto,
          custoTotal,
          formaPagamento: dados.formaPagamento,
          status: "FECHADA",
        };

        // baixa de estoque + casco junto (regra 5)
        for (const it of itens) {
          const p = st.produtos.find((x) => x.id === it.produtoId)!;
          p.saldoAtual = arredonda(p.saldoAtual - it.qtd);
          st.movimentos.push({
            id: novoId("mv"),
            produtoId: p.id,
            data: agora,
            tipo: "SAIDA",
            qtd: -it.qtd,
            saldoApos: p.saldoAtual,
            custoUnitNoMomento: p.custoMedio,
            origemTipo: "VENDA",
            origemId: venda.id,
            usuarioId,
          });

          if (p.vasilhameId) {
            const v = st.produtos.find((x) => x.id === p.vasilhameId)!;
            v.saldoAtual = arredonda(v.saldoAtual + it.qtd);
            st.movimentos.push({
              id: novoId("mv"),
              produtoId: v.id,
              data: agora,
              tipo: "ENTRADA",
              qtd: it.qtd,
              saldoApos: v.saldoAtual,
              custoUnitNoMomento: v.custoMedio,
              origemTipo: "VENDA",
              origemId: venda.id,
              usuarioId,
              motivo: "Casco com o cliente",
            });
          }
        }

        // regra 4: fiado nao entra no caixa
        if (sessao && dados.formaPagamento !== "FIADO") {
          st.caixaMovimentos.push({
            id: novoId("cm"),
            caixaSessaoId: sessao.id,
            data: agora,
            tipo: "VENDA",
            formaPagamento: dados.formaPagamento,
            valor: venda.total,
            vendaId: venda.id,
            descricao: `Venda ${String(numero).padStart(5, "0")}`,
          });
        }

        if (dados.emitirRecibo) {
          const cliente =
            st.clientes.find((c) => c.id === dados.clienteId) ?? null;
          const doc: Documento = {
            id: novoId("dc"),
            vendaId: venda.id,
            tipo: "RECIBO",
            numero:
              st.documentos.reduce((m, d) => Math.max(m, d.numero), 0) + 1,
            emitidoEm: agora,
            emitenteSnapshot: { ...st.empresa },
            destinatarioSnapshot: cliente ? { ...cliente } : null,
          };
          st.documentos.push(doc);
        }

        st.vendas.unshift(venda);
        registrar(st, "REGISTRAR_VENDA", "venda", venda.id, `Venda ${numero}`);
        criada = venda;
        return st;
      });
      return criada;
    },
    [registrar],
  );

  const registrarEntrada = useCallback<Ctx["registrarEntrada"]>(
    (dados) => {
      let criada!: Entrada;
      setEstado((s) => {
        const st = estruturar(s);
        const agora = new Date().toISOString();
        const usuarioId = st.usuarioAtualId ?? "u_jorge";
        const entradaId = novoId("en");
        const itens: EntradaItem[] = [];

        for (const i of dados.itens) {
          const p = st.produtos.find((x) => x.id === i.produtoId)!;
          const qtdBase = paraBase(i.qtdCompra, p.fatorConversao);
          const cBase = custoUnitBase(i.custoUnitCompra, p.fatorConversao);

          // regra 2: o custo medio so muda aqui
          p.custoMedio = novoCustoMedio(p.saldoAtual, p.custoMedio, qtdBase, cBase);
          p.custoUltimaCompra = cBase;
          p.saldoAtual = arredonda(p.saldoAtual + qtdBase);

          itens.push({
            id: novoId("ei"),
            produtoId: p.id,
            qtdCompra: i.qtdCompra,
            unidadeCompra: p.unidadeCompra,
            fatorConversao: p.fatorConversao,
            qtdBase,
            custoUnitCompra: i.custoUnitCompra,
            custoUnitBase: cBase,
            valorTotal: Math.round(i.qtdCompra * i.custoUnitCompra),
          });

          st.movimentos.push({
            id: novoId("mv"),
            produtoId: p.id,
            data: agora,
            tipo: "ENTRADA",
            qtd: qtdBase,
            saldoApos: p.saldoAtual,
            custoUnitNoMomento: p.custoMedio,
            origemTipo: "ENTRADA",
            origemId: entradaId,
            usuarioId,
          });
        }

        const entrada: Entrada = {
          id: entradaId,
          numero: st.entradas.reduce((m, e) => Math.max(m, e.numero), 0) + 1,
          fornecedorId: dados.fornecedorId,
          data: agora,
          documentoFornecedor: dados.documentoFornecedor,
          itens,
          valorTotal: itens.reduce((a, i) => a + i.valorTotal, 0),
          usuarioId,
          observacao: dados.observacao,
        };
        st.entradas.unshift(entrada);
        registrar(st, "LANCAR_ENTRADA", "entrada", entrada.id, dados.documentoFornecedor);
        criada = entrada;
        return st;
      });
      return criada;
    },
    [registrar],
  );

  const ajustarEstoque = useCallback<Ctx["ajustarEstoque"]>(
    (produtoId, novaQtd, tipo, motivo) => {
      setEstado((s) => {
        const st = estruturar(s);
        const p = st.produtos.find((x) => x.id === produtoId)!;
        const delta = arredonda(novaQtd - p.saldoAtual);
        if (delta === 0) return s;
        p.saldoAtual = novaQtd;
        st.movimentos.push({
          id: novoId("mv"),
          produtoId,
          data: new Date().toISOString(),
          tipo,
          qtd: delta,
          saldoApos: novaQtd,
          custoUnitNoMomento: p.custoMedio,
          origemTipo: tipo === "INVENTARIO_INICIAL" ? "CARGA_INICIAL" : "AJUSTE",
          usuarioId: st.usuarioAtualId ?? "u_jorge",
          motivo,
        });
        registrar(st, "AJUSTE_ESTOQUE", "produto", produtoId, `${p.nome}: ${motivo}`);
        return st;
      });
    },
    [registrar],
  );

  const salvarProduto = useCallback<Ctx["salvarProduto"]>(
    (p) => {
      setEstado((s) => {
        const st = estruturar(s);
        const i = st.produtos.findIndex((x) => x.id === p.id);
        if (i >= 0) st.produtos[i] = p;
        else st.produtos.push(p);
        registrar(st, i >= 0 ? "ALTERAR_PRODUTO" : "CRIAR_PRODUTO", "produto", p.id, p.nome);
        return st;
      });
    },
    [registrar],
  );

  const salvarCliente = useCallback<Ctx["salvarCliente"]>(
    (c) => {
      // o id nasce fora do setEstado para quem chamou ja poder usar
      const gravado: Cliente = c.id ? c : { ...c, id: novoId("cl") };
      setEstado((s) => {
        const st = estruturar(s);
        const i = st.clientes.findIndex((x) => x.id === gravado.id);
        if (i >= 0) st.clientes[i] = gravado;
        else st.clientes.push(gravado);
        registrar(
          st,
          i >= 0 ? "ALTERAR_CLIENTE" : "CRIAR_CLIENTE",
          "cliente",
          gravado.id,
          gravado.nomeRazao,
        );
        return st;
      });
      return gravado;
    },
    [registrar],
  );

  const salvarFornecedor = useCallback<Ctx["salvarFornecedor"]>(
    (f) => {
      const gravado: Fornecedor = f.id ? f : { ...f, id: novoId("f") };
      setEstado((s) => {
        const st = estruturar(s);
        const i = st.fornecedores.findIndex((x) => x.id === gravado.id);
        if (i >= 0) st.fornecedores[i] = gravado;
        else st.fornecedores.push(gravado);
        registrar(
          st,
          i >= 0 ? "ALTERAR_FORNECEDOR" : "CRIAR_FORNECEDOR",
          "fornecedor",
          gravado.id,
          gravado.razaoSocial,
        );
        return st;
      });
      return gravado;
    },
    [registrar],
  );

  const cadastrarProduto = useCallback<Ctx["cadastrarProduto"]>(
    (dados, estoqueInicial) => {
      const id = novoId("p");
      const temEstoque =
        !!estoqueInicial &&
        estoqueInicial.qtdCompra > 0 &&
        estoqueInicial.custoUnitCompra > 0;
      const qtdBase = temEstoque
        ? paraBase(estoqueInicial!.qtdCompra, dados.fatorConversao)
        : 0;
      const cBase = temEstoque
        ? custoUnitBase(estoqueInicial!.custoUnitCompra, dados.fatorConversao)
        : 0;
      const base: Produto = {
        ...dados,
        id,
        custoMedio: cBase,
        custoUltimaCompra: cBase,
        saldoAtual: qtdBase,
      };

      setEstado((s) => {
        const st = estruturar(s);
        const agora = new Date().toISOString();
        const usuarioId = st.usuarioAtualId ?? "u_ana";
        // so os codigos SKU0001..: o casco "V-600" nao pode virar o SKU0601
        const proximo =
          st.produtos.reduce((m, p) => {
            const achou = /^SKU(\d+)$/.exec(p.sku);
            return achou ? Math.max(m, Number(achou[1])) : m;
          }, 0) + 1;
        const p: Produto = {
          ...base,
          sku: base.sku || `SKU${String(proximo).padStart(4, "0")}`,
        };

        // regra 2: o custo so nasce de uma entrada — aqui, o estoque de abertura
        if (temEstoque) {
          st.movimentos.push({
            id: novoId("mv"),
            produtoId: id,
            data: agora,
            tipo: "INVENTARIO_INICIAL",
            qtd: qtdBase,
            saldoApos: qtdBase,
            custoUnitNoMomento: cBase,
            origemTipo: "CARGA_INICIAL",
            usuarioId,
            motivo: "Estoque informado no cadastro",
          });
        }

        st.produtos.push(p);
        registrar(st, "CRIAR_PRODUTO", "produto", id, p.nome);
        return st;
      });
      return base;
    },
    [registrar],
  );

  const cancelarVenda = useCallback<Ctx["cancelarVenda"]>(
    (vendaId, motivo) => {
      setEstado((s) => {
        const i = s.vendas.findIndex((v) => v.id === vendaId);
        if (i < 0 || s.vendas[i].status === "CANCELADA") return s;

        const st = estruturar(s);
        const v = st.vendas[i];
        const agora = new Date().toISOString();
        const usuarioId = st.usuarioAtualId ?? "u_ana";
        const rotulo = `venda ${String(v.numero).padStart(5, "0")}`;

        st.vendas[i] = {
          ...v,
          status: "CANCELADA",
          canceladaEm: agora,
          canceladaPor: usuarioId,
          motivoCancelamento: motivo,
        };

        // nada e apagado: cada item volta por um movimento novo de devolucao,
        // e o custo medio nao muda (so a entrada mexe no custo)
        for (const it of v.itens) {
          const p = st.produtos.find((x) => x.id === it.produtoId);
          if (!p) continue;
          p.saldoAtual = arredonda(p.saldoAtual + it.qtd);
          st.movimentos.push({
            id: novoId("mv"),
            produtoId: p.id,
            data: agora,
            tipo: "DEVOLUCAO",
            qtd: it.qtd,
            saldoApos: p.saldoAtual,
            custoUnitNoMomento: p.custoMedio,
            origemTipo: "VENDA",
            origemId: v.id,
            usuarioId,
            motivo: `Cancelamento da ${rotulo}`,
          });

          if (p.vasilhameId) {
            const casco = st.produtos.find((x) => x.id === p.vasilhameId);
            if (casco) {
              casco.saldoAtual = arredonda(casco.saldoAtual - it.qtd);
              st.movimentos.push({
                id: novoId("mv"),
                produtoId: casco.id,
                data: agora,
                tipo: "DEVOLUCAO",
                qtd: -it.qtd,
                saldoApos: casco.saldoAtual,
                custoUnitNoMomento: casco.custoMedio,
                origemTipo: "VENDA",
                origemId: v.id,
                usuarioId,
                motivo: `Casco volta com o cancelamento da ${rotulo}`,
              });
            }
          }
        }

        // o dinheiro volta pelo caixa aberto; fiado nunca entrou no caixa
        const sessao = st.caixaSessoes.find((c) => c.status === "ABERTA");
        if (sessao && v.formaPagamento !== "FIADO") {
          st.caixaMovimentos.push({
            id: novoId("cm"),
            caixaSessaoId: sessao.id,
            data: agora,
            tipo: "ESTORNO",
            formaPagamento: v.formaPagamento,
            valor: -v.total,
            vendaId: v.id,
            descricao: `Estorno da ${rotulo}`,
          });
        }

        registrar(st, "CANCELAR_VENDA", "venda", v.id, `${rotulo}: ${motivo}`);
        return st;
      });
    },
    [registrar],
  );

  const lancarCaixa = useCallback<Ctx["lancarCaixa"]>(
    (tipo, valor, descricao) => {
      setEstado((s) => {
        const st = estruturar(s);
        const sessao = st.caixaSessoes.find((c) => c.status === "ABERTA");
        if (!sessao) return s;
        st.caixaMovimentos.push({
          id: novoId("cm"),
          caixaSessaoId: sessao.id,
          data: new Date().toISOString(),
          tipo,
          valor,
          descricao,
        });
        registrar(st, tipo, "caixa", sessao.id, descricao);
        return st;
      });
    },
    [registrar],
  );

  const abrirCaixa = useCallback<Ctx["abrirCaixa"]>(
    (fundoTroco) => {
      setEstado((s) => {
        const st = estruturar(s);
        if (st.caixaSessoes.some((c) => c.status === "ABERTA")) return s;
        const sessao = {
          id: novoId("cs"),
          usuarioId: st.usuarioAtualId ?? "u_marcos",
          abertaEm: new Date().toISOString(),
          fundoTroco,
          status: "ABERTA" as const,
        };
        st.caixaSessoes.push(sessao);
        registrar(st, "ABRIR_CAIXA", "caixa", sessao.id, "Abertura de caixa");
        return st;
      });
    },
    [registrar],
  );

  const fecharCaixa = useCallback<Ctx["fecharCaixa"]>(
    (valorContado) => {
      setEstado((s) => {
        const st = estruturar(s);
        const sessao = st.caixaSessoes.find((c) => c.status === "ABERTA");
        if (!sessao) return s;
        sessao.fechadaEm = new Date().toISOString();
        sessao.valorContado = valorContado;
        sessao.status = "FECHADA";
        registrar(st, "FECHAR_CAIXA", "caixa", sessao.id, "Fechamento de caixa");
        return st;
      });
    },
    [registrar],
  );

  const valor = useMemo<Ctx>(
    () => ({
      estado,
      carregado,
      entrar,
      sair,
      resetar,
      registrarVenda,
      registrarEntrada,
      ajustarEstoque,
      salvarProduto,
      cadastrarProduto,
      salvarCliente,
      salvarFornecedor,
      cancelarVenda,
      lancarCaixa,
      fecharCaixa,
      abrirCaixa,
    }),
    [
      estado,
      carregado,
      entrar,
      sair,
      resetar,
      registrarVenda,
      registrarEntrada,
      ajustarEstoque,
      salvarProduto,
      cadastrarProduto,
      salvarCliente,
      salvarFornecedor,
      cancelarVenda,
      lancarCaixa,
      fecharCaixa,
      abrirCaixa,
    ],
  );

  return <EstadoCtx.Provider value={valor}>{children}</EstadoCtx.Provider>;
}

export function useEstado() {
  const ctx = useContext(EstadoCtx);
  if (!ctx) throw new Error("useEstado precisa estar dentro de EstadoProvider");
  return ctx;
}

/**
 * Dados salvos antes do preco gelado (versao 1) continuam valendo: os produtos
 * ganham o gelado padrao calculado sobre o preco de varejo de hoje, para nao
 * perder nada do que ja foi lancado na demonstracao.
 */
function migrar(salvo: Estado | null): Estado | null {
  if (!salvo || typeof salvo !== "object") return null;
  if (salvo.versao === 2) return salvo;
  if (salvo.versao !== 1) return null;
  // documentos da versao 1 tinham digito verificador errado; num sistema real
  // documento emitido nunca muda, mas aqui sao todos ficticios da demonstracao
  const doc = (d: string) => DOCUMENTOS_V1[d] ?? d;
  return {
    ...salvo,
    versao: 2,
    empresa: { ...salvo.empresa, cnpj: doc(salvo.empresa.cnpj) },
    clientes: salvo.clientes.map((c) => ({ ...c, cpfCnpj: doc(c.cpfCnpj) })),
    fornecedores: salvo.fornecedores.map((f) => ({ ...f, cnpj: doc(f.cnpj) })),
    documentos: salvo.documentos.map((d) => ({
      ...d,
      emitenteSnapshot: {
        ...d.emitenteSnapshot,
        cnpj: doc(d.emitenteSnapshot.cnpj),
      },
      destinatarioSnapshot: d.destinatarioSnapshot
        ? { ...d.destinatarioSnapshot, cpfCnpj: doc(d.destinatarioSnapshot.cpfCnpj) }
        : null,
    })),
    produtos: salvo.produtos.map((p) => {
      if (p.vendeGelado !== undefined || p.tipo !== "NORMAL") return p;
      const g = geladoPadrao(p.nome, p.categoriaId, p.precoVarejo);
      return g
        ? { ...p, vendeGelado: true, precoGelado: g }
        : { ...p, vendeGelado: false };
    }),
  };
}

/** Copia rasa das listas para o setState nao mutar o estado anterior. */
function estruturar(s: Estado): Estado {
  return {
    ...s,
    produtos: s.produtos.map((p) => ({ ...p })),
    vendas: [...s.vendas],
    entradas: [...s.entradas],
    movimentos: [...s.movimentos],
    clientes: [...s.clientes],
    fornecedores: [...s.fornecedores],
    caixaSessoes: s.caixaSessoes.map((c) => ({ ...c })),
    caixaMovimentos: [...s.caixaMovimentos],
    documentos: [...s.documentos],
    logs: [...s.logs],
  };
}

const arredonda = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------- seletores
export function usePerfil() {
  const { estado } = useEstado();
  const u = estado.usuarios.find((x) => x.id === estado.usuarioAtualId);
  return {
    usuario: u ?? null,
    perfil: u?.perfil ?? null,
    /** O operador de caixa nao ve custo nem lucro. */
    podeVerCusto: u?.perfil === "ADMIN" || u?.perfil === "ESTOQUE",
    podeVerLucro: u?.perfil === "ADMIN",
    podeVender: u?.perfil === "ADMIN" || u?.perfil === "CAIXA",
    podeEstoque: u?.perfil === "ADMIN" || u?.perfil === "ESTOQUE",
    ehAdmin: u?.perfil === "ADMIN",
    /** O caixa cadastra cliente no meio da venda; o estoque, nao. */
    podeCadastrarCliente: u?.perfil === "ADMIN" || u?.perfil === "CAIXA",
    /** O estoque cadastra produto novo quando chega carga, mas sem preco. */
    podeCadastrarProduto: u?.perfil === "ADMIN" || u?.perfil === "ESTOQUE",
    podeCadastrarFornecedor: u?.perfil === "ADMIN" || u?.perfil === "ESTOQUE",
    /** Preco de venda, tabela de atacado e limite de credito: so a dona. */
    podeDefinirPreco: u?.perfil === "ADMIN",
    podeCancelarVenda: u?.perfil === "ADMIN",
  };
}
