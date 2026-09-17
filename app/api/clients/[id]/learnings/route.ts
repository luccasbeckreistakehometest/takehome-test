import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { aiErrorResponse, beginAi } from "@/lib/metering";
import { currentMonth, isValidMonth } from "@/lib/report-aggregate";
import { getReading, learningsHash, loadLearnings, saveReading } from "@/lib/learnings-db";
import { generateLearningsReading } from "@/lib/learnings-ai";
import { clicksByPost } from "@/lib/links-db";
import { clickLearnings } from "@/lib/links-rules";
import { listClientScheduledPosts } from "@/lib/marketplace-db";
import { clientCalibration, listPanelTests } from "@/lib/panel-db";

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
  // cliques dos links rastreáveis por formato e horário (sinal direto)
  const posts = listClientScheduledPosts(id).filter((p) => p.scheduledFor.slice(0, 7) === month);
  const clicks = clickLearnings(posts, clicksByPost(id));
  const panelTests = listPanelTests(id, 1).length;
  return NextResponse.json({ learnings, reading: saved?.reading ?? null, readingStale: saved?.stale ?? false, clicks, panel: panelTests ? { calibration: clientCalibration(id) } : null });
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
  const ticket = await beginAi(request, auth, "learnings");
  if (isDenied(ticket)) return ticket;
  try {
    const reading = await ticket.run(() => generateLearningsReading(client, learnings));
    if (reading.demo && process.env.AI_MOCK !== "1") ticket.refund();
    saveReading(id, month, hash, reading);
    return NextResponse.json({ learnings, reading: { ...reading, createdAt: new Date().toISOString() }, cached: false }, { status: 201 });
  } catch (error) {
    ticket.refund();
    return aiErrorResponse(error);
  }
}
