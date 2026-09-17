import { NextResponse } from "next/server";
import { z } from "zod";
import {
  enqueueMessages,
  getBroadcastList,
  getConnection,
  listOutbox,
} from "@/lib/messaging-db";
import { agencyOnly, isDenied } from "@/lib/guard";

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json({ outbox: listOutbox() });
}

const schema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  body: z.string().trim().min(1, "Escreva a mensagem"),
  contactIds: z.array(z.string()).default([]),
  listId: z.string().nullable().default(null),
  scheduledFor: z.string().nullable().default(null),
});

// Enfileira mensagem individual (contactIds) ou transmissão (listId).
export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { channel, body, listId, scheduledFor } = parsed.data;
  let contactIds = parsed.data.contactIds;
  if (listId) {
    const list = getBroadcastList(listId);
    if (!list) return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });
    contactIds = list.contactIds;
  }
  if (contactIds.length === 0) {
    return NextResponse.json({ error: "Nenhum destinatário selecionado." }, { status: 400 });
  }
  // Modo herda da conexão do canal (API se configurada, senão sessão própria)
  const conn = getConnection(channel);
  const mode = conn?.mode ?? "session";
  const created = enqueueMessages({ channel, mode, body, contactIds, listId, scheduledFor });
  if (created.length === 0) {
    return NextResponse.json(
      { error: `Nenhum contato tem endereço de ${channel === "whatsapp" ? "WhatsApp" : "Instagram"}.` },
      { status: 400 }
    );
  }
  return NextResponse.json({ enqueued: created.length, mode }, { status: 201 });
}
