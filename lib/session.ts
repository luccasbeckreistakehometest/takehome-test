import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./auth-shared";
import type { AccountType } from "./plans";

// Lê a sessão nas rotas/servidor.
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

// Mapeia a sessão para a conta de billing (tipo + id). A agência da casa usa
// accountId fixo "agency"; cliente/profissional usam o refId.
export function billingAccount(
  session: SessionPayload
): { accountType: AccountType; accountId: string } | null {
  if (session.role === "agency") return { accountType: "agency", accountId: "agency" };
  if (session.role === "client" && session.refId)
    return { accountType: "client", accountId: session.refId };
  if (session.role === "professional" && session.refId)
    return { accountType: "professional", accountId: session.refId };
  return null; // admin não tem conta de billing própria
}
