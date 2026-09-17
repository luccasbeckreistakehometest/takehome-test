import { NextResponse } from "next/server";
import {
  createProfessional,
  deleteProfessional,
  getProfessionalStats,
  listProfessionals,
} from "@/lib/marketplace-db";
import { professionalTier } from "@/lib/ranking";
import { professionalSchema } from "@/lib/validation";
import { createUser, randomPassword } from "@/lib/auth";
import { startAccount } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";

// Rede de profissionais da agência. Só agência/admin.
export async function GET() {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const professionals = listProfessionals().map((professional) => {
    const stats = getProfessionalStats(professional.id);
    return { ...professional, stats, tier: professionalTier(stats) };
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
  const professional = createProfessional(parsed.data);
  const password = randomPassword();
  try {
    const login = await createUser({
      password,
      role: "professional",
      refId: professional.id,
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
