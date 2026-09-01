"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Boxes, ShieldCheck, Wallet } from "lucide-react";
import { useEstado } from "@/lib/store";
import type { Perfil } from "@/lib/tipos";

const DESCRICAO: Record<Perfil, { titulo: string; texto: string; icone: React.ReactNode }> = {
  ADMIN: {
    titulo: "Dona do negócio",
    texto: "Vê tudo: custo, margem, lucro, relatórios e configurações.",
    icone: <ShieldCheck size={18} />,
  },
  CAIXA: {
    titulo: "Operador de caixa",
    texto: "Vende e opera o caixa. Não vê custo nem lucro em lugar nenhum.",
    icone: <Wallet size={18} />,
  },
  ESTOQUE: {
    titulo: "Estoquista",
    texto: "Lança entrada, confere estoque e vê custo. Não vende nem vê lucro.",
    icone: <Boxes size={18} />,
  },
};

export default function Login() {
  const { estado, carregado, entrar } = useEstado();
  const router = useRouter();

  useEffect(() => {
    if (carregado && estado.usuarioAtualId) router.replace("/painel");
  }, [carregado, estado.usuarioAtualId, router]);

  function acessar(id: string) {
    entrar(id);
    router.push("/painel");
  }

  return (
    <main className="min-h-dvh bg-marca-escura">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-16">
        <div className="mb-10">
          <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Mockup de demonstração
          </p>
          <h1 className="text-4xl font-extrabold leading-none tracking-tight text-white sm:text-5xl">
            Distribuidora
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
            Controle de estoque, vendas, caixa e lucro. Escolha um perfil para
            entrar — cada um enxerga uma parte diferente do sistema, e é aí que
            está a diferença.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {estado.usuarios.map((u) => {
            const d = DESCRICAO[u.perfil];
            return (
              <button
                key={u.id}
                onClick={() => acessar(u.id)}
                className="transicao group rounded-lg border border-white/15 bg-white/[0.04] p-5 text-left hover:border-white/40 hover:bg-white/[0.09]"
              >
                <div className="flex items-center gap-2 text-white/60">
                  {d.icone}
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em]">
                    {u.perfil}
                  </span>
                </div>
                <p className="mt-3 text-base font-bold text-white">{u.nome}</p>
                <p className="text-[13px] font-medium text-white/50">{d.titulo}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/60">
                  {d.texto}
                </p>
                <span className="transicao mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 group-hover:text-white">
                  Entrar <ArrowRight size={14} />
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-10 max-w-2xl text-[13px] leading-relaxed text-white/40">
          Todos os dados são fictícios e ficam guardados no navegador. Empresa,
          CNPJ, clientes e fornecedores foram inventados para a demonstração.
          Nada é enviado para servidor nenhum.
        </p>
      </div>
    </main>
  );
}
