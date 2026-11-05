/** Roda uma vez, quando o servidor sobe: o banco fica em dia antes da primeira tela. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.BANCO_ARQUIVO) {
    const { migrar, temMigracaoPendente } = await import("./lib/servidor/db");
    const { agendarBackups, fazerBackup } = await import("./lib/servidor/backup");
    // versao nova que muda as tabelas: guarda como estava antes de mexer
    if (process.env.BACKUP_PASTA && temMigracaoPendente()) await fazerBackup("antes-da-atualizacao");
    migrar();
    // banco criado antes do catalogo inicial (versoes 0.1.0 a 0.1.2): carrega uma vez
    const { carregarCatalogoSeVazio } = await import("./lib/servidor/contas");
    carregarCatalogoSeVazio();
    agendarBackups();
  }
}
