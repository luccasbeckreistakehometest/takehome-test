import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { isValidMonth } from "@/lib/report-aggregate";
import { addManualEntry, listEntries, runningTimer, startTimer } from "@/lib/finance-db";

// Apontamentos de horas: lista por cliente/mês, cronômetro (start) e
// lançamento manual. Quem aponta é a agência (o time interno).
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const month = url.searchParams.get("month") ?? undefined;
  if (month && !isValidMonth(month)) return NextResponse.json({ error: "Mês inválido (use AAAA-MM)" }, { status: 400 });
  return NextResponse.json({ entries: listEntries({ clientId, month }), running: runningTimer(auth.userId) });
}

const schema = z.object({
  action: z.enum(["start", "manual"]),
  clientId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  deliverableId: z.string().nullable().optional(),
  professionalId: z.string().nullable().optional(),
  note: z.string().max(300).default(""),
  minutes: z.number().min(1).max(24 * 60).optional(),
  startedAt: z.string().max(30).optional(),
});

export async function POST(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { action, clientId, minutes, startedAt, ...rest } = parsed.data;
  if (!getClient(clientId)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const who = { userId: auth.userId, userName: auth.name };
  if (action === "start") {
    return NextResponse.json({ entry: startTimer({ clientId, ...rest, ...who }) }, { status: 201 });
  }
  if (!minutes) return NextResponse.json({ error: "Informe os minutos" }, { status: 400 });
  return NextResponse.json({ entry: addManualEntry({ clientId, minutes, startedAt, ...rest, ...who }) }, { status: 201 });
}
