import { NextResponse } from "next/server";
import { professionalSchema } from "@/lib/validation";
import {
  deleteProfessional,
  getProfessional,
  getProfessionalStats,
  listApplicationsByProfessional,
  listProjects,
  updateProfessional,
} from "@/lib/marketplace-db";
import { professionalTier } from "@/lib/ranking";
import { agencyOnly, guardProfessional, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProfessional(id);
  if (isDenied(auth)) return auth;
  const professional = getProfessional(id);
  if (!professional) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  const stats = getProfessionalStats(id);
  return NextResponse.json({
    ...professional,
    stats,
    tier: professionalTier(stats),
    projects: listProjects({ professionalId: id }),
    // Freelancer: só o marketplace aberto (demandas externas, precisa se
    // candidatar). Funcionário full-time: vê as demandas da agência, incluindo
    // as internas — é do time da casa. (Multi-agência filtraria por agencyId.)
    opportunities:
      professional.employmentType === "employee"
        ? listProjects({ openOnly: true })
        : listProjects({ openOnly: true }).filter(
            (project) => project.mode !== "internal"
          ),
    applications: listApplicationsByProfessional(id),
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProfessional(id);
  if (isDenied(auth)) return auth;
  const parsed = professionalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  // O vínculo (freelancer x funcionário) é decisão da agência.
  const current = getProfessional(id)!;
  const data = auth.role === "professional" ? { ...parsed.data, employmentType: current.employmentType } : parsed.data;
  const updated = updateProfessional(id, data);
  if (!updated) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  if (!deleteProfessional(id)) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
