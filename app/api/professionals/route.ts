import { NextResponse } from "next/server";
import {
  createProfessional,
  getProfessionalStats,
  listProfessionals,
} from "@/lib/marketplace-db";
import { professionalTier } from "@/lib/ranking";
import { professionalSchema } from "@/lib/validation";

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
  return NextResponse.json(createProfessional(parsed.data), { status: 201 });
}
