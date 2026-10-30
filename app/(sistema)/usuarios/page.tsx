"use client";

import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { FormSenhaUsuario, FormUsuario, NOME_PERFIL } from "@/components/form-usuario";
import { Lista, type ColunaLista } from "@/components/lista";
import type { Usuario } from "@/lib/tipos";
import { Aviso, Botao, Cabecalho, Etiqueta } from "@/components/ui";

export default function Usuarios() {
  const { modo, estado } = useEstado();
  const { ehAdmin } = usePerfil();
  const [form, setForm] = useState<{ usuario: Usuario | null } | null>(null);
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);

  const ordenados = useMemo(
    () =>
      [...estado.usuarios].sort(
        (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    [estado.usuarios],
  );

  if (modo !== "banco" || !ehAdmin) {
    return (
      <Aviso tom="alerta" titulo="Sem acesso">
        Só a administração cadastra usuários.
      </Aviso>
    );
  }

  const colunas: ColunaLista<Usuario>[] = [
    { chave: "nome", titulo: "Nome", papel: "titulo", render: (u) => <>{u.nome}</> },
    {
      chave: "email",
      titulo: "E-mail",
      render: (u) => <span className="text-suave">{u.email}</span>,
    },
    { chave: "perfil", titulo: "Perfil", render: (u) => <>{NOME_PERFIL[u.perfil]}</> },
    {
      chave: "situacao",
      titulo: "Situação",
      alinha: "right",
      render: (u) => <Etiqueta tom={u.ativo ? "positivo" : "neutro"}>{u.ativo ? "Ativo" : "Desativado"}</Etiqueta>,
    },
  ];

  function detalhe(u: Usuario) {
    return (
      <div className="flex flex-wrap gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setForm({ usuario: u });
          }}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
        >
          <Pencil size={13} /> Editar cadastro
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSenhaDe(u);
          }}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-marca hover:underline"
        >
          <KeyRound size={13} /> Definir senha nova
        </button>
      </div>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Usuários"
        descricao="Quem entra no sistema e o que cada pessoa pode ver. Usuário não se apaga, para o histórico continuar mostrando quem fez cada venda."
        acoes={
          <Botao variante="primario" onClick={() => setForm({ usuario: null })} className="w-full sm:w-auto">
            <Plus size={15} /> Novo usuário
          </Botao>
        }
      />
      <Lista colunas={colunas} linhas={ordenados} chave={(u) => u.id} detalhe={detalhe} vazio="Nenhum usuário." />
      <FormUsuario aberto={form !== null} usuario={form?.usuario} onFechar={() => setForm(null)} />
      <FormSenhaUsuario usuario={senhaDe} onFechar={() => setSenhaDe(null)} />
    </>
  );
}
