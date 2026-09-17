import { NextResponse } from "next/server";
import {
  createProfessional,
  deleteProfessional,
  getProfessionalStats,
  listProfessionals,
  professionalWorkedWith,
} from "@/lib/marketplace-db";
import { professionalForViewer } from "@/lib/marketplace-privacy";
import { professionalTier } from "@/lib/ranking";
import { professionalSchema } from "@/lib/validation";
import { createUser, randomPassword } from "@/lib/auth";
import { startAccount } from "@/lib/billing-db";
import { actingAgencyId, guard, isDenied, tenantOf } from "@/lib/guard";
import { getAgency } from "@/lib/agencies";

// Rede de profissionais da agência (os dela, o marketplace aberto e quem já
// trabalhou com ela). Só agência/admin.
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const professionals = listProfessionals(tenantOf(auth, request)).map((professional) => {
    const stats = getProfessionalStats(professional.id);
    // Contato e custo só para a agência dona (contato também para quem já
    // recebeu candidatura/escalou o profissional).
    const own = auth.role === "admin" || (professional.agencyId !== null && professional.agencyId === auth.agencyId);
    const worked = !own && Boolean(auth.agencyId) && professionalWorkedWith(professional.id, auth.agencyId!);
    return { ...professionalForViewer(professional, auth, worked), stats, tier: professionalTier(stats) };
  });
  return NextResponse.json(professionals);
}

// Cria o profissional e o login com senha provisória aleatória (mostrada uma vez).
export async function POST(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = professionalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  // Cadastrado pela agência = da agência (admin: a do ?agency=, ou a da casa).
  const agencyId = actingAgencyId(auth, request);
  if (!getAgency(agencyId)) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  const professional = createProfessional(parsed.data, agencyId);
  const password = randomPassword();
  try {
    const login = await createUser({
      password,
      role: "professional",
      refId: professional.id,
      agencyId,
      name: professional.name,
      mustChangePassword: true,
    });
    startAccount("professional", professional.id);
    return NextResponse.json(
      { ...professional, login: { username: login.username, password, oneTime: true } },
      { status: 201 }
    );
  } catch (error) {
    deleteProfessional(professional.id);
    throw error;
  }
}
