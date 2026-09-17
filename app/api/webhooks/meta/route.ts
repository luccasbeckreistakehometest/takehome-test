import { NextResponse } from "next/server";
import { saveInbound } from "@/lib/messaging-db";
import { findClientByPhoneNumberId } from "@/lib/attendant-db";
import { handleInbound } from "@/lib/attendant";

// Webhook da Meta (WhatsApp Cloud / Instagram / Messenger). Recebe mensagens
// que os contatos ENVIAM de volta e as guarda na plataforma (inbox).
// Configure na Meta: Callback URL = <sua-url>/api/webhooks/meta, Verify Token
// = o valor abaixo. (Em produção mova para variável de ambiente.)
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "agencyhub-verify";

// Handshake de verificação da Meta.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verificação falhou" }, { status: 403 });
}

// Recebe eventos. Parseia os dois formatos comuns (WhatsApp Cloud e IG/Messenger).
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: true });
  try {
    for (const entry of payload.entry ?? []) {
      // WhatsApp Cloud: entry.changes[].value.messages[]
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const contacts = value.contacts ?? [];
        // Número que recebeu: se for o número próprio de um cliente (atendente
        // por cliente), a mensagem entra na conta dele e o atendente responde.
        const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
        const clientId = findClientByPhoneNumberId(phoneNumberId);
        for (const m of value.messages ?? []) {
          const inbound = saveInbound({
            channel: "whatsapp",
            fromAddress: m.from ?? "",
            fromName: contacts[0]?.profile?.name ?? "",
            body: m.text?.body ?? m.button?.text ?? "[mídia]",
            clientId,
            phoneNumberId,
          });
          if (clientId) await handleInbound(inbound).catch(() => null);
        }
      }
      // Instagram / Messenger: entry.messaging[]
      for (const evt of entry.messaging ?? []) {
        if (evt.message?.text) {
          saveInbound({
            channel: "instagram",
            fromAddress: evt.sender?.id ?? "",
            body: evt.message.text,
          });
        }
      }
    }
  } catch {
    // nunca falha o webhook (a Meta re-tenta e pode desativar em caso de erro)
  }
  return NextResponse.json({ ok: true });
}
