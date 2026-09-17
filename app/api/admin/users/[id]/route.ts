import { NextResponse } from "next/server";
import { z } from "zod";
import { adminResetPassword, countActiveAdmins, getUserById, setUserDisabled, setUserEmail } from "@/lib/auth";
import { addCoins, adminSetPlan, listPayments, listTransactions } from "@/lib/billing-db";
import { guard, isDenied } from "@/lib/guard";
import type { AccountType } from "@/lib/plans";

type Context = { params: Promise<{ id: string }> };

function accountOf(user: NonNullable<ReturnType<typeof getUserById>>): { accountType: AccountType; accountId: string } | null {
  if (user.role === "agency") return { accountType: "agency", accountId: "agency" };
  if ((user.role === "client" || user.role === "professional") && user.refId) {
    return { accountType: user.role, accountId: user.refId };
  }
  return null;
}

// Detalhe de um usuário: plano, saldo, lançamentos e pagamentos.
export async function GET(_request: Request, { params }: Context) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const user = getUserById(id);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const account = accountOf(user);
  return NextResponse.json({
    user,
    transactions: account ? listTransactions({ ...account, limit: 50 }) : [],
    payments: account ? listPayments({ ...account, limit: 50 }) : [],
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("reset_password") }),
  z.object({ action: z.literal("set_email"), email: z.string().trim().max(200) }),
  z.object({ action: z.literal("set_plan"), planId: z.string().max(40), months: z.number().int().min(1).max(36).default(1) }),
  z.object({ action: z.literal("grant_coins"), coins: z.number().int().min(-100000).max(100000), note: z.string().trim().max(200).default("") }),
]);

export async function POST(request: Request, { params }: Context) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const { id } = await params;
  const user = getUserById(id);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const input = parsed.data;

  switch (input.action) {
    case "disable": {
      if (user.id === auth.userId) return NextResponse.json({ error: "Você não pode desativar a própria conta." }, { status: 409 });
      if (user.role === "admin" && countActiveAdmins() <= 1) {
        return NextResponse.json({ error: "Não dá para desativar o único admin." }, { status: 409 });
      }
      setUserDisabled(id, true);
      return NextResponse.json({ ok: true });
    }
    case "enable":
      setUserDisabled(id, false);
      return NextResponse.json({ ok: true });
    case "reset_password": {
      // Mostrada UMA vez ao admin; a pessoa troca no primeiro acesso.
      const password = await adminResetPassword(id);
      return NextResponse.json({ ok: true, username: user.username, password, oneTime: true });
    }
    case "set_email": {
      const result = setUserEmail(id, input.email || null);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    case "set_plan": {
      const account = accountOf(user);
      if (!account) return NextResponse.json({ error: "Esta conta não tem plano." }, { status: 400 });
      try {
        const subscription = adminSetPlan({ ...account, planId: input.planId, months: input.months });
        return NextResponse.json({ ok: true, subscription });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Plano inválido" }, { status: 400 });
      }
    }
    case "grant_coins": {
      const account = accountOf(user);
      if (!account) return NextResponse.json({ error: "Esta conta não tem carteira." }, { status: 400 });
      const note = input.note ? ` — ${input.note}` : "";
      const wallet = addCoins(account.accountType, account.accountId, input.coins, `Ajuste do admin${note}`, "grant", 0, `admin:${auth.userId}`);
      return NextResponse.json({ ok: true, wallet });
    }
  }
}
