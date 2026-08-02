import { NextResponse } from "next/server";
import {
  createProfessional,
  getProfessionalStats,
  listProfessionals,
} from "@/lib/marketplace-db";
import { professionalTier } from "@/lib/ranking";
import { professionalSchema } from "@/lib/validation";
import { createUser } from "@/lib/auth";

export async function GET() {
  const professionals = listProfessionals().map((professional) => {
    const stats = getProfessionalStats(professional.id);
    return { ...professional, stats, tier: professionalTier(stats) };
  });
  return NextResponse.json(professionals);
}

export async function POST(request: Request) {
  const parsed = professionalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const professional = createProfessional(parsed.data);
  const login = createUser({
    password: "luccas123",
    role: "professional",
    refId: professional.id,
    name: professional.name,
  });
  return NextResponse.json(
    { ...professional, login: { username: login.username, password: "luccas123" } },
    { status: 201 }
  );
}
