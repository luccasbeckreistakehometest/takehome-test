// Scheduler interno: um "tick" periódico que faz o trabalho agendado disparar
// SOZINHO — sem alguém clicar "processar". Roda no servidor (iniciado por
// instrumentation.ts). Processa: (1) fila de mensagens em modo API, (2) posts
// agendados cujo horário chegou.

import { db } from "./db";
import { processApiOutbox } from "./messaging/send";
import { tryPublishPost } from "./messaging/publish";
import { logActivity, updateScheduledPost, type ScheduledPost } from "./marketplace-db";

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
        channel: post.channel,
        caption: post.caption,
        mediaUrl: post.mediaUrl ?? null,
      });
      updateScheduledPost(post.id, { status: "published" });
      logActivity({
        audience: "client",
        clientId: post.clientId,
        text: `Post publicado automaticamente: ${post.title}`,
        href: `/agenda`,
      });
      done++;
    } catch {
      // falha de publicação real: deixa na fila para a próxima tentativa
    }
  }
  return done;
}

// Um tick do scheduler. Protegido contra sobreposição.
export async function runSchedulerTick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processApiOutbox().catch(() => {});
    await publishDuePosts().catch(() => {});
  } finally {
    running = false;
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
