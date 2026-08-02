import { NextResponse } from "next/server";
import { professionalSchema } from "@/lib/validation";
import {
  deleteProfessional,
  getProfessional,
  getProfessionalStats,
  listProjects,
  updateProfessional,
} from "@/lib/marketplace-db";
import { professionalTier } from "@/lib/ranking";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
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
    opportunities: listProjects({ openOnly: true }),
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = professionalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const updated = updateProfessional(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteProfessional(id)) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
