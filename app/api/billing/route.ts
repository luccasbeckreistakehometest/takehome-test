import { NextResponse } from "next/server";
import { getSession, billingAccount } from "@/lib/session";
import { billingSummary, enforcedFor, isEnforced, platformRevenue } from "@/lib/billing-db";
import { COIN_PACKS, PERIOD_DISCOUNT, plansFor } from "@/lib/plans";

// Resumo de billing da conta logada. Admin recebe visão de receita da plataforma.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  if (session.role === "admin") {
    return NextResponse.json({
      role: "admin",
      revenue: platformRevenue(),
      enforced: isEnforced(),
      packs: COIN_PACKS,
      periods: PERIOD_DISCOUNT,
    });
  }
  const account = billingAccount(session);
  if (!account) return NextResponse.json({ error: "conta sem billing" }, { status: 400 });
  const summary = billingSummary(account.accountType, account.accountId);
  return NextResponse.json({
    role: session.role,
    accountType: account.accountType,
    ...summary,
    plans: plansFor(account.accountType),
    packs: COIN_PACKS,
    periods: PERIOD_DISCOUNT,
    // o bloqueio por saldo vale para ESTA conta? (plano grátis: sempre)
    enforced: enforcedFor(account.accountType, account.accountId, summary.plan),
  });
}
