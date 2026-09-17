import { NextResponse } from "next/server";
import { recordUserEvent } from "@/lib/analytics-db";
import { z } from "zod";
import { billingAccount } from "@/lib/session";
import { createCoinCheckout, createPlanCheckout, mpConfigured } from "@/lib/mercadopago";
import { getUserById } from "@/lib/auth";
import { getCoinPack, getPlan, isPurchasablePlan, purchaseBlockReason } from "@/lib/plans";
import { guard, isDenied } from "@/lib/guard";
import { checkLimits, retryAfterHeader } from "@/lib/rate-limit";

export const maxDuration = 60;

const schema = z.object({
  kind: z.enum(["coins", "plan"]),
  packId: z.string().max(40).optional(),
  planId: z.string().max(40).optional(),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]).default("monthly"),
});

// Cria o checkout do Mercado Pago (coins ou plano pré-pago) e devolve a URL.
// O crédito só acontece quando o webhook confirma o pagamento.
export async function POST(request: Request) {
  const auth = await guard(["agency", "client", "professional"]);
  if (isDenied(auth)) return auth;
  const account = billingAccount(auth);
  if (!account) return NextResponse.json({ error: "Conta sem plano" }, { status: 400 });
  // Nunca vender o que a conta não pode usar (marca gerenciada, profissional).
  const blocked = purchaseBlockReason(auth);
  if (blocked) return NextResponse.json({ error: blocked, code: "not_for_sale" }, { status: 403 });
  const verdict = checkLimits([["checkoutPerAccount", auth.userId]]);
  if (!verdict.ok) {
    return NextResponse.json({ error: "Muitas tentativas de pagamento. Espere um pouco." }, { status: 429, headers: retryAfterHeader(verdict) });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { kind, packId, planId, period } = parsed.data;
  if (kind === "coins" && !getCoinPack(packId ?? "")) {
    return NextResponse.json({ error: "Pacote inválido" }, { status: 400 });
  }
  if (kind === "plan") {
    const plan = getPlan(planId ?? "");
    if (!plan || plan.accountType !== account.accountType || !isPurchasablePlan(plan)) {
      return NextResponse.json({ error: "Plano inválido para esta conta" }, { status: 400 });
    }
  }
  if (!mpConfigured()) {
    return NextResponse.json({ error: "O pagamento ainda não está disponível. Fale com o suporte." }, { status: 503 });
  }
  recordUserEvent("checkout_started", auth.userId, { kind: "checkout" });
  const email = getUserById(auth.userId)?.email ?? undefined;
  try {
    const { url } =
      kind === "coins"
        ? await createCoinCheckout({ ...account, packId: packId!, email })
        : await createPlanCheckout({ ...account, planId: planId!, period, email });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[billing] checkout falhou:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
