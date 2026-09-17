import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { currentMonth, isValidMonth } from "@/lib/report-aggregate";
import { clientMonthMargin, getClientFee, getFinanceSettings, listEntries, listProfessionalRates, runningTimer, setClientFee } from "@/lib/finance-db";
import { listClientProjects, listDeliverables } from "@/lib/marketplace-db";
import { agencyScope } from "@/lib/tenancy-rules";

type Context = { params: Promise<{ id: string }> };

// Aba "Horas" do cliente: fee, apontamentos do mês, margem e o que existe
// para apontar (demandas/entregas, profissionais).
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const month = new URL(request.url).searchParams.get("month") ?? currentMonth();
  if (!isValidMonth(month)) return NextResponse.json({ error: "Mês inválido (use AAAA-MM)" }, { status: 400 });
  const projects = listClientProjects(id).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    deliverables: listDeliverables(p.id)
      .filter((d) => d.kind === "delivery")
      .map((d) => ({ id: d.id, title: d.title })),
  }));
  return NextResponse.json({
    month,
    fee: getClientFee(id),
    settings: getFinanceSettings(client.agencyId),
    margin: clientMonthMargin(id, client.name, month),
    entries: listEntries({ scope: agencyScope(client.agencyId), clientId: id, month }),
    running: runningTimer(auth.userId),
    projects,
    professionals: listProfessionalRates(agencyScope(client.agencyId)),
  });
}

const schema = z.object({ monthlyFee: z.number().min(0) });

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin"], { clientId: id });
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (!setClientFee(id, parsed.data.monthlyFee)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json({ fee: getClientFee(id) });
}
