import { NextResponse } from "next/server";
import { z } from "zod";
import { actingAgencyId, guard, isDenied } from "@/lib/guard";
import { clientAgencyId } from "@/lib/db";
import { getProfessional } from "@/lib/marketplace-db";
import { agencyScope } from "@/lib/tenancy-rules";
import { getFinanceSettings, listProfessionalRates, saveFinanceSettings, setClientFee, setProfessionalRate } from "@/lib/finance-db";

// Custo/hora padrão, margem-alvo, moeda, custo/hora por profissional e fee
// mensal por cliente — tudo o que a margem precisa.
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const agencyId = actingAgencyId(auth, request);
  return NextResponse.json({ settings: getFinanceSettings(agencyId), professionals: listProfessionalRates(agencyScope(agencyId)) });
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
  const agencyId = actingAgencyId(auth, request);
  // Só mexe no que é da agência: profissional e marca de outra agência são ignorados.
  const ownProfessionals = (professionals ?? []).filter((p) => getProfessional(p.id)?.agencyId === agencyId);
  const ownClients = (clientFees ?? []).filter((c) => clientAgencyId(c.clientId) === agencyId);
  if (ownProfessionals.length !== (professionals ?? []).length || ownClients.length !== (clientFees ?? []).length) {
    return NextResponse.json({ error: "Profissional ou cliente não encontrado" }, { status: 404 });
  }
  saveFinanceSettings(agencyId, settings);
  for (const p of ownProfessionals) setProfessionalRate(p.id, p.hourlyCost);
  for (const c of ownClients) setClientFee(c.clientId, c.monthlyFee);
  return NextResponse.json({ settings: getFinanceSettings(agencyId), professionals: listProfessionalRates(agencyScope(agencyId)) });
}
