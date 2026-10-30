// O electron-builder tira todo node_modules de extraResources, e o servidor
// nao roda sem o dele. Por isso a pasta entra aqui, antes de gerar o instalador.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function depoisDeEmpacotar(contexto) {
  const destino = path.join(contexto.appOutDir, "resources", "servidor");
  fs.cpSync(path.join(contexto.packager.projectDir, "servidor"), destino, { recursive: true });
  if (!fs.existsSync(path.join(destino, "node_modules", "next"))) {
    throw new Error("O servidor ficou sem node_modules no pacote.");
  }
};
