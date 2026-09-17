import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { aiContextFor, aiErrorResponse, beginAi } from "@/lib/metering";
import { aiUsable } from "@/lib/ai-mock";
import { lastRunAt, listQuestions, runCostUsd, saveRun } from "@/lib/ai-visibility-db";
import { latestCompetitors, runRadar } from "@/lib/ai-visibility";
import { canRun, nextRunAt, summarizeRun } from "@/lib/ai-visibility-rules";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 300;

// Uma rodada do radar (12 coins, uma por cliente a cada 7 dias).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const last = lastRunAt(id);
  if (!canRun(last)) {
    const next = nextRunAt(last)!;
    return NextResponse.json(
      { error: `O radar deste cliente roda uma vez por semana. Próxima rodada a partir de ${next.slice(0, 10).split("-").reverse().join("/")}.`, nextRunAt: next },
      { status: 429 }
    );
  }
  const questions = listQuestions(id);
  if (questions.length === 0) return NextResponse.json({ error: "Salve pelo menos uma pergunta antes de rodar." }, { status: 400 });
  if (!aiUsable()) return NextResponse.json({ error: "A IA não está disponível agora." }, { status: 503 });
  const ticket = await beginAi(request, auth, "ai_radar", { agencyId: client.agencyId });
  if (isDenied(ticket)) return ticket;
  const startedAt = new Date().toISOString();
  try {
    const { results, demo } = await ticket.run(() => runRadar(client, questions));
    const ctx = aiContextFor(auth, "ai_radar", client.agencyId);
    const summary = summarizeRun(results, client.name, latestCompetitors(client), client.language === "en" ? "en" : "pt-BR");
    const run = saveRun({ clientId: id, ranAt: new Date().toISOString(), results, summary, costUsd: runCostUsd(ctx.accountType ?? null, ctx.accountId ?? null, startedAt), demo });
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
