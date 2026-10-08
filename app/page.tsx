"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Boxes, LogIn, ShieldCheck, Wallet } from "lucide-react";
import { useEstado } from "@/lib/store";
import { Botao, Campo, Entrada } from "@/components/ui";
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
  const { modo, estado, carregado, entrar } = useEstado();
  const router = useRouter();

  useEffect(() => {
    if (carregado && estado.usuarioAtualId) router.replace("/painel");
  }, [carregado, estado.usuarioAtualId, router]);

  if (modo === "banco") {
    return (
      <Moldura
        selo="Banco local"
        texto="Entre com o seu e-mail e senha. Cada pessoa enxerga uma parte diferente do sistema, conforme o perfil dela."
        rodape="Os dados ficam no Postgres deste computador. Depois de 5 senhas erradas seguidas, a conta trava por 15 minutos."
      >
        <LoginComSenha />
      </Moldura>
    );
  }

  function acessar(id: string) {
    entrar(id);
    router.push("/painel");
  }

  return (
    <Moldura
      selo="Mockup de demonstração"
      texto="Controle de estoque, vendas, caixa e lucro. Escolha um perfil para entrar — cada um enxerga uma parte diferente do sistema, e é aí que está a diferença."
      rodape="Todos os dados são fictícios e ficam guardados no navegador. Empresa, CNPJ, clientes e fornecedores foram inventados para a demonstração. Nada é enviado para servidor nenhum."
    >
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
              <p className="mt-3 text-[13px] leading-relaxed text-white/60">{d.texto}</p>
              <span className="transicao mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 group-hover:text-white">
                Entrar <ArrowRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </Moldura>
  );
}

function Moldura({
  selo,
  texto,
  rodape,
  children,
}: {
  selo: string;
  texto: string;
  rodape: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-marca-escura">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-6 py-16">
        <div className="mb-10">
          <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            {selo}
          </p>
          <h1 className="text-4xl font-extrabold leading-none tracking-tight text-white sm:text-5xl">
            Distribuidora
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">{texto}</p>
        </div>
        {children}
        <p className="mt-10 max-w-2xl text-[13px] leading-relaxed text-white/40">{rodape}</p>
      </div>
    </main>
  );
}

function LoginComSenha() {
  const { recarregar } = useEstado();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (entrando || !email.trim() || !senha) return;
    setErro(null);
    setEntrando(true);
    // carregado so aqui: a demonstracao nunca baixa o modulo de login
    const r = await import("next-auth/react")
      .then(({ signIn }) => signIn("credentials", { email: email.trim(), senha, redirect: false }))
      .catch(() => null);
    if (r?.ok && !r.error) {
      await recarregar();
      router.replace("/painel");
      return;
    }
    setEntrando(false);
    setSenha("");
    setErro(
      !r
        ? "Não foi possível falar com o servidor. O banco está ligado?"
        : r.error === "BLOQUEADO"
          ? "Conta bloqueada por 15 minutos depois de 5 senhas erradas. Espere ou peça para a administradora."
          : "E-mail ou senha incorretos.",
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-superficie p-6 shadow-2xl"
      noValidate
    >
      <Campo rotulo="E-mail">
        <Entrada
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@distribuidora.com.br"
        />
      </Campo>
      <Campo rotulo="Senha">
        <Entrada
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </Campo>
      {erro && (
        <p role="alert" className="-mt-1 rounded-md bg-alerta-claro px-3 py-2 text-[13px] font-medium text-alerta">
          {erro}
        </p>
      )}
      <Botao variante="primario" type="submit" disabled={entrando || !email.trim() || !senha} className="w-full py-2.5">
        <LogIn size={16} /> {entrando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
