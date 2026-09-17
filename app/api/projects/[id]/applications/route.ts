import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createApplication,
  getProfessional,
  getProject,
  listApplications,
  logActivity,
  professionalWorkedWith,
} from "@/lib/marketplace-db";
import { guard, guardProject, isDenied } from "@/lib/guard";
import { agencyScope, professionalVisibleTo } from "@/lib/tenancy-rules";

type Context = { params: Promise<{ id: string }> };

const applySchema = z.object({
  professionalId: z.string().min(1).optional(),
  message: z.string().trim().max(2000).default(""),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "workspace");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listApplications(id));
}

// Profissional se candidata a uma demanda aberta
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "professional"]);
  if (isDenied(auth)) return auth;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  // Agência só registra candidatura em demanda dela.
  if (auth.role === "agency" && auth.agencyId !== project.agencyId) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  // Profissional: marketplace aberto de qualquer agência; demanda interna só
  // para o time da própria agência.
  if (auth.role === "professional" && project.mode === "internal" && auth.agencyId !== project.agencyId) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  if (project.status !== "open") {
    return NextResponse.json(
      { error: "Esta demanda não está mais aberta a candidaturas" },
      { status: 400 }
    );
  }
  const parsed = applySchema.safeParse(await request.json().catch(() => null));
  // O profissional só se candidata por si mesmo.
  const professionalId = auth.role === "professional" ? auth.refId : parsed.data?.professionalId;
  const candidate = professionalId ? getProfessional(professionalId) : null;
  if (!parsed.success || !professionalId || !candidate) {
    return NextResponse.json({ error: "Candidatura inválida" }, { status: 400 });
  }
  if (
    auth.role !== "professional" &&
    !professionalVisibleTo(agencyScope(project.agencyId), candidate, professionalWorkedWith(candidate.id, project.agencyId))
  ) {
    return NextResponse.json({ error: "Candidatura inválida" }, { status: 400 });
  }
  const application = createApplication({ projectId: id, professionalId, message: parsed.data.message });
  if (application) {
    const professional = getProfessional(professionalId);
    logActivity({
      audience: "agency",
      clientId: project.clientId,
      projectId: id,
      text: `✋ ${professional?.name ?? "Um profissional"} se candidatou à demanda "${project.title}"`,
      href: `/clients/${project.clientId}?project=${id}`,
    });
  }
  if (!application) {
    return NextResponse.json(
      { error: "Você já se candidatou a esta demanda" },
      { status: 409 }
    );
  }
  return NextResponse.json(application, { status: 201 });
}
