import { NextResponse } from "next/server";
import { z } from "zod";
import { clientAgencyId, getClient } from "@/lib/db";
import { getDeliverable, getProfessional, getProject, professionalWorkedWith } from "@/lib/marketplace-db";
import { guard, isDenied, tenantOf } from "@/lib/guard";
import { isValidMonth } from "@/lib/report-aggregate";
import { addManualEntry, listEntries, runningTimer, startTimer } from "@/lib/finance-db";

// Apontamentos de horas: lista por cliente/mês, cronômetro (start) e
// lançamento manual. Quem aponta é a agência (o time interno).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const auth = await guard(["agency", "admin"], clientId ? { clientId } : {});
  if (isDenied(auth)) return auth;
  const month = url.searchParams.get("month") ?? undefined;
  if (month && !isValidMonth(month)) return NextResponse.json({ error: "Mês inválido (use AAAA-MM)" }, { status: 400 });
  return NextResponse.json({ entries: listEntries({ scope: tenantOf(auth, request), clientId, month }), running: runningTimer(auth.userId) });
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

// Demanda/entrega/profissional apontados precisam ser da mesma marca/agência.
function foreignRefs(
  clientId: string,
  refs: { projectId?: string | null; deliverableId?: string | null; professionalId?: string | null }
): string | null {
  const agencyId = clientAgencyId(clientId);
  if (refs.projectId) {
    const project = getProject(refs.projectId);
    if (!project || project.clientId !== clientId) return "Demanda não encontrada";
  }
  if (refs.deliverableId) {
    const deliverable = getDeliverable(refs.deliverableId);
    const project = deliverable ? getProject(deliverable.projectId) : null;
    if (!project || project.clientId !== clientId) return "Entrega não encontrada";
  }
  if (refs.professionalId) {
    const professional = getProfessional(refs.professionalId);
    const visible =
      professional &&
      (professional.agencyId === null ||
        professional.agencyId === agencyId ||
        professionalWorkedWith(professional.id, agencyId ?? ""));
    if (!visible) return "Profissional não encontrado";
  }
  return null;
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { action, clientId, minutes, startedAt, ...rest } = parsed.data;
  const auth = await guard(["agency", "admin"], { clientId });
  if (isDenied(auth)) return auth;
  if (!getClient(clientId)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const foreign = foreignRefs(clientId, rest);
  if (foreign) return NextResponse.json({ error: foreign }, { status: 404 });
  const who = { userId: auth.userId, userName: auth.name };
  if (action === "start") {
    return NextResponse.json({ entry: startTimer({ clientId, ...rest, ...who }) }, { status: 201 });
  }
  if (!minutes) return NextResponse.json({ error: "Informe os minutos" }, { status: 400 });
  return NextResponse.json({ entry: addManualEntry({ clientId, minutes, startedAt, ...rest, ...who }) }, { status: 201 });
}
