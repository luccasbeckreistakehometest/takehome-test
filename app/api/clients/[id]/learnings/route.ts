import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { GenerationError } from "@/lib/claude";
import { chargeUsage } from "@/lib/billing-db";
import { currentMonth, isValidMonth } from "@/lib/report-aggregate";
import { getReading, learningsHash, loadLearnings, saveReading } from "@/lib/learnings-db";
import { generateLearningsReading } from "@/lib/learnings-ai";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

// O que funciona pra este cliente: números do mês (determinísticos) + a
// leitura de 3 linhas da IA, se já foi gerada para estes mesmos números.
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  if (!getClient(id)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const month = new URL(request.url).searchParams.get("month") ?? currentMonth();
  if (!isValidMonth(month)) return NextResponse.json({ error: "Mês inválido (use AAAA-MM)" }, { status: 400 });
  const learnings = loadLearnings(id, month);
  const saved = getReading(id, month, learningsHash(learnings));
  return NextResponse.json({ learnings, reading: saved?.reading ?? null, readingStale: saved?.stale ?? false });
}

const schema = z.object({ month: z.string().refine(isValidMonth, "Mês inválido (use AAAA-MM)") });

// Gera (ou devolve do cache) a leitura da IA. Sem dados suficientes, não
// chama a IA nem cobra — a tela já diz o que falta.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (auth.role === "client" && !client.selfServe) {
    return NextResponse.json({ error: "Peça a leitura à sua agência." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const { month } = parsed.data;
  const learnings = loadLearnings(id, month);
  if (!learnings.hasEnoughData) {
    return NextResponse.json({ error: "Ainda não há dados suficientes neste mês para uma leitura.", reason: learnings.reason }, { status: 422 });
  }
  const hash = learningsHash(learnings);
  const saved = getReading(id, month, hash);
  if (saved && !saved.stale) return NextResponse.json({ learnings, reading: saved.reading, cached: true });
  const charge = chargeUsage({ accountType: "client", accountId: id, action: "learnings" });
  if (!charge.ok) return NextResponse.json({ error: charge.reason }, { status: 402 });
  try {
    const reading = await generateLearningsReading(client, learnings);
    saveReading(id, month, hash, reading);
    return NextResponse.json({ learnings, reading: { ...reading, createdAt: new Date().toISOString() }, cached: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : "Erro ao gerar a leitura.";
    return NextResponse.json({ error: message }, { status: error instanceof GenerationError ? error.status : 500 });
  }
}
