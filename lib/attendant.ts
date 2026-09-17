import { getClient } from "./db";
import { logActivity } from "./marketplace-db";
import { enqueueDirect, getConnection, listInboundFrom, type InboundMessage, type SendMode } from "./messaging-db";
import {
  countAutoRepliesToday,
  getAttendant,
  logReply,
  updateReply,
  type AttendantReply,
} from "./attendant-db";
import {
  canAutoReply,
  defaultHandoffMessage,
  evaluateDraft,
  isWithinBusinessHours,
  wantsHuman,
  type AttendantConfig,
} from "./attendant-rules";
import { draftAttendantReply } from "./attendant-ai";
import type { Client } from "./types";
import { chargeUsage, refundUsage } from "./billing-db";
import { runWithAiContext } from "./ai-spend";
import { GenerationError } from "./claude";

// Orquestra o atendente para UMA mensagem recebida: guardrails primeiro,
// IA depois, e o modo do cliente decide se a resposta sai sozinha (auto),
// espera aprovação (rascunho) ou nem existe (desligado). Tudo vira log.

// Por onde a resposta sai: número próprio do cliente (API) > canal da agência.
export function resolveSendMode(cfg: AttendantConfig): { ok: true; mode: SendMode } | { ok: false; reason: "no_channel" } {
  if (cfg.phoneNumberId && cfg.apiToken) return { ok: true, mode: "api" };
  const conn = getConnection("whatsapp");
  if (!conn) return { ok: false, reason: "no_channel" };
  if (conn.mode === "api" && conn.apiToken && conn.apiAccountId) return { ok: true, mode: "api" };
  if (conn.mode === "session" && conn.sessionReady) return { ok: true, mode: "session" };
  return { ok: false, reason: "no_channel" };
}

function sendReply(cfg: AttendantConfig, clientId: string, to: string, body: string): string | null {
  const route = resolveSendMode(cfg);
  if (!route.ok) return null;
  return enqueueDirect({ channel: "whatsapp", mode: route.mode, toAddress: to, body, clientId }).id;
}

function attendantHref(clientId: string): string {
  return `/clients/${clientId}?tab=attendant`;
}

export async function handleInbound(inbound: InboundMessage): Promise<AttendantReply | null> {
  if (!inbound.clientId || inbound.channel !== "whatsapp") return null;
  const cfg = getAttendant(inbound.clientId);
  if (!cfg || cfg.mode === "off") return null;
  const client = getClient(inbound.clientId);
  if (!client) return null;
  const contact = inbound.fromName || inbound.fromAddress;
  const now = new Date();
  const withinHours = isWithinBusinessHours(now, cfg);
  const handoffText = cfg.handoffMessage.trim() || defaultHandoffMessage(client.language, client.name);
  const base = {
    clientId: client.id,
    inboundId: inbound.id,
    contactAddress: inbound.fromAddress,
    contactName: inbound.fromName,
    inboundBody: inbound.body,
    mode: cfg.mode,
    outboxId: null as string | null,
    sentAt: null as string | null,
  };

  // 1) Pediu uma pessoa: nunca passa pela IA.
  if (wantsHuman(inbound.body)) {
    let outboxId: string | null = null;
    if (cfg.mode === "auto" && withinHours) outboxId = sendReply(cfg, client.id, inbound.fromAddress, handoffText);
    const row = logReply({
      ...base,
      status: "handoff",
      reply: outboxId ? handoffText : "",
      intent: "human_request",
      confidence: 1,
      reason: "requested_human",
      outboxId,
      sentAt: outboxId ? now.toISOString() : null,
    });
    logActivity({
      audience: "agency",
      clientId: client.id,
      text: `🙋 ${contact} pediu para falar com uma pessoa (${client.name})`,
      href: attendantHref(client.id),
    });
    return row;
  }

  // 2) Rascunho da IA — pago pela agência (quem opera o atendente); sem
  // coins com cobrança ligada, a mensagem fica para resposta manual.
  const payer = { accountType: "agency" as const, accountId: "agency" };
  const charge = chargeUsage({ ...payer, action: "attendant_reply" });
  if (!charge.ok) {
    const row = logReply({ ...base, status: "skipped", reply: "", intent: "", confidence: 0, reason: "no_coins" });
    logActivity({
      audience: "agency",
      clientId: client.id,
      text: `⚠️ Sem coins para o atendente responder ${contact} (${client.name}) — responda manualmente`,
      href: attendantHref(client.id),
    });
    return row;
  }
  let draft;
  try {
    draft = await runWithAiContext({ action: "attendant_reply", ...payer }, () => draftAttendantReply({
      client: client as Client,
      config: cfg,
      text: inbound.body,
      contactName: inbound.fromName,
      history: listInboundFrom(client.id, inbound.fromAddress, 6)
        .filter((m) => m.id !== inbound.id)
        .reverse()
        .map((m) => ({ body: m.body, receivedAt: m.receivedAt })),
    }));
  } catch (error) {
    refundUsage(payer, "attendant_reply", charge);
    const row = logReply({
      ...base,
      status: "skipped",
      reply: "",
      intent: "",
      confidence: 0,
      reason: `ai_error: ${error instanceof GenerationError ? error.detail.slice(0, 160) || error.message : error instanceof Error ? error.message.slice(0, 160) : "erro"}`,
    });
    logActivity({
      audience: "agency",
      clientId: client.id,
      text: `⚠️ Atendente não conseguiu responder ${contact} (${client.name}) — responda manualmente`,
      href: attendantHref(client.id),
    });
    return row;
  }
  const draftFields = { reply: draft.reply, intent: draft.intent, confidence: draft.confidence };

  // 3) Modo rascunho: a agência aprova antes de sair
  if (cfg.mode === "draft") {
    const row = logReply({ ...base, status: "draft", ...draftFields, reason: "mode_draft" });
    logActivity({
      audience: "agency",
      clientId: client.id,
      text: `✍️ Rascunho de resposta pronto para ${contact} (${client.name})`,
      href: attendantHref(client.id),
    });
    return row;
  }

  // 4) Modo automático: horário, limite diário e veredito sobre o rascunho
  const gate = canAutoReply({
    mode: cfg.mode,
    withinHours,
    autoRepliesToday: countAutoRepliesToday(client.id, inbound.fromAddress, now),
    max: cfg.maxAutoPerContactPerDay,
  });
  if (!gate.ok) {
    const row = logReply({ ...base, status: "draft", ...draftFields, reason: gate.reason });
    logActivity({
      audience: "agency",
      clientId: client.id,
      text: `✍️ Resposta para ${contact} ficou como rascunho (${gate.reason === "outside_hours" ? "fora do horário" : "limite diário"}) — ${client.name}`,
      href: attendantHref(client.id),
    });
    return row;
  }
  const verdict = evaluateDraft(draft, cfg);
  if (verdict.outcome === "send") {
    const outboxId = sendReply(cfg, client.id, inbound.fromAddress, draft.reply);
    if (!outboxId) {
      const row = logReply({ ...base, status: "draft", ...draftFields, reason: "no_channel" });
      logActivity({
        audience: "agency",
        clientId: client.id,
        text: `✍️ Resposta para ${contact} ficou como rascunho: nenhum canal de WhatsApp conectado (${client.name})`,
        href: attendantHref(client.id),
      });
      return row;
    }
    return logReply({ ...base, status: "sent", ...draftFields, reason: "auto", outboxId, sentAt: now.toISOString() });
  }
  if (verdict.outcome === "handoff") {
    const outboxId = sendReply(cfg, client.id, inbound.fromAddress, handoffText);
    const row = logReply({
      ...base,
      status: "handoff",
      ...draftFields,
      reason: verdict.reason,
      outboxId,
      sentAt: outboxId ? now.toISOString() : null,
    });
    logActivity({
      audience: "agency",
      clientId: client.id,
      text: `🙋 ${contact} precisa de uma pessoa (${verdict.reason === "price_or_promise" ? "preço/compromisso" : "a IA pediu ajuda"}) — ${client.name}`,
      href: attendantHref(client.id),
    });
    return row;
  }
  const row = logReply({ ...base, status: "draft", ...draftFields, reason: verdict.reason });
  logActivity({
    audience: "agency",
    clientId: client.id,
    text: `✍️ Resposta para ${contact} precisa de revisão (confiança baixa) — ${client.name}`,
    href: attendantHref(client.id),
  });
  return row;
}

// Agência aprova (e pode editar) um rascunho: sai pela fila e vira "sent".
export function sendDraft(reply: AttendantReply, text: string): { ok: true; reply: AttendantReply } | { ok: false; error: string } {
  const cfg = getAttendant(reply.clientId);
  if (!cfg) return { ok: false, error: "Atendente não configurado" };
  const outboxId = sendReply(cfg, reply.clientId, reply.contactAddress, text);
  if (!outboxId) return { ok: false, error: "Nenhum canal de WhatsApp conectado para enviar." };
  const updated = updateReply(reply.id, { status: "sent", reply: text, outboxId, sentAt: new Date().toISOString(), reason: "approved" });
  return { ok: true, reply: updated! };
}
