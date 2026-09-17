import { NextResponse } from "next/server";
import {
  deleteProject,
  getProfessional,
  getProject,
  listApplications,
  listDeliverables,
  listSketches,
  listMeetings,
  listMessages,
  logActivity,
  updateProject,
} from "@/lib/marketplace-db";
import { projectPatchSchema } from "@/lib/validation";
import { decideDeliverable, listApprovalEvents } from "@/lib/approvals-db";
import { getSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  return NextResponse.json({
    ...project,
    professional: project.professionalId
      ? getProfessional(project.professionalId)
      : null,
    messages: listMessages(id),
    deliverables: listDeliverables(id),
    meetings: listMeetings(id),
    applications: listApplications(id),
    sketches: listSketches(id),
    approvals: listApprovalEvents({ projectId: id }),
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = projectPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const before = getProject(id);
  const updated = updateProject(id, parsed.data);
  if (!updated || !before) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  // Aprovar a demanda inteira aprova cada entrega pendente — e cada uma
  // dispara as automações (rascunho de post, aviso) como no portal.
  if (parsed.data.status === "approved" && before.status !== "approved") {
    const session = await getSession();
    const actor = session?.role === "client" ? "client" : "agency";
    for (const deliverable of listDeliverables(id)) {
      if (deliverable.kind !== "reference" && deliverable.approvalStatus !== "approved") {
        decideDeliverable({ deliverableId: deliverable.id, actor, decision: "approved" });
      }
    }
  }
  if (parsed.data.status && parsed.data.status !== before.status) {
    const base = {
      clientId: updated.clientId,
      professionalId: updated.professionalId,
      projectId: id,
      href: `/clients/${updated.clientId}?project=${id}`,
    };
    if (parsed.data.status === "client_approval") {
      logActivity({ audience: "client", ...base, text: `🖼 Entrega da demanda "${updated.title}" aguarda a SUA aprovação`, href: `/portal/client/${updated.clientId}` });
    } else if (parsed.data.status === "approved") {
      logActivity({ audience: "professional", ...base, text: `✅ Sua entrega em "${updated.title}" foi aprovada` });
    } else if (parsed.data.status === "paid") {
      logActivity({ audience: "professional", ...base, text: `💰 Pagamento da demanda "${updated.title}" foi liberado` });
      logActivity({ audience: "client", ...base, text: `✔ Demanda "${updated.title}" concluída`, href: `/portal/client/${updated.clientId}` });
    } else if (parsed.data.status === "in_progress" && before.status === "in_review") {
      logActivity({ audience: "professional", ...base, text: `↩ A entrega de "${updated.title}" voltou para ajustes` });
    }
  }
  if (parsed.data.professionalId && parsed.data.professionalId !== before.professionalId) {
    logActivity({
      audience: "professional",
      professionalId: parsed.data.professionalId,
      clientId: updated.clientId,
      projectId: id,
      text: `⭐ Você foi definido como preferido na demanda "${updated.title}"`,
      href: `/professionals/${parsed.data.professionalId}`,
    });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteProject(id)) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
