// A unica ponte entre as telas e o programa. O formato esta em lib/eletron.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mercadinho", {
  versao: () => ipcRenderer.invoke("versao"),
  impressoras: () => ipcRenderer.invoke("impressoras"),
  definirImpressora: (nome) => ipcRenderer.invoke("impressora:definir", nome),
  imprimirRecibo: (alturaMm) => ipcRenderer.invoke("recibo:imprimir", alturaMm),
  abrirPastaBackups: () => ipcRenderer.invoke("backups:abrir"),
  restaurarBackup: () => ipcRenderer.invoke("backups:restaurar"),
});
