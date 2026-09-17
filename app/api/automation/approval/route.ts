import { NextResponse } from "next/server";
import { z } from "zod";
import { actingAgencyId, guard, isDenied } from "@/lib/guard";
import { getApprovalRules, saveApprovalRules, whatsappConnected } from "@/lib/approvals-db";

// Regras da "aprovação que dispara ação" — visíveis e editáveis em
// Configurações (só agência/admin).
// Por agência (admin: a do ?agency=, ou a da casa).
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const agencyId = actingAgencyId(auth, request);
  return NextResponse.json({ rules: getApprovalRules(agencyId), whatsappConnected: whatsappConnected(agencyId) });
}

const schema = z.object({
  autoPostDraft: z.boolean().optional(),
  notifyWhatsapp: z.boolean().optional(),
  notifyPhone: z.string().trim().max(30).optional(),
  postDelayDays: z.number().int().min(0).max(30).optional(),
  postHour: z.number().int().min(0).max(23).optional(),
});

export async function PUT(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const agencyId = actingAgencyId(auth, request);
  return NextResponse.json({
    rules: saveApprovalRules(agencyId, parsed.data),
    whatsappConnected: whatsappConnected(agencyId),
  });
}
