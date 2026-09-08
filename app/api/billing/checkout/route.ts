import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, billingAccount } from "@/lib/session";
import { createCoinCheckout, createPlanCheckout, mpConfigured } from "@/lib/mercadopago";

export const maxDuration = 60;

const schema = z.object({
  kind: z.enum(["coins", "plan"]),
  packId: z.string().optional(),
  planId: z.string().optional(),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
});

// Cria o checkout do Mercado Pago (coins ou plano) e devolve a URL de pagamento.
export async function POST(request: Request) {
  const session = await getSession();
  const account = session ? billingAccount(session) : null;
  if (!account) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!mpConfigured()) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado (falta MP_ACCESS_TOKEN)." },
      { status: 503 }
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { kind, packId, planId, period } = parsed.data;
  try {
    if (kind === "coins") {
      if (!packId) return NextResponse.json({ error: "packId ausente" }, { status: 400 });
      const { url } = await createCoinCheckout({ ...account, packId });
      return NextResponse.json({ url });
    }
    if (!planId) return NextResponse.json({ error: "planId ausente" }, { status: 400 });
    const { url } = await createPlanCheckout({ ...account, planId, period });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no checkout" },
      { status: 502 }
    );
  }
}
