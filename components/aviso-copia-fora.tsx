"use client";

import { useEffect, useState } from "react";
import { HardDriveDownload } from "lucide-react";
import { Aviso, Botao } from "@/components/ui";
import { copiarParaFora } from "@/lib/copia-fora";
import { eletron } from "@/lib/eletron";
import { usePerfil } from "@/lib/store";

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

/**
 * Faixa para a administracao quando faz mais de 7 dias sem uma copia do backup
 * fora do computador. Sem ela, um disco queimado leva o sistema e as copias
 * juntos. Conta desde a ultima copia, ou desde o primeiro backup se nunca houve.
 */
export function AvisoCopiaFora() {
  const { ehAdmin } = usePerfil();
  const programa = eletron();
  const [dias, setDias] = useState<number | null>(null);
  const [nunca, setNunca] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const [fazendo, setFazendo] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  useEffect(() => {
    if (!programa || !ehAdmin) return;
    void programa
      .situacaoCopiaFora()
      .then((s) => {
        const referencia = s.ultimaEm ?? s.primeiroBackupEm;
        if (!referencia) return;
        const passou = Date.now() - new Date(referencia).getTime();
        if (passou >= SETE_DIAS) {
          setDias(Math.floor(passou / (24 * 60 * 60 * 1000)));
          setNunca(!s.ultimaEm);
        }
      })
      .catch(() => {});
  }, [programa, ehAdmin]);

  if (!programa || !ehAdmin || dispensado || (dias === null && !feito)) return null;

  async function copiar() {
    setFazendo(true);
    setErro("");
    const r = await copiarParaFora();
    setFazendo(false);
    if (r.ok) {
      setFeito(r.texto);
      setDias(null);
    } else if (!r.cancelado) setErro(r.texto);
  }

  if (feito)
    return (
      <div className="nao-imprime mb-4">
        <Aviso tom="positivo" titulo="Cópia guardada fora do computador">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{feito}</p>
            <Botao onClick={() => setDispensado(true)}>Ok</Botao>
          </div>
        </Aviso>
      </div>
    );

  return (
    <div className="nao-imprime mb-4">
      <Aviso
        tom="alerta"
        titulo={nunca ? "Você ainda não guardou uma cópia fora do computador" : `Faz ${dias} dias sem cópia fora do computador`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            Se o disco queimar ou o computador for roubado, os backups que estão nele vão junto. Ligue um
            pen drive e copie.
          </p>
          <div className="flex gap-2">
            <Botao onClick={() => setDispensado(true)}>Depois</Botao>
            <Botao variante="primario" onClick={() => void copiar()} disabled={fazendo}>
              <HardDriveDownload size={15} /> {fazendo ? "Copiando…" : "Copiar agora"}
            </Botao>
          </div>
        </div>
        {erro && <p className="mt-2 text-negativo">{erro}</p>}
      </Aviso>
    </div>
  );
}
