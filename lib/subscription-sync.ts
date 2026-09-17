import { markPreapprovalCancelled, preapprovalsToCancel, supersedeStalePendingPreapprovals } from "./billing-db";
import { cancelRecurring, subscriptionsAvailable } from "./mercadopago";
import { MpError } from "./mp-transport";

// Cancela no Mercado Pago as autorizações que a Marqa aposentou (assinatura
// nova da mesma conta, cancelamento, estorno, pendente esquecida). Assim uma
// conta nunca fica com duas cobranças no cartão. Chamado depois de cada
// mudança de assinatura e no tick de hora em hora; falha tenta de novo depois.
let running: Promise<number> | null = null;

export function cancelRetiredPreapprovals(): Promise<number> {
  if (running) return running;
  running = (async () => {
    if (!subscriptionsAvailable()) return 0;
    supersedeStalePendingPreapprovals();
    let cancelled = 0;
    for (const row of preapprovalsToCancel()) {
      try {
        await cancelRecurring(row.id);
        markPreapprovalCancelled(row.id);
        cancelled++;
      } catch (error) {
        // já não existe no MP: nada mais a cancelar
        if (error instanceof MpError && error.status === 404) {
          markPreapprovalCancelled(row.id);
          continue;
        }
        console.error(`[mp] cancelar a autorização ${row.id} falhou:`, error instanceof Error ? error.message : error);
      }
    }
    return cancelled;
  })().finally(() => {
    running = null;
  });
  return running;
}
