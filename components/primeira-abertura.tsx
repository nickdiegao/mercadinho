"use client";

import { useState, type FormEvent } from "react";
import { configurarSistema } from "@/app/acoes-contas";
import { validarCNPJ } from "@/lib/documentos";
import type { Empresa } from "@/lib/tipos";
import { CamposEmpresa, empresaVazia } from "./form-empresa";
import { CodigoRecuperacao } from "./codigo-recuperacao";
import { Botao, Campo, Entrada } from "./ui";

/**
 * A primeira tela do sistema instalado: cria a empresa e a administracao.
 * Depois disso o servidor recusa esta configuracao para sempre.
 */
export function PrimeiraAbertura({ onPronto }: { onPronto: (email: string, senha: string) => void }) {
  const [empresa, setEmpresa] = useState<Empresa>(empresaVazia);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (gravando) return;
    const motivo = !validarCNPJ(empresa.cnpj)
      ? "CNPJ inválido: confira os números."
      : !empresa.nomeFantasia.trim() || !empresa.razaoSocial.trim()
        ? "Informe o nome e a razão social da empresa."
        : !nome.trim() || !email.trim()
          ? "Informe o seu nome e e-mail."
          : senha.length < 8
            ? "A senha precisa de pelo menos 8 caracteres."
            : senha !== confirma
              ? "As duas senhas não são iguais."
              : null;
    setErro(motivo);
    if (motivo) return;

    setGravando(true);
    const r = await configurarSistema({ empresa, nome, email, senha }).catch(() => null);
    setGravando(false);
    if (!r) setErro("Não foi possível falar com o servidor.");
    else if (!r.ok) setErro(r.erro);
    else setCodigo(r.valor);
  }

  if (codigo) {
    return (
      <div className="w-full max-w-md rounded-lg bg-superficie p-6 shadow-2xl">
        <CodigoRecuperacao
          codigo={codigo}
          textoBotao="Entrar no sistema"
          onContinuar={() => onPronto(email.trim(), senha)}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="flex w-full max-w-2xl flex-col gap-6 rounded-lg bg-superficie p-6 shadow-2xl"
    >
      <section className="flex flex-col gap-4">
        <h2 className="text-[15px] font-bold text-tinta">Sua empresa</h2>
        <CamposEmpresa empresa={empresa} onMudar={setEmpresa} />
      </section>

      <section className="flex flex-col gap-4 border-t border-borda pt-5">
        <div>
          <h2 className="text-[15px] font-bold text-tinta">Quem administra o sistema</h2>
          <p className="mt-0.5 text-[13px] text-suave">
            Este acesso vê tudo e cadastra os outros usuários.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Seu nome">
            <Entrada autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo rotulo="E-mail (é o que você usa para entrar)">
            <Entrada type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo rotulo="Senha (mínimo de 8 caracteres)">
            <Entrada type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
          <Campo rotulo="Repita a senha">
            <Entrada type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          </Campo>
        </div>
      </section>

      {erro && (
        <p role="alert" className="rounded-md bg-alerta-claro px-3 py-2 text-[13px] font-medium text-alerta">
          {erro}
        </p>
      )}

      <Botao variante="primario" type="submit" disabled={gravando} className="w-full py-2.5">
        {gravando ? "Criando…" : "Criar e continuar"}
      </Botao>
    </form>
  );
}
