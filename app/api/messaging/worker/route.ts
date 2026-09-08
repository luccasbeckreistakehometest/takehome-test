import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkerStatus, startWorker, stopWorker } from "@/lib/messaging/worker-manager";
import { enqueueDirect, getConnection } from "@/lib/messaging-db";

export async function GET() {
  return NextResponse.json(getWorkerStatus());
}

const schema = z.object({
  action: z.enum(["start", "stop", "test"]),
  channel: z.enum(["whatsapp", "instagram"]).default("whatsapp"),
  testPhone: z.string().trim().default(""),
  testMessage: z.string().trim().default("Mensagem de teste do Marqa ✅"),
});

// Controla o worker de sessão por botão (sem terminal):
// - start: abre o navegador para login e passa a drenar a fila
// - stop: encerra o worker
// - test: enfileira uma mensagem de teste para o worker enviar já
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { action, channel, testPhone, testMessage } = parsed.data;

  if (channel === "instagram") {
    return NextResponse.json(
      { error: "Instagram não tem modo sessão — use a API oficial em Conexões." },
      { status: 400 }
    );
  }

  if (action === "start") {
    return NextResponse.json(startWorker(channel));
  }
  if (action === "stop") {
    return NextResponse.json(stopWorker());
  }
  // test: garante que o canal está em modo sessão e enfileira uma mensagem
  if (!testPhone) {
    return NextResponse.json({ error: "Informe um número (com DDI) para o teste." }, { status: 400 });
  }
  const conn = getConnection("whatsapp");
  if (!conn || conn.mode !== "session") {
    return NextResponse.json(
      { error: "Salve a conexão do WhatsApp no modo 'sessão' antes de testar." },
      { status: 400 }
    );
  }
  const msg = enqueueDirect({
    channel: "whatsapp",
    mode: "session",
    toAddress: testPhone,
    body: testMessage,
  });
  return NextResponse.json({ ok: true, enqueued: 1, id: msg.id });
}
