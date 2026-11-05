"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/modal";
import { Aviso, Botao } from "@/components/ui";
import { baixarModelo, lerPlanilha } from "@/lib/planilha";
import type { LinhaImportada, ResumoImportacao } from "@/lib/operacoes";
import { useEstado, usePerfil } from "@/lib/store";

/**
 * Botoes "Baixar modelo" e "Importar planilha" da tela de produtos. So a
 * administradora ve: a importacao mexe em preco e custo.
 */
export function ImportarPlanilha() {
  const { estado, importarProdutos } = useEstado();
  const { podeDefinirPreco } = usePerfil();
  const [aberto, setAberto] = useState(false);
  const [lidas, setLidas] = useState<LinhaImportada[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [erro, setErro] = useState("");
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [gravando, setGravando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  if (!podeDefinirPreco) return null;

  function fechar() {
    setAberto(false);
    setLidas(null);
    setNomeArquivo("");
    setErro("");
    setResumo(null);
    setGravando(false);
  }

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro("");
    setResumo(null);
    setLidas(null);
    setNomeArquivo(arquivo.name);
    try {
      setLidas(await lerPlanilha(arquivo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
  }

  async function importar() {
    if (!lidas || gravando) return;
    setGravando(true);
    setErro("");
    try {
      setResumo(await importarProdutos(lidas));
      setLidas(null);
    } catch (e) {
      // o motivo ja apareceu no aviso do sistema; mostra tambem aqui quando vier
      setErro(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <>
      <Botao onClick={() => void baixarModelo(estado.produtos, estado.categorias)} className="w-full sm:w-auto">
        <Download size={15} /> Baixar modelo
      </Botao>
      <Botao onClick={() => setAberto(true)} className="w-full sm:w-auto">
        <FileSpreadsheet size={15} /> Importar planilha
      </Botao>

      <Modal
        aberto={aberto}
        titulo="Importar planilha"
        descricao="Preços, custo e cadastro de produtos vindos do Excel."
        onFechar={fechar}
        rodape={
          resumo ? (
            <Botao variante="primario" onClick={fechar}>
              Pronto
            </Botao>
          ) : (
            <>
              <Botao onClick={fechar}>Cancelar</Botao>
              <Botao variante="primario" onClick={() => void importar()} disabled={!lidas || gravando}>
                {gravando ? "Importando…" : lidas ? `Importar ${lidas.length} linhas` : "Importar"}
              </Botao>
            </>
          )
        }
      >
        {resumo ? (
          <div className="space-y-3 text-sm text-tinta2">
            <Aviso tom="positivo" titulo="Importação concluída">
              {resumo.atualizados} produto{resumo.atualizados === 1 ? "" : "s"} atualizado
              {resumo.atualizados === 1 ? "" : "s"}, {resumo.criados} novo{resumo.criados === 1 ? "" : "s"},{" "}
              {resumo.semMudanca} sem mudança.
            </Aviso>
            {resumo.avisos.length > 0 && (
              <Aviso tom="alerta" titulo="Atenção">
                <ul className="list-disc space-y-1 pl-5">
                  {resumo.avisos.slice(0, 15).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {resumo.avisos.length > 15 && <li>e mais {resumo.avisos.length - 15}…</li>}
                </ul>
              </Aviso>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm text-tinta2">
            <p>
              Use a planilha do botão <b>Baixar modelo</b>: ela já vem com os produtos de hoje. Mude os preços, o
              custo e o que precisar, e escreva produtos novos nas linhas de baixo.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              <li>O produto é reconhecido pelo código ou pelo nome.</li>
              <li>Célula em branco não muda nada.</li>
              <li>O estoque não muda por aqui: ele só muda por entrada ou contagem.</li>
              <li>Custo e preço mudam daqui para frente; vendas já feitas não mudam.</li>
            </ul>
            <input
              ref={entrada}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                void escolher(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Botao onClick={() => entrada.current?.click()}>
              <FileSpreadsheet size={15} /> {nomeArquivo ? "Escolher outro arquivo" : "Escolher a planilha (.xlsx)"}
            </Botao>
            {nomeArquivo && !erro && !lidas && <p className="text-suave">Lendo {nomeArquivo}…</p>}
            {lidas && (
              <Aviso tom="marca" titulo={`${nomeArquivo}: ${lidas.length} linhas lidas`}>
                Confira e clique em Importar. Primeiros produtos:{" "}
                {lidas
                  .slice(0, 4)
                  .map((l) => l.nome)
                  .join(", ")}
                {lidas.length > 4 ? "…" : "."}
              </Aviso>
            )}
            {erro && (
              <Aviso tom="alerta" titulo="Não deu certo">
                {erro}
              </Aviso>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
