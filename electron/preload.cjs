// A unica ponte entre as telas e o programa. O formato esta em lib/eletron.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mercadinho", {
  versao: () => ipcRenderer.invoke("versao"),
  impressoras: () => ipcRenderer.invoke("impressoras"),
  definirImpressora: (nome) => ipcRenderer.invoke("impressora:definir", nome),
  imprimirRecibo: (alturaMm) => ipcRenderer.invoke("recibo:imprimir", alturaMm),
  abrirPastaBackups: () => ipcRenderer.invoke("backups:abrir"),
  restaurarBackup: () => ipcRenderer.invoke("backups:restaurar"),
  copiarBackupParaFora: () => ipcRenderer.invoke("backups:copiar-fora"),
  situacaoCopiaFora: () => ipcRenderer.invoke("backups:situacao-fora"),
  buscarAtualizacao: () => ipcRenderer.invoke("atualizacao:buscar"),
  instalarAtualizacao: () => ipcRenderer.invoke("atualizacao:instalar"),
  versaoPronta: () => ipcRenderer.invoke("atualizacao:situacao"),
  aoFicarPronta: (retorno) => {
    const ouvinte = (_ev, versao) => retorno(versao);
    ipcRenderer.on("atualizacao:pronta", ouvinte);
    return () => ipcRenderer.removeListener("atualizacao:pronta", ouvinte);
  },
  aoProgressoDaAtualizacao: (retorno) => {
    const ouvinte = (_ev, pct) => retorno(pct);
    ipcRenderer.on("atualizacao:progresso", ouvinte);
    return () => ipcRenderer.removeListener("atualizacao:progresso", ouvinte);
  },
});
