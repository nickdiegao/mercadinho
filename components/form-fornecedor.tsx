"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import {
  apenasDigitos,
  consultarCNPJ,
  mascaraCNPJ,
  mascaraTelefone,
  validarCNPJ,
} from "@/lib/documentos";
import type { Fornecedor } from "@/lib/tipos";
import { Botao, Campo, Entrada } from "./ui";
import { Modal } from "./modal";

const vazio = (): Fornecedor => ({
  id: "",
  razaoSocial: "",
  cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
  ativo: true,
});

export function FormFornecedor({
  aberto,
  fornecedor,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  fornecedor?: Fornecedor | null;
  onFechar: () => void;
  onSalvo?: (f: Fornecedor) => void;
}) {
  return (
    <Modal
      aberto={aberto}
      titulo={fornecedor ? "Editar fornecedor" : "Novo fornecedor"}
      descricao="Digite o CNPJ e busque na Receita — o resto se preenche sozinho."
      onFechar={onFechar}
    >
      {aberto && (
        <Corpo
          key={fornecedor?.id ?? "novo"}
          inicial={fornecedor ?? vazio()}
          novo={!fornecedor}
          onFechar={onFechar}
          onSalvo={onSalvo}
        />
      )}
    </Modal>
  );
}

function Corpo({
  inicial,
  novo,
  onFechar,
  onSalvo,
}: {
  inicial: Fornecedor;
  novo: boolean;
  onFechar: () => void;
  onSalvo?: (f: Fornecedor) => void;
}) {
  const { estado, salvarFornecedor } = useEstado();
  const { ehAdmin } = usePerfil();
  const [f, setF] = useState<Fornecedor>(inicial);
  const [tentou, setTentou] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const muda = <K extends keyof Fornecedor>(k: K, v: Fornecedor[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  const digitos = apenasDigitos(f.cnpj);
  const cnpjValido = validarCNPJ(f.cnpj);
  const duplicado = useMemo(
    () =>
      digitos
        ? estado.fornecedores.find(
            (x) => x.id !== f.id && apenasDigitos(x.cnpj) === digitos,
          )
        : undefined,
    [estado.fornecedores, f.id, digitos],
  );

  const erros = {
    razao: !f.razaoSocial.trim() ? "Informe a razão social." : "",
    cnpj: !digitos
      ? "Informe o CNPJ."
      : !cnpjValido
        ? "CNPJ inválido: confira os números."
        : duplicado
          ? `Já existe um fornecedor com este CNPJ: ${duplicado.razaoSocial}.`
          : "",
  };
  const valido = !erros.razao && !erros.cnpj;

  async function buscar() {
    setAviso(null);
    setBuscando(true);
    try {
      const r = await consultarCNPJ(f.cnpj);
      setF((x) => ({
        ...x,
        razaoSocial: r.razaoSocial || x.razaoSocial,
        endereco: r.endereco || x.endereco,
        telefone: r.telefone || x.telefone,
        email: r.email || x.email,
      }));
      setAviso({
        tom: r.situacao && r.situacao !== "ATIVA" ? "erro" : "ok",
        texto:
          r.situacao && r.situacao !== "ATIVA"
            ? `Dados preenchidos, mas a situação na Receita é ${r.situacao}.`
            : "Dados preenchidos pela Receita. Confira antes de salvar.",
      });
    } catch (e) {
      setAviso({ tom: "erro", texto: (e as Error).message });
    } finally {
      setBuscando(false);
    }
  }

  function salvar() {
    setTentou(true);
    if (!valido) return;
    const gravado = salvarFornecedor({
      ...f,
      razaoSocial: f.razaoSocial.trim(),
      cnpj: mascaraCNPJ(f.cnpj),
    });
    onSalvo?.(gravado);
    onFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <Campo rotulo="CNPJ">
        <div className="flex gap-2">
          <Entrada
            inputMode="numeric"
            value={f.cnpj}
            onChange={(e) => {
              muda("cnpj", mascaraCNPJ(e.target.value));
              setAviso(null);
            }}
            placeholder="00.000.000/0000-00"
            aria-invalid={Boolean((tentou || digitos.length === 14) && erros.cnpj)}
          />
          <Botao
            type="button"
            onClick={buscar}
            disabled={buscando || !cnpjValido}
            className="shrink-0"
          >
            <Search size={14} /> {buscando ? "Buscando…" : "Buscar"}
          </Botao>
        </div>
      </Campo>
      {(tentou || digitos.length === 14) && erros.cnpj && <Erro>{erros.cnpj}</Erro>}
      {aviso && (
        <p
          className={`-mt-2 rounded-md px-3 py-2 text-[12.5px] ${
            aviso.tom === "ok"
              ? "bg-positivo-claro text-positivo"
              : "bg-alerta-claro text-alerta"
          }`}
        >
          {aviso.texto}
        </p>
      )}

      <Campo rotulo="Razão social">
        <Entrada
          value={f.razaoSocial}
          onChange={(e) => muda("razaoSocial", e.target.value)}
        />
      </Campo>
      {tentou && erros.razao && <Erro>{erros.razao}</Erro>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Telefone">
          <Entrada
            inputMode="tel"
            value={f.telefone}
            onChange={(e) => muda("telefone", mascaraTelefone(e.target.value))}
            placeholder="(19) 3333-3333"
          />
        </Campo>
        <Campo rotulo="E-mail de pedidos">
          <Entrada
            type="email"
            value={f.email}
            onChange={(e) => muda("email", e.target.value)}
          />
        </Campo>
      </div>

      <Campo rotulo="Endereço">
        <Entrada
          value={f.endereco}
          onChange={(e) => muda("endereco", e.target.value)}
        />
      </Campo>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-borda pt-4">
        {!novo && ehAdmin ? (
          <Botao
            type="button"
            variante={f.ativo !== false ? "perigo" : "secundario"}
            tamanho="sm"
            onClick={() => {
              const gravado = salvarFornecedor({ ...f, ativo: f.ativo === false });
              onSalvo?.(gravado);
              onFechar();
            }}
          >
            {f.ativo !== false ? "Desativar fornecedor" : "Reativar fornecedor"}
          </Botao>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Botao type="button" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="button" variante="primario" onClick={salvar}>
            {novo ? "Cadastrar fornecedor" : "Salvar"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return <p className="-mt-2 text-[12px] font-medium text-alerta">{children}</p>;
}
