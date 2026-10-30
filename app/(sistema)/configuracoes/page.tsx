"use client";

import { useState } from "react";
import { gravarEmpresa } from "@/app/acoes-contas";
import { CamposEmpresa } from "@/components/form-empresa";
import { Aviso, Botao, Cabecalho, Cartao, TituloCartao } from "@/components/ui";
import { useEstado, usePerfil } from "@/lib/store";
import type { Empresa } from "@/lib/tipos";

export default function Configuracoes() {
  const { modo, estado } = useEstado();
  const { ehAdmin } = usePerfil();

  if (modo !== "banco" || !ehAdmin) {
    return (
      <Aviso tom="alerta" titulo="Sem acesso">
        Só a administração muda as configurações.
      </Aviso>
    );
  }

  return (
    <>
      <Cabecalho titulo="Configurações" descricao="Os dados que aparecem nos recibos e o funcionamento do sistema neste computador." />
      <div className="flex max-w-3xl flex-col gap-4">
        <DadosEmpresa key={estado.empresa.cnpj} inicial={estado.empresa} />
      </div>
    </>
  );
}

function DadosEmpresa({ inicial }: { inicial: Empresa }) {
  const { recarregar } = useEstado();
  const [empresa, setEmpresa] = useState(inicial);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [gravando, setGravando] = useState(false);

  async function salvar() {
    if (gravando) return;
    setGravando(true);
    setAviso(null);
    const r = await gravarEmpresa(empresa).catch(() => null);
    if (r?.ok) {
      await recarregar();
      setAviso({ tom: "ok", texto: "Dados salvos. Valem para os próximos recibos: os já emitidos não mudam." });
    } else {
      setAviso({ tom: "erro", texto: r ? r.erro : "Não foi possível falar com o servidor." });
    }
    setGravando(false);
  }

  return (
    <Cartao>
      <TituloCartao>Dados da empresa</TituloCartao>
      <div className="mt-3 flex flex-col gap-4">
        <CamposEmpresa
          empresa={empresa}
          onMudar={(e) => {
            setEmpresa(e);
            setAviso(null);
          }}
        />
        {aviso && (
          <p
            role="alert"
            className={`rounded-md px-3 py-2 text-[13px] font-medium ${
              aviso.tom === "ok" ? "bg-positivo-claro text-positivo" : "bg-alerta-claro text-alerta"
            }`}
          >
            {aviso.texto}
          </p>
        )}
        <div className="flex justify-end">
          <Botao variante="primario" onClick={() => void salvar()} disabled={gravando}>
            {gravando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}
