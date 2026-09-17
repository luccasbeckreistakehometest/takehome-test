import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { clientPulseView, notifyOnBadPulse, recordPulse } from "@/lib/pulse-db";

type Context = { params: Promise<{ id: string }> };

// Pulso do cliente: GET = o que perguntar agora + histórico/tendência/risco;
// POST = uma resposta (o cliente no portal; a agência pode registrar por ele).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json({ ...clientPulseView(id, client.createdAt), agencyName: getSettings().agencyName });
}

const schema = z.object({
  kind: z.enum(["approval", "monthly", "nps"]),
  score: z.number().int(),
  comment: z.string().max(600).default(""),
  context: z.string().max(80).default(""),
});

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const result = recordPulse({ clientId: id, ...parsed.data, userId: auth.userId });
  if (!result.ok) {
    const status = result.reason === "duplicate" ? 409 : 400;
    const messages = {
      duplicate: "Esta pergunta já foi respondida.",
      invalid_score: "Nota fora da escala.",
      unknown_context: "Entrega não encontrada ou ainda não aprovada.",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status });
  }
  notifyOnBadPulse(result.pulse, client.name);
  return NextResponse.json({ pulse: result.pulse, ...clientPulseView(id, client.createdAt) }, { status: 201 });
}
