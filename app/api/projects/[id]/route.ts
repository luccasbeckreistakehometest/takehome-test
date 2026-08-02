import { NextResponse } from "next/server";
import {
  deleteProject,
  getProfessional,
  getProject,
  listApplications,
  listDeliverables,
  listMeetings,
  listMessages,
  updateProject,
} from "@/lib/marketplace-db";
import { projectPatchSchema } from "@/lib/validation";

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
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = projectPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const updated = updateProject(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
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
