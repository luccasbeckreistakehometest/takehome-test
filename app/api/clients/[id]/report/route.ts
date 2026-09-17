import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { GenerationError } from "@/lib/claude";
import { chargeUsage } from "@/lib/billing-db";
import { createJob, finishJob, logActivity } from "@/lib/marketplace-db";
import { currentMonth, isValidMonth } from "@/lib/report-aggregate";
import { buildMonthData, getMonthlyReport, listMonthlyReports, saveMonthlyReport } from "@/lib/reports-db";
import { generateReportSummary } from "@/lib/report-ai";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

// Relatório mensal em 1 clique. GET devolve os números ao vivo do mês pedido
// (+ o resumo salvo, se houver); POST gera o resumo executivo com IA e salva.
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const month = new URL(request.url).searchParams.get("month") ?? currentMonth();
  if (!isValidMonth(month)) return NextResponse.json({ error: "Mês inválido (use AAAA-MM)" }, { status: 400 });
  const saved = getMonthlyReport(id, month);
  return NextResponse.json({
    client: { id: client.id, name: client.name, language: client.language },
    month,
    data: buildMonthData(id, month),
    report: saved,
    history: listMonthlyReports(id),
  });
}

const bodySchema = z.object({ month: z.string().refine(isValidMonth, "Mês inválido (use AAAA-MM)") });

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  // Marca gerenciada por agência só lê; a autônoma gera o próprio relatório.
  if (auth.role === "client" && !client.selfServe) {
    return NextResponse.json({ error: "Peça o relatório à sua agência." }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const charge = chargeUsage({ accountType: "client", accountId: id, action: "monthly_report" });
  if (!charge.ok) return NextResponse.json({ error: charge.reason }, { status: 402 });

  const { month } = parsed.data;
  const data = buildMonthData(id, month);
  const job = createJob({ kind: "monthly_report", label: `Relatório mensal ${month} — ${client.name}`, clientId: id });
  try {
    const summary = await generateReportSummary(client, data);
    const report = saveMonthlyReport({ clientId: id, month, lang: client.language, data, summary });
    finishJob(job.id, "done");
    logActivity({
      audience: "client",
      clientId: id,
      text: `📊 Relatório mensal de ${month} pronto`,
      href: `/portal/client/${id}/report?month=${month}`,
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : "Erro ao gerar o relatório.";
    finishJob(job.id, "error", message);
    return NextResponse.json({ error: message }, { status: error instanceof GenerationError ? error.status : 500 });
  }
}
