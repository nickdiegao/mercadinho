/** Roda uma vez, quando o servidor sobe: o banco fica em dia antes da primeira tela. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.BANCO_ARQUIVO) {
    const { migrar } = await import("./lib/servidor/db");
    migrar();
  }
}
