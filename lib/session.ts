import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "./auth-shared";
import { getSessionState, type User } from "./auth";
import { getClient } from "./db";
import type { AccountType } from "./plans";

// Valida um token completo: assinatura + expiração (auth-shared) e, no banco,
// conta ativa e versão de sessão atual (revogação). Usado por toda rota e
// página do servidor; o middleware (edge) só consegue checar a assinatura.
export async function sessionFromToken(token: string | undefined): Promise<SessionPayload | null> {
  const payload = await verifySession(token);
  if (!payload) return null;
  const state = getSessionState(payload.userId);
  if (!state || state.disabled) return null;
  if ((payload.sv ?? 0) !== state.sessionVersion) return null;
  // O modo da marca pode mudar pelo painel da agência: lê o valor atual.
  if (payload.role === "client" && payload.refId) {
    const client = getClient(payload.refId);
    if (!client) return null;
    return { ...payload, selfServe: client.selfServe };
  }
  return payload;
}

// Lê a sessão nas rotas/servidor.
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionFromToken(token);
}

// Emite o cookie de sessão para um usuário (login, cadastro, troca de senha).
export async function issueSession(
  response: NextResponse,
  user: Pick<User, "id" | "role" | "refId" | "name" | "brandSource">,
  opts: { selfServe?: boolean; sessionVersion: number }
): Promise<void> {
  const token = await signSession({
    userId: user.id,
    role: user.role,
    refId: user.refId,
    name: user.name,
    brandSource: user.brandSource,
    selfServe: opts.selfServe,
    sv: opts.sessionVersion,
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

// Reemite o cookie a partir de uma sessão já válida (ex.: troca de modo).
export async function reissueSession(
  response: NextResponse,
  session: SessionPayload,
  changes: Partial<Pick<SessionPayload, "selfServe" | "sv" | "name">>
): Promise<void> {
  const { iat, exp, ...rest } = session;
  void iat;
  void exp;
  const token = await signSession({ ...rest, ...changes });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

// Mapeia a sessão para a conta de billing (tipo + id). A agência da casa usa
// accountId fixo "agency"; cliente/profissional usam o refId.
export function billingAccount(
  session: Pick<SessionPayload, "role" | "refId">
): { accountType: AccountType; accountId: string } | null {
  if (session.role === "agency") return { accountType: "agency", accountId: "agency" };
  if (session.role === "client" && session.refId)
    return { accountType: "client", accountId: session.refId };
  if (session.role === "professional" && session.refId)
    return { accountType: "professional", accountId: session.refId };
  return null; // admin não tem conta de billing própria
}
