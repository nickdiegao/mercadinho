/**
 * O que o programa instalado oferece as telas (electron/preload.cjs). No
 * navegador nada disso existe: as telas perguntam antes de usar.
 */

export interface Eletron {
  versao: () => Promise<string>;
  impressoras: () => Promise<{ nomes: string[]; escolhida: string | null }>;
  definirImpressora: (nome: string | null) => Promise<void>;
  /** Sem impressora escolhida nem i9 instalada, devolve ok falso. */
  imprimirRecibo: (alturaMm: number) => Promise<{ ok: boolean; erro?: string }>;
  abrirPastaBackups: () => Promise<void>;
  /** Pergunta o arquivo, confirma e troca os dados. O programa recarrega sozinho. */
  restaurarBackup: () => Promise<{ ok: boolean; erro?: string }>;
  /** Pergunta a pasta (pen drive) e copia o backup mais recente para la. */
  copiarBackupParaFora: () => Promise<{
    ok: boolean;
    cancelado?: boolean;
    erro?: string;
    pasta?: string;
    arquivo?: string;
    ultimaEm?: string;
  }>;
  /** Quando foi a ultima copia fora do computador, e desde quando ha backups. */
  situacaoCopiaFora: () => Promise<{
    ultimaEm: string | null;
    pasta: string | null;
    primeiroBackupEm: string | null;
  }>;
  /** Procura versao nova e, se houver, baixa. "baixada" espera o botao de instalar. */
  buscarAtualizacao: () => Promise<{
    estado: "atual" | "baixada" | "erro" | "indisponivel" | "ocupado";
    versao?: string;
    erro?: string;
  }>;
  /** Fecha o programa, instala a versao baixada e abre de novo. */
  instalarAtualizacao: () => Promise<{ ok: boolean }>;
  /** Versao ja baixada e esperando instalar, ou null. */
  versaoPronta: () => Promise<string | null>;
  /** Avisa quando uma versao termina de baixar. Devolve a funcao que para de ouvir. */
  aoFicarPronta: (retorno: (versao: string) => void) => () => void;
  /** Porcentagem do download. Devolve a funcao que para de ouvir. */
  aoProgressoDaAtualizacao: (retorno: (porcentagem: number) => void) => () => void;
}

declare global {
  interface Window {
    mercadinho?: Eletron;
  }
}

export const eletron = () => (typeof window === "undefined" ? undefined : window.mercadinho);
