import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserById, setUserEmail, verifyPassword } from "@/lib/auth";
import { deleteAccount } from "@/lib/account-data";
import { db } from "@/lib/db";
import { clearSessionCookie, getSession } from "@/lib/session";
import { checkLimits, retryAfterHeader } from "@/lib/rate-limit";

// Minha conta: dados de acesso, e-mail e exclusão (LGPD).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const user = getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  return NextResponse.json({
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    consentAt: user.consentAt,
    consentVersion: user.consentVersion,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = z.object({ email: z.string().trim().max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const result = setUserEmail(session.userId, parsed.data.email || null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, email: getUserById(session.userId)?.email ?? null });
}

// Excluir a conta: pede a senha e a palavra EXCLUIR (ou DELETE).
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const verdict = checkLimits([["passwordPerAccount", session.userId]]);
  if (!verdict.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Espere alguns minutos." }, { status: 429, headers: retryAfterHeader(verdict) });
  }
  const parsed = z
    .object({ password: z.string().min(1).max(200), confirm: z.string().trim() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success || !["EXCLUIR", "DELETE"].includes(parsed.data.confirm.toUpperCase())) {
    return NextResponse.json({ error: "Digite EXCLUIR e sua senha para confirmar." }, { status: 400 });
  }
  const row = db.prepare("SELECT passwordHash FROM users WHERE id = ?").get(session.userId) as { passwordHash: string } | undefined;
  if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 403 });
  }
  const outcome = deleteAccount(session.userId);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  const response = NextResponse.json({ ok: true, removedWorkspace: outcome.removedWorkspace });
  clearSessionCookie(response);
  return response;
}
