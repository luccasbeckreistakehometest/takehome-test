import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { getFinanceSettings, listProfessionalRates, saveFinanceSettings, setClientFee, setProfessionalRate } from "@/lib/finance-db";

// Custo/hora padrão, margem-alvo, moeda, custo/hora por profissional e fee
// mensal por cliente — tudo o que a margem precisa.
export async function GET() {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json({ settings: getFinanceSettings(), professionals: listProfessionalRates() });
}

const schema = z.object({
  defaultHourlyCost: z.number().min(0).optional(),
  targetMarginPct: z.number().min(0).max(95).optional(),
  currency: z.string().length(3).optional(),
  professionals: z.array(z.object({ id: z.string().min(1), hourlyCost: z.number().min(0) })).max(500).optional(),
  clientFees: z.array(z.object({ clientId: z.string().min(1), monthlyFee: z.number().min(0) })).max(500).optional(),
});

export async function PUT(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const { professionals, clientFees, ...settings } = parsed.data;
  saveFinanceSettings(settings);
  for (const p of professionals ?? []) setProfessionalRate(p.id, p.hourlyCost);
  for (const c of clientFees ?? []) setClientFee(c.clientId, c.monthlyFee);
  return NextResponse.json({ settings: getFinanceSettings(), professionals: listProfessionalRates() });
}
