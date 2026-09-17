import { NextResponse } from "next/server";
import { z } from "zod";
import { guardDeliverable, isDenied } from "@/lib/guard";
import { decideDeliverable, listApprovalEvents } from "@/lib/approvals-db";

type Context = { params: Promise<{ id: string }> };

// Aprovação por entrega. Cliente (só das próprias demandas), agência e admin.
// Aprovar dispara as regras (rascunho de post, WhatsApp/painel) e registra a
// linha do tempo "o que aconteceu quando você aprovou". A entrega precisa ser
// da marca (cliente) ou da agência da sessão.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const guarded = await guardDeliverable(id, "view");
  if (isDenied(guarded)) return guarded;
  const { deliverable } = guarded;
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
  const guarded = await guardDeliverable(id, "portal");
  if (isDenied(guarded)) return guarded;
  const auth = guarded.session;
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
