"use client";

import { useState, type FormEvent } from "react";
import { gerarCodigoRecuperacao, trocarSenha } from "@/app/acoes-contas";
import { CodigoRecuperacao } from "@/components/codigo-recuperacao";
import { NOME_PERFIL } from "@/components/form-usuario";
import { Aviso, Botao, Cabecalho, Campo, Cartao, Entrada, TituloCartao } from "@/components/ui";
import { useEstado, usePerfil } from "@/lib/store";

export default function MinhaConta() {
  const { modo } = useEstado();
  const { ehAdmin, usuario } = usePerfil();

  if (modo !== "banco" || !usuario) {
    return (
      <Aviso tom="alerta" titulo="Indisponível">
        A demonstração não tem senha.
      </Aviso>
    );
  }

  return (
    <>
      <Cabecalho titulo="Minha conta" descricao={`${usuario.nome} · ${usuario.email} · ${NOME_PERFIL[usuario.perfil]}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TrocarSenha />
        {ehAdmin && <NovoCodigo />}
      </div>
    </>
  );
}

function TrocarSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [gravando, setGravando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (gravando) return;
    if (nova !== confirma) {
      setAviso({ tom: "erro", texto: "As duas senhas novas não são iguais." });
      return;
    }
    setGravando(true);
    setAviso(null);
    const r = await trocarSenha({ atual, nova }).catch(() => null);
    setGravando(false);
    if (r?.ok) {
      setAtual("");
      setNova("");
      setConfirma("");
      setAviso({ tom: "ok", texto: "Senha trocada." });
    } else {
      setAviso({ tom: "erro", texto: r ? r.erro : "Não foi possível falar com o servidor." });
    }
  }

  return (
    <Cartao>
      <TituloCartao>Trocar a senha</TituloCartao>
      <form onSubmit={enviar} noValidate className="mt-3 flex flex-col gap-4">
        <Campo rotulo="Senha atual">
          <Entrada type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />
        </Campo>
        <Campo rotulo="Senha nova (mínimo de 8 caracteres)">
          <Entrada type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
        </Campo>
        <Campo rotulo="Repita a senha nova">
          <Entrada type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        </Campo>
        {aviso && <Mensagem {...aviso} />}
        <Botao variante="primario" type="submit" disabled={gravando || !atual || !nova}>
          {gravando ? "Gravando…" : "Trocar a senha"}
        </Botao>
      </form>
    </Cartao>
  );
}

function NovoCodigo() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (gravando) return;
    setGravando(true);
    setErro(null);
    const r = await gerarCodigoRecuperacao(senha).catch(() => null);
    setGravando(false);
    setSenha("");
    if (r?.ok) setCodigo(r.valor);
    else setErro(r ? r.erro : "Não foi possível falar com o servidor.");
  }

  return (
    <Cartao>
      {codigo ? (
        <CodigoRecuperacao codigo={codigo} textoBotao="Concluir" onContinuar={() => setCodigo(null)} />
      ) : (
        <>
          <TituloCartao>Código de recuperação</TituloCartao>
          <p className="mt-2 text-[13px] leading-relaxed text-tinta2">
            Perdeu o código ou acha que alguém viu? Gere outro. O anterior deixa de valer
            na hora.
          </p>
          <form onSubmit={enviar} noValidate className="mt-3 flex flex-col gap-4">
            <Campo rotulo="Confirme com a sua senha">
              <Entrada type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </Campo>
            {erro && <Mensagem tom="erro" texto={erro} />}
            <Botao type="submit" disabled={gravando || !senha}>
              {gravando ? "Gerando…" : "Gerar código novo"}
            </Botao>
          </form>
        </>
      )}
    </Cartao>
  );
}

function Mensagem({ tom, texto }: { tom: "ok" | "erro"; texto: string }) {
  return (
    <p
      role="alert"
      className={`rounded-md px-3 py-2 text-[13px] font-medium ${
        tom === "ok" ? "bg-positivo-claro text-positivo" : "bg-alerta-claro text-alerta"
      }`}
    >
      {texto}
    </p>
  );
}
