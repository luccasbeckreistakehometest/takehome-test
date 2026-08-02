import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createApplication,
  getProfessional,
  getProject,
  listApplications,
} from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

const applySchema = z.object({
  professionalId: z.string().min(1),
  message: z.string().trim().default(""),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(listApplications(id));
}

// Profissional se candidata a uma demanda aberta
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
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
  if (!parsed.success || !getProfessional(parsed.data.professionalId)) {
    return NextResponse.json({ error: "Candidatura inválida" }, { status: 400 });
  }
  const application = createApplication({ projectId: id, ...parsed.data });
  if (!application) {
    return NextResponse.json(
      { error: "Você já se candidatou a esta demanda" },
      { status: 409 }
    );
  }
  return NextResponse.json(application, { status: 201 });
}
