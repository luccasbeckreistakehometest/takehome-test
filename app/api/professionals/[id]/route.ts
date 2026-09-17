import { NextResponse } from "next/server";
import { professionalSchema } from "@/lib/validation";
import {
  deleteProfessional,
  getProfessional,
  getProfessionalStats,
  listApplicationsByProfessional,
  listProjects,
  professionalWorkedWith,
  updateProfessional,
} from "@/lib/marketplace-db";
import { getAgency } from "@/lib/agencies";
import { assignedProjectForProfessional, professionalForViewer, toOpportunity } from "@/lib/marketplace-privacy";
import { professionalTier } from "@/lib/ranking";
import { guardProfessional, isDenied, tenantOf } from "@/lib/guard";
import { ALL_AGENCIES, agencyScope } from "@/lib/tenancy-rules";

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
  // O próprio profissional (e o admin) vê o que é dele em todas as agências;
  // uma agência vê só o que é dela.
  const self = auth.role === "professional" || auth.role === "admin";
  const scope = self ? ALL_AGENCIES : tenantOf(auth);
  // Oportunidades: marketplace aberto de todas as agências (freelancer) +,
  // para funcionário, as demandas abertas da agência dele (inclui internas).
  const marketplace = listProjects({ scope: ALL_AGENCIES, openOnly: true, marketplaceOnly: true });
  const internal =
    professional.employmentType === "employee" && professional.agencyId
      ? listProjects({ scope: agencyScope(professional.agencyId), openOnly: true }).filter((p) => p.mode === "internal")
      : [];
  // Oportunidade sai na versão pública (sem ranking da IA, marca ou escalado).
  const agencyNames = new Map<string, string>();
  const agencyName = (agencyId: string) => {
    if (!agencyNames.has(agencyId)) agencyNames.set(agencyId, getAgency(agencyId)?.name ?? "");
    return agencyNames.get(agencyId)!;
  };
  const opportunities = [...internal, ...marketplace]
    .filter((p) => self || scope.agencyId === p.agencyId)
    .map((p) => toOpportunity(p, agencyName(p.agencyId)));
  const projects = listProjects({ scope, professionalId: id });
  const worked = auth.role === "agency" && Boolean(auth.agencyId) && professionalWorkedWith(id, auth.agencyId!);
  return NextResponse.json({
    ...professionalForViewer(professional, auth, worked),
    stats,
    tier: professionalTier(stats),
    projects: auth.role === "professional" ? projects.map(assignedProjectForProfessional) : projects,
    opportunities,
    applications: listApplicationsByProfessional(id).filter((a) => self || a.agencyId === scope.agencyId),
  });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProfessional(id, "edit");
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
  const auth = await guardProfessional(id, "edit");
  if (isDenied(auth)) return auth;
  if (auth.role === "professional") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (!deleteProfessional(id)) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
