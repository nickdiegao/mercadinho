"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Aviso, Botao } from "@/components/ui";
import { eletron } from "@/lib/eletron";
import { usePerfil } from "@/lib/store";

/**
 * Faixa no alto do sistema quando uma versao nova ja foi baixada. So a
 * administracao ve: instalar fecha o programa, e nao pode pegar o caixa no
 * meio de uma venda.
 */
export function AvisoAtualizacao() {
  const { ehAdmin } = usePerfil();
  const programa = eletron();
  const [versao, setVersao] = useState<string | null>(null);
  const [dispensado, setDispensado] = useState(false);
  const [instalando, setInstalando] = useState(false);

  useEffect(() => {
    if (!programa) return;
    void programa.versaoPronta().then(setVersao);
    return programa.aoFicarPronta(setVersao);
  }, [programa]);

  if (!programa || !ehAdmin || !versao || dispensado) return null;

  return (
    <div className="nao-imprime mb-4">
      <Aviso tom="positivo" titulo={`A versão ${versao} está pronta para instalar`}>
        {instalando ? (
          <p>Fechando o sistema e instalando. Uma janela de progresso vai aparecer; o sistema abre sozinho ao terminar. Não desligue o computador.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>Os seus dados ficam como estão. Instale quando não houver venda em andamento.</p>
            <div className="flex gap-2">
              <Botao onClick={() => setDispensado(true)}>Depois</Botao>
              <Botao
                variante="primario"
                onClick={() => {
                  setInstalando(true);
                  void programa.instalarAtualizacao();
                }}
              >
                <RefreshCw size={15} /> Instalar agora
              </Botao>
            </div>
          </div>
        )}
      </Aviso>
    </div>
  );
}
