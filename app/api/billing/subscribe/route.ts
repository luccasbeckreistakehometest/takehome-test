import { NextResponse } from "next/server";
import { z } from "zod";
import { billingAccount } from "@/lib/session";
import { switchToFreePlan } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";

const schema = z.object({ planId: z.string().max(40) });

// Troca para um plano GRÁTIS. Planos pagos só entram pelo checkout do
// Mercado Pago (/api/billing/checkout) e pelo webhook que confirma o pagamento.
export async function POST(request: Request) {
  const auth = await guard(["agency", "client", "professional"]);
  if (isDenied(auth)) return auth;
  const account = billingAccount(auth);
  if (!account) return NextResponse.json({ error: "Conta sem plano" }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const result = switchToFreePlan({ ...account, planId: parsed.data.planId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ subscription: result.subscription });
}
