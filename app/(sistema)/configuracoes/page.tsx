"use client";

import { useEffect, useState } from "react";
import { DatabaseBackup, FolderOpen, History, Printer, RefreshCw } from "lucide-react";
import { fazerBackupAgora, gravarEmpresa, lerSituacaoBackup } from "@/app/acoes-contas";
import { CamposEmpresa } from "@/components/form-empresa";
import { Aviso, Botao, Cabecalho, Campo, Cartao, Selecao, TituloCartao } from "@/components/ui";
import { eletron } from "@/lib/eletron";
import { dataHora } from "@/lib/formato";
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
        <Impressora />
        <Backup />
        <Atualizacao />
      </div>
    </>
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
        {aviso && <Mensagem {...aviso} />}
        <div className="flex justify-end">
          <Botao variante="primario" onClick={() => void salvar()} disabled={gravando}>
            {gravando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

/** So existe no programa instalado: no navegador, quem escolhe e a janela de impressao. */
function Impressora() {
  const [lista, setLista] = useState<{ nomes: string[]; escolhida: string | null } | null>(null);
  const programa = eletron();

  useEffect(() => {
    void programa?.impressoras().then(setLista);
  }, [programa]);

  if (!programa || !lista) return null;

  async function escolher(nome: string) {
    await programa?.definirImpressora(nome || null);
    setLista((l) => (l ? { ...l, escolhida: nome || null } : l));
  }

  return (
    <Cartao>
      <TituloCartao>Impressora de recibos</TituloCartao>
      <div className="mt-3 flex flex-col gap-3">
        <Campo
          rotulo="Imprimir recibo sai direto em"
          dica="Sem impressora escolhida, o sistema procura uma Elgin i9. Se não achar, abre a janela de impressão."
        >
          <Selecao value={lista.escolhida ?? ""} onChange={(e) => void escolher(e.target.value)}>
            <option value="">Escolher sozinho</option>
            {lista.nomes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Selecao>
        </Campo>
        {lista.nomes.length === 0 && (
          <p className="flex items-center gap-2 text-[13px] text-suave">
            <Printer size={15} /> Nenhuma impressora instalada neste computador.
          </p>
        )}
      </div>
    </Cartao>
  );
}

function Backup() {
  type Situacao = { pasta: string; ultimoEm: string | null; quantidade: number };
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [fazendo, setFazendo] = useState(false);
  const programa = eletron();

  useEffect(() => {
    void lerSituacaoBackup()
      .then((r) => r.ok && setSituacao(r.valor))
      .catch(() => {});
  }, []);

  if (!situacao?.pasta) return null;

  async function agora() {
    setFazendo(true);
    setAviso(null);
    const r = await fazerBackupAgora().catch(() => null);
    setFazendo(false);
    if (r?.ok) {
      setSituacao(r.valor);
      setAviso({ tom: "ok", texto: "Backup feito e conferido." });
    } else {
      setAviso({ tom: "erro", texto: r ? r.erro : "Não foi possível fazer o backup." });
    }
  }

  async function restaurar() {
    setAviso(null);
    const r = await programa?.restaurarBackup();
    if (r && !r.ok && r.erro) setAviso({ tom: "erro", texto: r.erro });
  }

  return (
    <Cartao>
      <TituloCartao>Backup</TituloCartao>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-tinta2">
          O sistema faz uma cópia por dia e guarda as últimas 30.{" "}
          {situacao.ultimoEm ? (
            <>
              A última foi em <b>{dataHora(situacao.ultimoEm)}</b>.
            </>
          ) : (
            <b>Ainda não há nenhuma cópia.</b>
          )}
        </p>
        <p className="mono break-all text-[12px] text-suave">{situacao.pasta}</p>
        <Aviso tom="casco" titulo="Guarde uma cópia fora do computador">
          Se o disco queimar ou o computador for roubado, a cópia que está nele vai junto.
          Uma vez por semana, passe o arquivo mais recente para um pen drive.
        </Aviso>
        {aviso && <Mensagem {...aviso} />}
        <div className="flex flex-wrap justify-end gap-2">
          {programa && (
            <>
              <Botao onClick={() => void restaurar()}>
                <History size={15} /> Restaurar um backup
              </Botao>
              <Botao onClick={() => void programa.abrirPastaBackups()}>
                <FolderOpen size={15} /> Abrir a pasta
              </Botao>
            </>
          )}
          <Botao variante="primario" onClick={() => void agora()} disabled={fazendo}>
            <DatabaseBackup size={15} /> {fazendo ? "Fazendo…" : "Fazer backup agora"}
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

function Atualizacao() {
  type Situacao =
    | { tom: "nada" }
    | { tom: "buscando"; pct: number | null }
    | { tom: "atual" }
    | { tom: "baixada"; versao: string }
    | { tom: "erro"; texto: string };
  const [versao, setVersao] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<Situacao>({ tom: "nada" });
  const programa = eletron();

  useEffect(() => {
    void programa?.versao().then(setVersao);
  }, [programa]);

  useEffect(() => {
    return programa?.aoProgressoDaAtualizacao((pct) => setSituacao({ tom: "buscando", pct }));
  }, [programa]);

  if (!programa || !versao) return null;

  async function buscar() {
    setSituacao({ tom: "buscando", pct: null });
    const r = await programa!.buscarAtualizacao().catch(() => null);
    if (!r) return setSituacao({ tom: "erro", texto: "Não foi possível procurar atualização." });
    if (r.estado === "atual") setSituacao({ tom: "atual" });
    else if (r.estado === "baixada") setSituacao({ tom: "baixada", versao: r.versao ?? "" });
    else if (r.estado === "ocupado") setSituacao({ tom: "buscando", pct: null });
    else if (r.estado === "indisponivel") setSituacao({ tom: "erro", texto: "Só funciona no programa instalado." });
    else setSituacao({ tom: "erro", texto: `Não foi possível atualizar: ${r.erro ?? "sem internet?"}` });
  }

  const buscando = situacao.tom === "buscando";
  return (
    <Cartao>
      <TituloCartao>Atualização</TituloCartao>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-tinta2">
          Versão instalada: <b>{versao}</b>. O sistema procura versão nova sozinho ao abrir, quando há internet.
        </p>
        {situacao.tom === "atual" && <Mensagem tom="ok" texto="Está tudo certo: você já usa a versão mais recente." />}
        {situacao.tom === "erro" && <Mensagem tom="erro" texto={situacao.texto} />}
        {buscando && (
          <p className="text-[13px] text-tinta2">
            {situacao.pct == null ? "Procurando…" : `Baixando a nova versão… ${situacao.pct}%`}
          </p>
        )}
        {situacao.tom === "baixada" && (
          <Mensagem tom="ok" texto={`A versão ${situacao.versao} está pronta. O sistema fecha, instala e abre de novo; seus dados ficam como estão.`} />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {situacao.tom === "baixada" ? (
            <Botao variante="primario" onClick={() => void programa.instalarAtualizacao()}>
              <RefreshCw size={15} /> Reiniciar e instalar
            </Botao>
          ) : (
            <Botao variante="primario" onClick={() => void buscar()} disabled={buscando}>
              <RefreshCw size={15} /> {buscando ? "Procurando…" : "Buscar atualizações"}
            </Botao>
          )}
        </div>
      </div>
    </Cartao>
  );
}
