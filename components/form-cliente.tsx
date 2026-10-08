"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import {
  apenasDigitos,
  consultarCNPJ,
  mascaraDocumento,
  mascaraTelefone,
  validarDocumento,
} from "@/lib/documentos";
import type { Cliente } from "@/lib/tipos";
import { Botao, Campo, Entrada } from "./ui";
import { Modal } from "./modal";

const paraTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const paraCentavos = (t: string) =>
  Math.round((parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0) * 100);

const vazio = (): Cliente => ({
  id: "",
  tipo: "PJ",
  nomeRazao: "",
  cpfCnpj: "",
  inscricaoEstadual: "",
  telefone: "",
  email: "",
  endereco: "",
  tipoPreco: "VAREJO",
  limiteCredito: 0,
  ativo: true,
});

export function FormCliente({
  aberto,
  cliente,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  /** Ausente = cadastro novo. */
  cliente?: Cliente | null;
  onFechar: () => void;
  onSalvo?: (c: Cliente) => void;
}) {
  return (
    <Modal
      aberto={aberto}
      titulo={cliente ? "Editar cliente" : "Novo cliente"}
      descricao="O documento sai impresso no recibo. A tabela de preço define se ele compra no atacado."
      onFechar={onFechar}
    >
      {aberto && (
        <Corpo
          key={cliente?.id ?? "novo"}
          inicial={cliente ?? vazio()}
          novo={!cliente}
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
  inicial: Cliente;
  novo: boolean;
  onFechar: () => void;
  onSalvo?: (c: Cliente) => void;
}) {
  const { estado, salvarCliente } = useEstado();
  const { podeDefinirPreco, ehAdmin } = usePerfil();
  const [c, setC] = useState<Cliente>(inicial);
  const [limiteTexto, setLimiteTexto] = useState(paraTexto(inicial.limiteCredito));
  const [tentou, setTentou] = useState(false);
  // trava o botao enquanto grava: no modo banco a resposta vem do servidor
  const [gravando, setGravando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  const muda = <K extends keyof Cliente>(k: K, v: Cliente[K]) =>
    setC((x) => ({ ...x, [k]: v }));

  const digitos = apenasDigitos(c.cpfCnpj);
  const docPreenchido = digitos.length > 0;
  const docValido = !docPreenchido || validarDocumento(c.tipo, c.cpfCnpj);
  const duplicado = useMemo(
    () =>
      docPreenchido
        ? estado.clientes.find(
            (x) => x.id !== c.id && apenasDigitos(x.cpfCnpj) === digitos,
          )
        : undefined,
    [estado.clientes, c.id, digitos, docPreenchido],
  );

  const erros = {
    nome: !c.nomeRazao.trim() ? "Informe o nome." : "",
    doc:
      c.tipo === "PJ" && !docPreenchido
        ? "CNPJ é obrigatório para empresa — ele sai no recibo."
        : !docValido
          ? `${c.tipo === "PF" ? "CPF" : "CNPJ"} inválido: confira os números.`
          : duplicado
            ? `Já existe um cliente com este documento: ${duplicado.nomeRazao}.`
            : "",
  };
  const valido = !erros.nome && !erros.doc;

  async function buscar() {
    setAviso(null);
    setBuscando(true);
    try {
      const r = await consultarCNPJ(c.cpfCnpj);
      setC((x) => ({
        ...x,
        nomeRazao: r.razaoSocial || x.nomeRazao,
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

  /** Grava e fecha. Se a gravacao for recusada, o aviso aparece e o painel fica aberto. */
  async function gravar(cliente: Cliente) {
    setGravando(true);
    try {
      const gravado = await salvarCliente(cliente);
      onSalvo?.(gravado);
      onFechar();
    } catch {
      setGravando(false);
    }
  }

  function salvar() {
    setTentou(true);
    if (!valido || gravando) return;
    void gravar({
      ...c,
      nomeRazao: c.nomeRazao.trim(),
      cpfCnpj: mascaraDocumento(c.tipo, c.cpfCnpj),
      inscricaoEstadual: c.tipo === "PJ" ? c.inscricaoEstadual : undefined,
      limiteCredito: podeDefinirPreco ? paraCentavos(limiteTexto) : c.limiteCredito,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1.5 rounded-md border border-borda bg-superficie p-1">
        {(["PJ", "PF"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              muda("tipo", t);
              muda("cpfCnpj", mascaraDocumento(t, c.cpfCnpj));
              setAviso(null);
            }}
            className={`transicao rounded px-3 py-1.5 text-[13px] font-semibold ${
              c.tipo === t ? "bg-marca text-white" : "text-tinta2 hover:bg-superficie2"
            }`}
          >
            {t === "PJ" ? "Empresa (CNPJ)" : "Pessoa física (CPF)"}
          </button>
        ))}
      </div>

      <Campo
        rotulo={c.tipo === "PJ" ? "CNPJ" : "CPF (opcional)"}
        dica={
          c.tipo === "PJ"
            ? "Com o CNPJ digitado, busque na Receita para preencher o resto."
            : undefined
        }
      >
        <div className="flex gap-2">
          <Entrada
            inputMode="numeric"
            value={c.cpfCnpj}
            onChange={(e) => {
              muda("cpfCnpj", mascaraDocumento(c.tipo, e.target.value));
              setAviso(null);
            }}
            placeholder={c.tipo === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
            aria-invalid={Boolean((tentou || docPreenchido) && erros.doc)}
          />
          {c.tipo === "PJ" && (
            <Botao
              type="button"
              onClick={buscar}
              disabled={buscando || digitos.length !== 14 || !docValido}
              className="shrink-0"
            >
              <Search size={14} /> {buscando ? "Buscando…" : "Buscar"}
            </Botao>
          )}
        </div>
      </Campo>
      {(tentou || (docPreenchido && digitos.length >= (c.tipo === "PJ" ? 14 : 11))) &&
        erros.doc && <Erro>{erros.doc}</Erro>}
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

      <Campo rotulo={c.tipo === "PJ" ? "Razão social" : "Nome completo"}>
        <Entrada
          value={c.nomeRazao}
          onChange={(e) => muda("nomeRazao", e.target.value)}
        />
      </Campo>
      {tentou && erros.nome && <Erro>{erros.nome}</Erro>}

      {c.tipo === "PJ" && (
        <Campo rotulo="Inscrição estadual (opcional)">
          <Entrada
            value={c.inscricaoEstadual ?? ""}
            onChange={(e) => muda("inscricaoEstadual", e.target.value)}
          />
        </Campo>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Telefone">
          <Entrada
            inputMode="tel"
            value={c.telefone}
            onChange={(e) => muda("telefone", mascaraTelefone(e.target.value))}
            placeholder="(19) 99999-9999"
          />
        </Campo>
        <Campo rotulo="E-mail (opcional)">
          <Entrada
            type="email"
            value={c.email ?? ""}
            onChange={(e) => muda("email", e.target.value)}
          />
        </Campo>
      </div>

      <Campo rotulo="Endereço">
        <Entrada
          value={c.endereco}
          onChange={(e) => muda("endereco", e.target.value)}
          placeholder="Rua, número — bairro, cidade/UF"
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Tabela de preço"
          dica={
            podeDefinirPreco
              ? "Atacado: todo item sai no preço de atacado."
              : "Só a administradora define cliente de atacado."
          }
        >
          <div className="grid grid-cols-2 gap-1.5">
            {(["VAREJO", "ATACADO"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={!podeDefinirPreco}
                onClick={() => muda("tipoPreco", t)}
                className={`transicao rounded-md border px-2 py-2 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                  c.tipoPreco === t
                    ? "border-marca bg-marca-clara text-marca"
                    : "border-borda text-tinta2 hover:border-borda2"
                }`}
              >
                {t === "VAREJO" ? "Varejo" : "Atacado"}
              </button>
            ))}
          </div>
        </Campo>
        <Campo
          rotulo="Limite de crédito (R$)"
          dica={podeDefinirPreco ? "Quanto ele pode comprar fiado." : "Definido pela administradora."}
        >
          <Entrada
            inputMode="decimal"
            value={limiteTexto}
            onChange={(e) => setLimiteTexto(e.target.value)}
            disabled={!podeDefinirPreco}
          />
        </Campo>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-borda pt-4">
        {!novo && ehAdmin ? (
          <Botao
            type="button"
            variante={c.ativo ? "perigo" : "secundario"}
            tamanho="sm"
            disabled={gravando}
            onClick={() => void gravar({ ...c, ativo: !c.ativo })}
          >
            {c.ativo ? "Desativar cliente" : "Reativar cliente"}
          </Botao>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Botao type="button" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="button" variante="primario" onClick={salvar} disabled={gravando}>
            {novo ? "Cadastrar cliente" : "Salvar"}
          </Botao>
        </div>
      </div>
      {!novo && (
        <p className="text-[11.5px] leading-relaxed text-suave">
          Cliente não é apagado: as vendas antigas apontam para ele. Desativado,
          ele some da lista da venda mas o histórico continua.
        </p>
      )}
    </div>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return <p className="-mt-2 text-[12px] font-medium text-alerta">{children}</p>;
}
