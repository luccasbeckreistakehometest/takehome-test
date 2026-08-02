import {
  dueOutbox,
  getConnection,
  updateOutboxStatus,
  type MessageChannel,
  type OutboxMessage,
} from "../messaging-db";

// Envio por API OFICIAL das plataformas (o caminho suportado e estável):
// - WhatsApp Cloud API (graph.facebook.com/{phoneNumberId}/messages)
// - Instagram Messaging via Graph (graph.facebook.com/{igId}/messages)
// Requer que a agência configure token + id da conta em Conexões.
//
// O modo "session" (Playwright na sessão logada do usuário) NÃO envia por
// aqui: as mensagens ficam na fila e um worker local as drena. Isso mantém o
// navegador fora do processo do servidor e deixa claro que é a conta própria.

const GRAPH = "https://graph.facebook.com/v21.0";

async function sendWhatsAppApi(
  to: string,
  body: string,
  token: string,
  phoneNumberId: string
): Promise<void> {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`WhatsApp API ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function sendInstagramApi(
  to: string,
  body: string,
  token: string,
  igId: string
): Promise<void> {
  const res = await fetch(`${GRAPH}/${igId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: to },
      message: { text: body },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Instagram API ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function sendApi(msg: OutboxMessage): Promise<void> {
  const conn = getConnection(msg.channel);
  if (!conn || !conn.apiToken || !conn.apiAccountId) {
    throw new Error(
      `Canal ${msg.channel} sem credenciais de API. Configure em Mensagens → Conexões.`
    );
  }
  if (msg.channel === "whatsapp") {
    await sendWhatsAppApi(msg.toAddress, msg.body, conn.apiToken, conn.apiAccountId);
  } else {
    await sendInstagramApi(msg.toAddress, msg.body, conn.apiToken, conn.apiAccountId);
  }
}

// Drena a fila de mensagens em modo API cujo horário chegou. Retorna um resumo
// para a UI. Mensagens em modo "session" são deixadas para o worker Playwright.
export async function processApiOutbox(channel?: MessageChannel): Promise<{
  sent: number;
  failed: number;
  skippedSession: number;
}> {
  const due = dueOutbox(channel);
  let sent = 0;
  let failed = 0;
  let skippedSession = 0;
  for (const msg of due) {
    if (msg.mode === "session") {
      skippedSession++;
      continue; // worker externo cuida disso
    }
    updateOutboxStatus(msg.id, "sending");
    try {
      await sendApi(msg);
      updateOutboxStatus(msg.id, "sent");
      sent++;
      // Pacing educado: evita rate-limit/flag por rajada
      await new Promise((r) => setTimeout(r, 800));
    } catch (error) {
      updateOutboxStatus(
        msg.id,
        "failed",
        error instanceof Error ? error.message : "erro no envio"
      );
      failed++;
    }
  }
  return { sent, failed, skippedSession };
}

// Fallback que sempre funciona sem credenciais: link click-to-chat do WhatsApp.
export function waMeLink(phone: string, body: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}`;
}
