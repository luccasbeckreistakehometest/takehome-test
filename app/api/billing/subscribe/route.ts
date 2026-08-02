import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, billingAccount } from "@/lib/session";
import { subscribe } from "@/lib/billing-db";

const schema = z.object({
  planId: z.string(),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
});

// Assina um plano (pagamento simulado — integração real de pagamento é deploy).
export async function POST(request: Request) {
  const session = await getSession();
  const account = session ? billingAccount(session) : null;
  if (!account) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  try {
    const result = subscribe({ ...account, planId: parsed.data.planId, period: parsed.data.period });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erro" }, { status: 400 });
  }
}
