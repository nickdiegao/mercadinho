"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Settings,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";

const MENU = [
  { href: "/painel", rotulo: "Painel", icone: LayoutDashboard, ver: () => true },
  { href: "/vendas/nova", rotulo: "Nova venda", icone: ArrowUpFromLine, ver: (p: Papeis) => p.podeVender },
  { href: "/vendas", rotulo: "Vendas", icone: FileText, ver: () => true },
  { href: "/entradas", rotulo: "Entradas", icone: ArrowDownToLine, ver: (p: Papeis) => p.podeEstoque },
  { href: "/estoque", rotulo: "Estoque", icone: Boxes, ver: () => true },
  { href: "/produtos", rotulo: "Produtos", icone: Package, ver: () => true },
  { href: "/clientes", rotulo: "Clientes", icone: Users, ver: () => true },
  { href: "/fornecedores", rotulo: "Fornecedores", icone: Truck, ver: (p: Papeis) => p.podeEstoque },
  { href: "/caixa", rotulo: "Caixa", icone: Wallet, ver: (p: Papeis) => p.podeVender },
  { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3, ver: (p: Papeis) => p.podeVerCusto },
  { href: "/carga-inicial", rotulo: "Carga inicial", icone: ClipboardList, ver: (p: Papeis) => p.podeEstoque },
  { href: "/usuarios", rotulo: "Usuários", icone: UserCog, ver: (p: Papeis) => p.ehAdmin, soBanco: true },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings, ver: (p: Papeis) => p.ehAdmin, soBanco: true },
];

type Papeis = ReturnType<typeof usePerfil>;

export default function LayoutSistema({ children }: { children: React.ReactNode }) {
  const { modo, estado, carregado, sair, resetar } = useEstado();
  const papeis = usePerfil();
  const router = useRouter();
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (carregado && !estado.usuarioAtualId) router.replace("/");
  }, [carregado, estado.usuarioAtualId, router]);

  useEffect(() => {
    setAberto(false);
  }, [caminho]);

  // esqueleto com o menu ja no lugar: a tela nao pisca em branco enquanto
  // os dados saem do navegador
  if (!carregado || !estado.usuarioAtualId) return <Esqueleto />;

  const itens = MENU.filter((m) => m.ver(papeis) && (!m.soBanco || modo === "banco"));
  const nomeEmpresa = estado.empresa.nomeFantasia;

  // o item ativo e o de href mais longo que casa com o caminho — senao
  // /vendas/nova acenderia "Nova venda" e "Vendas" ao mesmo tempo
  const ativoHref = itens
    .filter((m) => caminho === m.href || caminho.startsWith(`${m.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="min-h-dvh lg:flex">
      {/* topo mobile */}
      <header className="nao-imprime sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-marca-escura px-4 py-3 lg:hidden">
        <div>
          <p className="text-sm font-bold text-white">{nomeEmpresa}</p>
          <p className="text-[11px] text-white/50">{papeis.usuario?.nome}</p>
        </div>
        <button
          onClick={() => setAberto((a) => !a)}
          className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        >
          {aberto ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* lateral */}
      <aside
        className={`nao-imprime z-20 w-full shrink-0 flex-col bg-marca-escura lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:self-start ${
          aberto ? "flex" : "hidden"
        }`}
      >
        <div className="hidden border-b border-white/10 px-5 py-5 lg:block">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {modo === "banco" ? "Sistema local" : "Mockup"}
          </p>
          <p className="mt-1.5 text-[15px] font-bold leading-tight text-white">
            {nomeEmpresa}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {itens.map((m) => {
              const ativo = m.href === ativoHref;
              const Icone = m.icone;
              return (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    className={`transicao flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium ${
                      ativo
                        ? "bg-white/[0.13] text-white"
                        : "text-white/60 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <Icone size={16} className="shrink-0" />
                    {m.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="px-3 py-2">
            <p className="truncate text-[13px] font-semibold text-white">
              {papeis.usuario?.nome}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/40">
              {papeis.perfil}
            </p>
          </div>
          {modo === "banco" && (
            <Link
              href="/conta"
              className="transicao flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-white/50 hover:bg-white/[0.07] hover:text-white"
            >
              <UserRound size={15} /> Minha conta
            </Link>
          )}
          {/* no banco local nao existe "voltar ao original": la os dados sao reais */}
          {modo === "demo" && (
            <button
              onClick={resetar}
              className="transicao flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-white/50 hover:bg-white/[0.07] hover:text-white"
              title="Volta os dados fictícios ao estado original"
            >
              <RotateCcw size={15} /> Recarregar demo
            </button>
          )}
          <button
            onClick={async () => {
              await sair();
              router.push("/");
            }}
            className="transicao flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-white/50 hover:bg-white/[0.07] hover:text-white"
          >
            <LogOut size={15} /> {modo === "banco" ? "Sair" : "Trocar de perfil"}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1180px] px-4 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}

function Esqueleto() {
  const bloco = "rounded-lg bg-superficie2 motion-safe:animate-pulse";
  return (
    <div className="min-h-dvh lg:flex" aria-busy="true" aria-label="Carregando">
      <div className="flex items-center border-b border-white/10 bg-marca-escura px-4 py-3 lg:hidden">
        <p className="text-sm font-bold text-white">Distribuidora</p>
      </div>
      <aside className="hidden h-dvh w-60 shrink-0 flex-col bg-marca-escura lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Mockup
          </p>
          <p className="mt-1.5 text-[15px] font-bold leading-tight text-white">
            Distribuidora
          </p>
        </div>
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-7 rounded-md bg-white/[0.06]" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1180px] px-4 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-9">
          <div className={`mb-2 h-7 w-48 ${bloco}`} />
          <div className={`mb-6 h-4 w-72 max-w-full ${bloco}`} />
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-[92px] sm:h-[118px] ${bloco}`} />
            ))}
          </div>
          <div className={`mt-4 h-[260px] ${bloco}`} />
        </div>
      </main>
    </div>
  );
}
