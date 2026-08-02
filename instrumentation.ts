// Next.js instrumentation: roda uma vez na inicialização do servidor. Usamos
// para ligar o scheduler interno (fila de mensagens + posts agendados disparam
// sozinhos). Só no runtime Node (better-sqlite3 não roda no edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
