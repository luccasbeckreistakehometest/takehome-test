import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guardClient, isDenied } from "@/lib/guard";
import { aiUsable } from "@/lib/ai-mock";
import { lastRunAt, listQuestions, listRuns, saveQuestions } from "@/lib/ai-visibility-db";
import { cachedSuggestions, latestCompetitors } from "@/lib/ai-visibility";
import { canRun, disclaimer, mockResults, nextRunAt, summarizeRun, whyNotYou, MAX_QUESTIONS, RUN_COST_COINS } from "@/lib/ai-visibility-rules";

type Context = { params: Promise<{ id: string }> };

// Radar de IA do cliente: perguntas, rodadas e quando pode rodar de novo.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const lang = client.language === "en" ? "en" : "pt-BR";
  const last = lastRunAt(id);
  const questions = listQuestions(id);
  const runs = listRuns(id).map((run) => ({ ...run, whyNotYou: whyNotYou(run.summary, lang), disclaimer: disclaimer(run.ranAt, lang) }));
  const available = aiUsable();
  // sem IA: um relatório de EXEMPLO (rotulado) para mostrar o que o radar entrega
  const sampleQuestions = questions.length ? questions : cachedSuggestions(client) ?? [];
  const sample =
    !available && sampleQuestions.length
      ? (() => {
          const results = mockResults(sampleQuestions.slice(0, 5), client.name, latestCompetitors(client));
          const summary = summarizeRun(results, client.name, latestCompetitors(client), lang);
          return { results, summary, whyNotYou: whyNotYou(summary, lang) };
        })()
      : null;
  return NextResponse.json({
    questions,
    suggested: cachedSuggestions(client),
    runs,
    canRun: canRun(last),
    nextRunAt: canRun(last) ? null : nextRunAt(last),
    aiAvailable: available,
    maxQuestions: MAX_QUESTIONS,
    costCoins: RUN_COST_COINS,
    sample,
  });
}

const schema = z.object({ questions: z.array(z.string().max(300)).max(20) });

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Até 10 perguntas." }, { status: 400 });
  return NextResponse.json({ questions: saveQuestions(id, parsed.data.questions, client.language) });
}
