// Scheduler interno: um "tick" periódico que faz o trabalho agendado disparar
// SOZINHO — sem alguém clicar "processar". Roda no servidor (iniciado por
// instrumentation.ts). Processa: (1) fila de mensagens em modo API, (2) posts
// agendados cujo horário chegou.

import { db } from "./db";
import { processApiOutbox } from "./messaging/send";
import { tryPublishPost } from "./messaging/publish";
import { logActivity, postMedia, updateScheduledPost, type ScheduledPost } from "./marketplace-db";
import { refreshAllAccounts } from "./billing-db";
import { purgeAuthEvents } from "./auth";
import { purgeOldInbox } from "./contact-db";
import { purgeOldAiErrors } from "./ai-spend";
import { runMonthlyInvoiceDrafts } from "./invoices-db";
import { runSubscriptionNotices } from "./subscription-notices";
import { pruneEvents } from "./analytics-db";

let running = false;

async function publishDuePosts(): Promise<number> {
  const nowIso = new Date().toISOString();
  const due = db
    .prepare(
      "SELECT * FROM scheduled_posts WHERE status = 'scheduled' AND scheduledFor <= ? ORDER BY scheduledFor ASC LIMIT 20"
    )
    .all(nowIso) as (Omit<ScheduledPost, "hashtags"> & { hashtags: string; mediaUrl?: string })[];
  let done = 0;
  for (const post of due) {
    try {
      await tryPublishPost({
        agencyId: post.agencyId,
        channel: post.channel,
        caption: post.caption,
        mediaUrl: post.mediaUrl ?? null,
        mediaUrls: postMedia(post),
      });
      updateScheduledPost(post.id, { status: "published" });
      logActivity({
        audience: "client",
        agencyId: post.agencyId,
        clientId: post.clientId,
        text: `Post publicado automaticamente: ${post.title}`,
        href: `/agenda`,
      });
      done++;
    } catch (error) {
      // falha de publicação real: deixa na fila para a próxima tentativa
      console.error(`[scheduler] post ${post.id} não publicado:`, error instanceof Error ? error.message : error);
    }
  }
  return done;
}

// Um tick do scheduler. Protegido contra sobreposição.
export async function runSchedulerTick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processApiOutbox().catch((error) => console.error("[scheduler] fila de mensagens:", error));
    await publishDuePosts().catch((error) => console.error("[scheduler] posts agendados:", error));
    runHousekeeping();
  } finally {
    running = false;
  }
}

// Uma vez por hora: planos (expiração/recarga) e retenção de registros.
let lastHousekeeping = 0;
function runHousekeeping(now = Date.now()): void {
  if (now - lastHousekeeping < 60 * 60_000) return;
  lastHousekeeping = now;
  try {
    refreshAllAccounts();
    purgeAuthEvents();
    purgeOldInbox();
    purgeOldAiErrors();
  } catch (error) {
    console.error("[scheduler] manutenção falhou:", error);
  }
  try {
    const drafts = runMonthlyInvoiceDrafts();
    if (drafts > 0) console.log(`[scheduler] ${drafts} rascunho(s) de fatura criados`);
    runSubscriptionNotices();
    pruneEvents();
  } catch (error) {
    console.error("[scheduler] manutenção falhou:", error);
  }
}

// Inicia o loop (singleton — sobrevive a HMR guardando no globalThis).
export function startScheduler(): void {
  const g = globalThis as unknown as { __agencyhubScheduler?: boolean };
  if (g.__agencyhubScheduler) return;
  g.__agencyhubScheduler = true;
  setInterval(() => {
    void runSchedulerTick();
  }, 60_000);
}
