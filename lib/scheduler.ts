// Scheduler interno: um "tick" periódico que faz o trabalho agendado disparar
// SOZINHO — sem alguém clicar "processar". Roda no servidor (iniciado por
// instrumentation.ts). Processa: (1) fila de mensagens em modo API, (2) posts
// agendados cujo horário chegou.

import { db } from "./db";
import { processApiOutbox } from "./messaging/send";
import { tryPublishPost } from "./messaging/publish";
import { logActivity, postMedia, recordPublishFailure, updateScheduledPost, type ScheduledPost } from "./marketplace-db";
import { refreshPostCarouselMedia } from "./carousel-media";
import { refreshAllAccounts } from "./billing-db";
import { purgeAuthEvents } from "./auth";
import { purgeOldInbox } from "./contact-db";
import { purgeOldAiErrors } from "./ai-spend";
import { runMonthlyInvoiceDrafts } from "./invoices-db";
import { runSubscriptionNotices } from "./subscription-notices";
import { pruneEvents } from "./analytics-db";
import { cancelRetiredPreapprovals } from "./subscription-sync";

let running = false;

// Depois de tantas falhas seguidas o agendador desiste do post e o
// calendário mostra o motivo; mexer no post (data, status) zera a contagem.
export const MAX_PUBLISH_ATTEMPTS = 5;

// Posts que o agendador pode publicar agora. Post esperando o cliente
// (link de aprovação aberto) ou com ajuste pedido NÃO sai: nada vai ao ar
// sem o cliente concordar — a agência pode liberar pelo calendário.
export function duePosts(nowIso: string = new Date().toISOString(), limit = 20) {
  return db
    .prepare(
      `SELECT * FROM scheduled_posts
       WHERE status = 'scheduled' AND scheduledFor <= ?
         AND clientApproval NOT IN ('pending', 'changes_requested')
         AND publishAttempts < ?
       ORDER BY scheduledFor ASC LIMIT ?`
    )
    .all(nowIso, MAX_PUBLISH_ATTEMPTS, limit) as (Omit<ScheduledPost, "hashtags"> & { hashtags: string; mediaUrl?: string })[];
}

export async function publishDuePosts(nowIso: string = new Date().toISOString()): Promise<number> {
  const due = duePosts(nowIso);
  let done = 0;
  for (const post of due) {
    try {
      // carrossel: endereços da versão atual dos slides (a marca pode ter mudado)
      const carouselUrls = refreshPostCarouselMedia(post.id);
      await tryPublishPost({
        agencyId: post.agencyId,
        channel: post.channel,
        caption: post.caption,
        mediaUrl: post.mediaUrl ?? null,
        mediaUrls: carouselUrls ?? postMedia(post),
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
      // falha de publicação real: tenta de novo nos próximos ticks, até o limite
      const message = error instanceof Error ? error.message : String(error);
      recordPublishFailure(post.id, message);
      console.error(`[scheduler] post ${post.id} não publicado (tentativa ${Number(post.publishAttempts ?? 0) + 1}):`, message);
      if (Number(post.publishAttempts ?? 0) + 1 >= MAX_PUBLISH_ATTEMPTS) {
        logActivity({
          audience: "agency",
          agencyId: post.agencyId,
          clientId: post.clientId,
          text: `Não conseguimos publicar "${post.title}": ${message.slice(0, 120)}. Confira a conexão e reagende.`,
          href: `/calendar`,
        });
      }
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
    void cancelRetiredPreapprovals().catch((error) => console.error("[scheduler] assinaturas aposentadas:", error));
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
