import { NextResponse } from "next/server";
import { listUsers } from "@/lib/auth";
import { billingSummary } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";
import type { AccountType } from "@/lib/plans";

// Usuários com plano e saldo (admin).
export async function GET() {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const users = listUsers().map((user) => {
    const accountType: AccountType | null =
      user.role === "agency" ? "agency" : user.role === "client" || user.role === "professional" ? user.role : null;
    const accountId = user.role === "agency" ? "agency" : user.refId;
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
