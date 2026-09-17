import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { getDeliverable, getProject } from "@/lib/marketplace-db";
import { decideDeliverable, listApprovalEvents } from "@/lib/approvals-db";

type Context = { params: Promise<{ id: string }> };

// Aprovação por entrega. Cliente (só das próprias demandas), agência e admin.
// Aprovar dispara as regras (rascunho de post, WhatsApp/painel) e registra a
// linha do tempo "o que aconteceu quando você aprovou".
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"]);
  if (isDenied(auth)) return auth;
  const deliverable = getDeliverable(id);
  if (!deliverable) return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
  const project = getProject(deliverable.projectId);
  if (auth.role === "client" && project?.clientId !== auth.refId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return NextResponse.json({
    approvalStatus: deliverable.approvalStatus,
    approvedAt: deliverable.approvedAt,
    approvalNote: deliverable.approvalNote,
    events: listApprovalEvents({ deliverableId: id }),
  });
}

const schema = z.object({
  decision: z.enum(["approved", "changes_requested"]),
  note: z.string().trim().max(1000).default(""),
});

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"]);
  if (isDenied(auth)) return auth;
  const deliverable = getDeliverable(id);
  if (!deliverable) return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
  const project = getProject(deliverable.projectId);
  if (auth.role === "client" && project?.clientId !== auth.refId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const result = decideDeliverable({
    deliverableId: id,
    actor: auth.role === "client" ? "client" : "agency",
    decision: parsed.data.decision,
    note: parsed.data.note,
  });
  if (!result) return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
  return NextResponse.json(result, { status: result.alreadyDecided ? 200 : 201 });
}
