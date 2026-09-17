import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { getReply, updateReply } from "@/lib/attendant-db";
import { sendDraft } from "@/lib/attendant";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["send", "discard"]),
  reply: z.string().trim().max(2000).optional(),
});

// Rascunho do atendente: a agência aprova — podendo editar o texto — ou descarta.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  // O atendente usa o WhatsApp da agência: só ela aprova ou descarta.
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const reply = getReply(id);
  if (!reply) return NextResponse.json({ error: "Resposta não encontrada" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (reply.status !== "draft") {
    return NextResponse.json({ error: "Só rascunhos podem ser enviados ou descartados." }, { status: 409 });
  }
  if (parsed.data.action === "discard") {
    return NextResponse.json({ reply: updateReply(id, { status: "discarded", reason: "discarded" }) });
  }
  const text = (parsed.data.reply ?? reply.reply).trim();
  if (!text) return NextResponse.json({ error: "Escreva a resposta." }, { status: 400 });
  const result = sendDraft(reply, text);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ reply: result.reply });
}
