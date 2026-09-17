import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { saveInbound } from "@/lib/messaging-db";
import { handleInbound } from "@/lib/attendant";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  fromAddress: z.string().trim().min(3).max(32),
  fromName: z.string().trim().max(80).default(""),
  body: z.string().trim().min(1).max(2000),
});

// Simula uma mensagem recebida no número do cliente e roda o atendente —
// é o "Testar o atendente" da UI (e o caminho dos testes). Em produção as
// mensagens reais chegam pelo webhook da Meta e seguem o mesmo fluxo.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const inbound = saveInbound({
    agencyId: client.agencyId,
    channel: "whatsapp",
    fromAddress: parsed.data.fromAddress.replace(/\D/g, "") || parsed.data.fromAddress,
    fromName: parsed.data.fromName,
    body: parsed.data.body,
    clientId: id,
  });
  const reply = await handleInbound(inbound);
  return NextResponse.json({ inbound, reply }, { status: 201 });
}
