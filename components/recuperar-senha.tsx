"use client";

import { useState, type FormEvent } from "react";
import { recuperarAcesso } from "@/app/acoes-contas";
import { CodigoRecuperacao } from "./codigo-recuperacao";
import { Botao, Campo, Entrada } from "./ui";

/** Esqueceu a senha: a administracao entra com o codigo guardado na primeira abertura. */
export function RecuperarSenha({ onVoltar }: { onVoltar: () => void }) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (gravando) return;
    const motivo =
      !email.trim() || !codigo.trim()
        ? "Informe o e-mail e o código de recuperação."
        : senha.length < 8
          ? "A senha nova precisa de pelo menos 8 caracteres."
          : senha !== confirma
            ? "As duas senhas não são iguais."
            : null;
    setErro(motivo);
    if (motivo) return;

    setGravando(true);
    const r = await recuperarAcesso({ email, codigo, novaSenha: senha }).catch(() => null);
    setGravando(false);
    if (!r) setErro("Não foi possível falar com o servidor.");
    else if (!r.ok) setErro(r.erro);
    else setNovoCodigo(r.valor);
  }

  if (novoCodigo) {
    return (
      <div className="w-full max-w-md rounded-lg bg-superficie p-6 shadow-2xl">
        <p className="mb-3 rounded-md bg-positivo-claro px-3 py-2 text-[13px] font-medium text-positivo">
          Senha trocada. O código antigo não vale mais.
        </p>
        <CodigoRecuperacao codigo={novoCodigo} textoBotao="Voltar para entrar" onContinuar={onVoltar} />
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-superficie p-6 shadow-2xl"
    >
      <div>
        <p className="text-[15px] font-bold text-tinta">Recuperar a senha</p>
        <p className="mt-1 text-[13px] leading-relaxed text-suave">
          Use o código guardado na primeira abertura. Quem não é da administração
          pede uma senha nova para ela.
        </p>
      </div>
      <Campo rotulo="E-mail">
        <Entrada type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Campo>
      <Campo rotulo="Código de recuperação">
        <Entrada
          className="mono"
          autoComplete="off"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
        />
      </Campo>
      <Campo rotulo="Senha nova (mínimo de 8 caracteres)">
        <Entrada type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </Campo>
      <Campo rotulo="Repita a senha nova">
        <Entrada type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
      </Campo>
      {erro && (
        <p role="alert" className="-mt-1 rounded-md bg-alerta-claro px-3 py-2 text-[13px] font-medium text-alerta">
          {erro}
        </p>
      )}
      <Botao variante="primario" type="submit" disabled={gravando} className="w-full py-2.5">
        {gravando ? "Gravando…" : "Trocar a senha"}
      </Botao>
      <button type="button" onClick={onVoltar} className="text-[13px] font-semibold text-marca hover:underline">
        Voltar para entrar
      </button>
    </form>
  );
}
