import { NextResponse } from "next/server";
import { listUsers } from "@/lib/auth";
import { billingSummary } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";
import { listAgencies } from "@/lib/agencies";
import type { AccountType } from "@/lib/plans";

// Usuários com agência, plano e saldo (admin). ?agency=<id> filtra.
export async function GET(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const agencyFilter = new URL(request.url).searchParams.get("agency") || null;
  const agencyName = new Map(listAgencies().map((a) => [a.id, a.name]));
  const users = listUsers({ agencyId: agencyFilter }).map((row) => {
    const user = { ...row, agencyName: row.agencyId ? (agencyName.get(row.agencyId) ?? "") : "" };
    const accountType: AccountType | null =
      user.role === "agency" ? "agency" : user.role === "client" || user.role === "professional" ? user.role : null;
    // Conta de agência: a carteira é da agência (compartilhada pelo time).
    const accountId = user.role === "agency" ? user.agencyId : user.refId;
    if (!accountType || !accountId) return { ...user, billing: null };
    const summary = billingSummary(accountType, accountId);
    return {
      ...user,
      billing: {
        accountType,
        accountId,
        planId: summary.subscription.planId,
        planName: summary.plan?.name ?? summary.subscription.planId,
        renewsAt: summary.subscription.renewsAt,
        coins: summary.wallet.coins,
        usageThisMonth: summary.usageThisMonth,
      },
    };
  });
  return NextResponse.json({ users });
}
