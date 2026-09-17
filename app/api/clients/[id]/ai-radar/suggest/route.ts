import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { cachedSuggestions, suggestQuestions } from "@/lib/ai-visibility";
import { aiUsable } from "@/lib/ai-mock";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

// Sugere 8 perguntas de compra (1 coin; mesmo briefing = cache, sem custo).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const cached = cachedSuggestions(client);
  if (cached) return NextResponse.json({ questions: cached, charged: false });
  if (!aiUsable()) return NextResponse.json({ error: "A IA não está disponível agora. Escreva as perguntas." }, { status: 503 });
  const ticket = await beginAi(request, auth, "ai_radar_questions", { agencyId: client.agencyId });
  if (isDenied(ticket)) return ticket;
  try {
    const questions = await ticket.run(() => suggestQuestions(client));
    return NextResponse.json({ questions, charged: true });
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
