"use client";

import { useState } from "react";
import { cadastrarUsuario, definirSenhaDoUsuario, editarUsuario } from "@/app/acoes-contas";
import { useEstado, usePerfil } from "@/lib/store";
import type { Perfil, Usuario } from "@/lib/tipos";
import { Botao, Campo, Entrada, Selecao } from "./ui";
import { Modal } from "./modal";

export const NOME_PERFIL: Record<Perfil, string> = {
  ADMIN: "Administração",
  CAIXA: "Caixa",
  ESTOQUE: "Estoque",
};

const EXPLICA_PERFIL: Record<Perfil, string> = {
  ADMIN: "Vê tudo, define preços e cadastra usuários.",
  CAIXA: "Vende e opera o caixa. Não vê custo nem lucro.",
  ESTOQUE: "Lança entradas e confere o estoque. Não vende nem vê lucro.",
};

export function FormUsuario({
  aberto,
  usuario,
  onFechar,
}: {
  aberto: boolean;
  usuario?: Usuario | null;
  onFechar: () => void;
}) {
  return (
    <Modal
      aberto={aberto}
      titulo={usuario ? "Editar usuário" : "Novo usuário"}
      descricao="Cada pessoa entra com o próprio e-mail e senha, e a auditoria mostra quem fez o quê."
      onFechar={onFechar}
    >
      {aberto && <CorpoUsuario key={usuario?.id ?? "novo"} usuario={usuario ?? null} onFechar={onFechar} />}
    </Modal>
  );
}

function CorpoUsuario({ usuario, onFechar }: { usuario: Usuario | null; onFechar: () => void }) {
  const { recarregar } = useEstado();
  const { usuario: eu } = usePerfil();
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "CAIXA");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  async function gravar(ativo: boolean) {
    if (gravando) return;
    setErro(null);
    setGravando(true);
    const r = await (usuario
      ? editarUsuario({ id: usuario.id, nome, email, perfil, ativo })
      : cadastrarUsuario({ nome, email, perfil, senha })
    ).catch(() => null);
    if (r?.ok) {
      await recarregar();
      onFechar();
      return;
    }
    setGravando(false);
    setErro(r ? r.erro : "Não foi possível falar com o servidor.");
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo rotulo="Nome">
        <Entrada value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Campo rotulo="E-mail (é o que a pessoa usa para entrar)">
        <Entrada type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Campo>
      <Campo rotulo="Perfil" dica={EXPLICA_PERFIL[perfil]}>
        <Selecao value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
          {(Object.keys(NOME_PERFIL) as Perfil[]).map((p) => (
            <option key={p} value={p}>
              {NOME_PERFIL[p]}
            </option>
          ))}
        </Selecao>
      </Campo>
      {!usuario && (
        <Campo rotulo="Senha inicial (mínimo de 8 caracteres)" dica="Combine com a pessoa e peça para ela trocar em Minha conta.">
          <Entrada type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
      )}

      {erro && (
        <p role="alert" className="rounded-md bg-alerta-claro px-3 py-2 text-[13px] font-medium text-alerta">
          {erro}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-borda pt-4">
        {usuario && usuario.id !== eu?.id ? (
          <Botao
            type="button"
            variante={usuario.ativo ? "perigo" : "secundario"}
            tamanho="sm"
            disabled={gravando}
            onClick={() => void gravar(!usuario.ativo)}
          >
            {usuario.ativo ? "Desativar acesso" : "Reativar acesso"}
          </Botao>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Botao type="button" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="button" variante="primario" disabled={gravando} onClick={() => void gravar(usuario?.ativo ?? true)}>
            {usuario ? "Salvar" : "Cadastrar usuário"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

/** Quem esqueceu a senha pede uma nova para a administracao. */
export function FormSenhaUsuario({ usuario, onFechar }: { usuario: Usuario | null; onFechar: () => void }) {
  return (
    <Modal
      aberto={usuario !== null}
      titulo="Definir senha nova"
      descricao={usuario ? `Para ${usuario.nome}. Se a conta estiver bloqueada, ela é liberada junto.` : undefined}
      onFechar={onFechar}
    >
      {usuario && <CorpoSenha key={usuario.id} usuario={usuario} onFechar={onFechar} />}
    </Modal>
  );
}

function CorpoSenha({ usuario, onFechar }: { usuario: Usuario; onFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  async function gravar() {
    if (gravando) return;
    setErro(null);
    setGravando(true);
    const r = await definirSenhaDoUsuario({ id: usuario.id, senha }).catch(() => null);
    if (r?.ok) {
      onFechar();
      return;
    }
    setGravando(false);
    setErro(r ? r.erro : "Não foi possível falar com o servidor.");
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo rotulo="Senha nova (mínimo de 8 caracteres)" dica="Combine com a pessoa e peça para ela trocar em Minha conta.">
        <Entrada type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </Campo>
      {erro && (
        <p role="alert" className="rounded-md bg-alerta-claro px-3 py-2 text-[13px] font-medium text-alerta">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-borda pt-4">
        <Botao type="button" onClick={onFechar}>
          Cancelar
        </Botao>
        <Botao type="button" variante="primario" disabled={gravando} onClick={() => void gravar()}>
          Definir senha
        </Botao>
      </div>
    </div>
  );
}
