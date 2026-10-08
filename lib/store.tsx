"use client";

/**
 * O estado do sistema para as telas, nos dois modos:
 *
 *   demo   (sem banco — e assim na Vercel) os dados moram no localStorage
 *   banco  (DATABASE_URL configurada) os dados moram no Postgres, e cada
 *          acao vai ao servidor, que confere sessao e perfil antes de gravar
 *
 * As telas nao sabem a diferenca: as acoes tem a mesma forma nos dois, e a
 * regra de negocio e a mesma (lib/operacoes.ts). So muda quem grava.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { DOCUMENTOS_V1, estadoVazio, geladoPadrao, gerarEstado } from "./seed";
import {
  aplicarEfeitos,
  ErroOperacao,
  executarOperacao,
  type DadosAjuste,
  type DadosDe,
  type DadosEntrada,
  type DadosVenda,
  type NomeOperacao,
  type ValorDe,
} from "./operacoes";
import { permissoes } from "./permissoes";
import { carregarEstado, executar } from "@/app/acoes";
import type {
  CaixaMovimento,
  Cliente,
  Entrada,
  Estado,
  Fornecedor,
  Produto,
  TipoMovimento,
  Venda,
} from "./tipos";

export type Modo = "demo" | "banco";

const CHAVE = "mercadinho.estado.v1";

let contador = 0;
const novoId = (p: string) => `${p}_${Date.now().toString(36)}${(contador++).toString(36)}`;

interface Ctx {
  modo: Modo;
  estado: Estado;
  carregado: boolean;
  /** Busca o estado de novo no servidor (modo banco); na demo, nao faz nada. */
  recarregar: () => Promise<void>;
  /** Demo: escolher o perfil. No modo banco, a entrada e pelo login. */
  entrar: (usuarioId: string) => void;
  sair: () => Promise<void>;
  /** Demo: volta os dados ficticios ao original. */
  resetar: () => void;
  registrarVenda: (dados: DadosVenda) => Promise<Venda>;
  registrarEntrada: (dados: DadosEntrada) => Promise<Entrada>;
  ajustarEstoque: (produtoId: string, novaQtd: number, tipo: TipoMovimento, motivo: string) => Promise<void>;
  /** A contagem inteira da carga inicial, numa gravacao so. */
  registrarContagem: (ajustes: DadosAjuste[]) => Promise<void>;
  salvarProduto: (p: Produto) => Promise<Produto>;
  /**
   * Cria produto novo. Com estoque inicial, o custo informado vira o custo
   * medio e o saldo entra como inventario de abertura — tudo numa gravacao so.
   * Sem estoque inicial o produto nasce sem custo, ate a primeira entrada.
   */
  cadastrarProduto: (
    p: Produto,
    estoqueInicial?: { qtdCompra: number; custoUnitCompra: number },
  ) => Promise<Produto>;
  /** Cria ou atualiza. Registro sem id ganha um novo. Devolve o que foi gravado. */
  salvarCliente: (c: Cliente) => Promise<Cliente>;
  salvarFornecedor: (f: Fornecedor) => Promise<Fornecedor>;
  /** Devolve os itens ao estoque, os cascos ao deposito e o dinheiro pelo caixa. */
  cancelarVenda: (vendaId: string, motivo: string) => Promise<void>;
  lancarCaixa: (
    tipo: Extract<CaixaMovimento["tipo"], "SANGRIA" | "SUPRIMENTO" | "DESPESA">,
    valor: number,
    descricao: string,
  ) => Promise<void>;
  fecharCaixa: (valorContado: number) => Promise<void>;
  abrirCaixa: (fundoTroco: number) => Promise<void>;
}

const EstadoCtx = createContext<Ctx | null>(null);

export function EstadoProvider({ modo, children }: { modo: Modo; children: ReactNode }) {
  const [estado, setEstadoBruto] = useState<Estado>(estadoVazio);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // as acoes leem o estado mais recente sem esperar a renderizacao
  const atual = useRef(estado);
  const fecharErro = useCallback(() => setErro(null), []);

  const setEstado = useCallback((novo: Estado) => {
    atual.current = novo;
    setEstadoBruto(novo);
  }, []);

  // ------------------------------------------------------------ carga
  const recarregar = useCallback(async () => {
    if (modo !== "banco") return;
    try {
      const r = await carregarEstado();
      setEstado(r.ok ? r.estado : { ...estadoVazio(), usuarioAtualId: null });
      if (!r.ok && r.erro !== "sem-sessao") setErro(r.erro);
    } catch {
      setErro("Não foi possível falar com o servidor. O banco está ligado (npm run banco:subir)?");
    }
    setCarregado(true);
  }, [modo, setEstado]);

  useEffect(() => {
    if (modo === "banco") {
      void recarregar();
      return;
    }
    // localStorage so existe no navegador — por isso a carga acontece aqui.
    // O historico ficticio so e gerado quando nao ha nada salvo.
    let inicial: Estado | null = null;
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      if (bruto) inicial = migrar(JSON.parse(bruto) as Estado);
    } catch {
      /* localStorage bloqueado ou dado corrompido: cai no seed */
    }
    setEstado(inicial ?? gerarEstado());
    setCarregado(true);
  }, [modo, recarregar, setEstado]);

  // demo: tudo o que muda vai para o localStorage
  useEffect(() => {
    if (modo !== "demo" || !carregado) return;
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      /* cota estourada: a demo continua funcionando em memoria */
    }
  }, [modo, estado, carregado]);

  // banco: ao voltar para a aba, busca de novo — o celular e o computador da
  // loja mexem no mesmo banco, e um nao pode ficar vendo o estado velho
  useEffect(() => {
    if (modo !== "banco") return;
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && atual.current.usuarioAtualId) void recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [modo, recarregar]);

  // ------------------------------------------------------------ acoes
  const rodar = useCallback(
    async <N extends NomeOperacao>(nome: N, dados: DadosDe<N>): Promise<ValorDe<N>> => {
      if (modo === "demo") {
        const e = atual.current;
        const perfil = e.usuarios.find((u) => u.id === e.usuarioAtualId)?.perfil;
        try {
          if (!perfil || !e.usuarioAtualId) throw new ErroOperacao("Escolha um perfil para entrar.");
          const ctx = { agora: new Date().toISOString(), usuarioId: e.usuarioAtualId, perfil, novoId };
          const r = executarOperacao(nome, e, ctx, dados);
          const novo = aplicarEfeitos(e, r.efeitos);
          setEstado({ ...novo, logs: novo.logs.slice(0, 300) });
          return r.valor;
        } catch (falha) {
          setErro(falha instanceof Error ? falha.message : "Não foi possível gravar.");
          throw falha;
        }
      }

      const r = await executar(nome, dados).catch(() => ({
        ok: false as const,
        erro: "Não foi possível falar com o servidor. O banco está ligado?",
        semSessao: false,
      }));
      if (!r.ok) {
        setErro(r.erro);
        if ("semSessao" in r && r.semSessao) setEstado({ ...atual.current, usuarioAtualId: null });
        throw new ErroOperacao(r.erro);
      }
      setEstado(aplicarEfeitos(atual.current, r.efeitos));
      return r.valor;
    },
    [modo, setEstado],
  );

  const entrar = useCallback(
    (usuarioId: string) => {
      if (modo === "demo") setEstado({ ...atual.current, usuarioAtualId: usuarioId });
    },
    [modo, setEstado],
  );

  const sair = useCallback(async () => {
    if (modo === "banco") {
      // carregado so aqui: a demonstracao nunca baixa o modulo de login
      const { signOut } = await import("next-auth/react");
      await signOut({ redirect: false });
      setEstado({ ...estadoVazio(), usuarioAtualId: null });
      return;
    }
    setEstado({ ...atual.current, usuarioAtualId: null });
  }, [modo, setEstado]);

  const resetar = useCallback(() => {
    if (modo !== "demo") return;
    setEstado({ ...gerarEstado(), usuarioAtualId: atual.current.usuarioAtualId });
  }, [modo, setEstado]);

  const valor = useMemo<Ctx>(
    () => ({
      modo,
      estado,
      carregado,
      recarregar,
      entrar,
      sair,
      resetar,
      registrarVenda: (dados) => rodar("registrarVenda", dados),
      registrarEntrada: (dados) => rodar("registrarEntrada", dados),
      ajustarEstoque: async (produtoId, novaQtd, tipo, motivo) => {
        await rodar("ajustarEstoque", { ajustes: [{ produtoId, novaQtd, tipo, motivo }] });
      },
      registrarContagem: async (ajustes) => {
        await rodar("ajustarEstoque", { ajustes });
      },
      salvarProduto: (produto) => rodar("salvarProduto", { produto }),
      cadastrarProduto: (produto, estoqueInicial) => rodar("cadastrarProduto", { produto, estoqueInicial }),
      salvarCliente: (cliente) => rodar("salvarCliente", { cliente }),
      salvarFornecedor: (fornecedor) => rodar("salvarFornecedor", { fornecedor }),
      cancelarVenda: async (vendaId, motivo) => {
        await rodar("cancelarVenda", { vendaId, motivo });
      },
      lancarCaixa: async (tipo, valor, descricao) => {
        await rodar("lancarCaixa", { tipo, valor, descricao });
      },
      fecharCaixa: async (valorContado) => {
        await rodar("fecharCaixa", { valorContado });
      },
      abrirCaixa: async (fundoTroco) => {
        await rodar("abrirCaixa", { fundoTroco });
      },
    }),
    [modo, estado, carregado, recarregar, entrar, sair, resetar, rodar],
  );

  return (
    <EstadoCtx.Provider value={valor}>
      {children}
      {erro && <AvisoDeErro mensagem={erro} onFechar={fecharErro} />}
    </EstadoCtx.Provider>
  );
}

/** O motivo de uma gravacao recusada, no pe da tela. Some sozinho. */
function AvisoDeErro({ mensagem, onFechar }: { mensagem: string; onFechar: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onFechar, 7000);
    return () => window.clearTimeout(t);
  }, [mensagem, onFechar]);
  return (
    <div
      role="alert"
      className="nao-imprime fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-lg border border-alerta/30 bg-alerta-claro px-4 py-3 text-[13.5px] font-medium text-alerta shadow-xl"
    >
      <span className="min-w-0 flex-1 leading-snug">{mensagem}</span>
      <button onClick={onFechar} aria-label="Fechar aviso" className="-m-1 shrink-0 rounded p-1 hover:bg-alerta/10">
        <X size={16} />
      </button>
    </div>
  );
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
      return g ? { ...p, vendeGelado: true, precoGelado: g } : { ...p, vendeGelado: false };
    }),
  };
}

// ---------------------------------------------------------------- seletores
export function usePerfil() {
  const { estado } = useEstado();
  const u = estado.usuarios.find((x) => x.id === estado.usuarioAtualId);
  return {
    usuario: u ?? null,
    perfil: u?.perfil ?? null,
    ...permissoes(u?.perfil),
  };
}
