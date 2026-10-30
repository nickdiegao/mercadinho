"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { consultarCNPJ, mascaraCNPJ, mascaraTelefone, validarCNPJ } from "@/lib/documentos";
import type { Empresa } from "@/lib/tipos";
import { Botao, Campo, Entrada } from "./ui";

export const empresaVazia = (): Empresa => ({
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  regimeTributario: "",
  endereco: "",
  telefone: "",
  email: "",
});

/** Os campos da empresa: usados na primeira abertura e nas configuracoes. */
export function CamposEmpresa({
  empresa: e,
  onMudar,
}: {
  empresa: Empresa;
  onMudar: (e: Empresa) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const muda = <K extends keyof Empresa>(k: K, v: Empresa[K]) => onMudar({ ...e, [k]: v });

  async function buscar() {
    setAviso(null);
    setBuscando(true);
    try {
      const r = await consultarCNPJ(e.cnpj);
      onMudar({
        ...e,
        razaoSocial: r.razaoSocial || e.razaoSocial,
        nomeFantasia: e.nomeFantasia || r.nomeFantasia || r.razaoSocial,
        endereco: r.endereco || e.endereco,
        telefone: r.telefone || e.telefone,
        email: r.email || e.email,
      });
      setAviso({ tom: "ok", texto: "Dados preenchidos pela Receita. Confira antes de salvar." });
    } catch (falha) {
      setAviso({ tom: "erro", texto: (falha as Error).message });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo rotulo="CNPJ">
        <div className="flex gap-2">
          <Entrada
            inputMode="numeric"
            value={e.cnpj}
            onChange={(ev) => {
              muda("cnpj", mascaraCNPJ(ev.target.value));
              setAviso(null);
            }}
            placeholder="00.000.000/0000-00"
          />
          <Botao
            type="button"
            onClick={buscar}
            disabled={buscando || !validarCNPJ(e.cnpj)}
            className="shrink-0"
          >
            <Search size={14} /> {buscando ? "Buscando…" : "Buscar"}
          </Botao>
        </div>
      </Campo>
      {aviso && (
        <p
          className={`-mt-2 rounded-md px-3 py-2 text-[12.5px] ${
            aviso.tom === "ok" ? "bg-positivo-claro text-positivo" : "bg-alerta-claro text-alerta"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da empresa">
          <Entrada value={e.nomeFantasia} onChange={(ev) => muda("nomeFantasia", ev.target.value)} />
        </Campo>
        <Campo rotulo="Razão social">
          <Entrada value={e.razaoSocial} onChange={(ev) => muda("razaoSocial", ev.target.value)} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Inscrição estadual">
          <Entrada value={e.inscricaoEstadual} onChange={(ev) => muda("inscricaoEstadual", ev.target.value)} />
        </Campo>
        <Campo rotulo="Telefone">
          <Entrada
            inputMode="tel"
            value={e.telefone}
            onChange={(ev) => muda("telefone", mascaraTelefone(ev.target.value))}
            placeholder="(19) 3333-3333"
          />
        </Campo>
      </div>

      <Campo rotulo="Endereço">
        <Entrada value={e.endereco} onChange={(ev) => muda("endereco", ev.target.value)} />
      </Campo>
    </div>
  );
}
