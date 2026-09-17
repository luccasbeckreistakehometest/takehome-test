import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createApplication,
  getProfessional,
  getProject,
  listApplications,
  logActivity,
} from "@/lib/marketplace-db";
import { guard, guardProject, isDenied } from "@/lib/guard";

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
  if (project.status !== "open") {
    return NextResponse.json(
      { error: "Esta demanda não está mais aberta a candidaturas" },
      { status: 400 }
    );
  }
  const parsed = applySchema.safeParse(await request.json().catch(() => null));
  // O profissional só se candidata por si mesmo.
  const professionalId = auth.role === "professional" ? auth.refId : parsed.data?.professionalId;
  if (!parsed.success || !professionalId || !getProfessional(professionalId)) {
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
