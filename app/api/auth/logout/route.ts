import { NextResponse } from "next/server";
import { bumpSessionVersion } from "@/lib/auth";
import { clearSessionCookie, getSession } from "@/lib/session";

// Sair. Com {"all": true}, derruba também as sessões dos outros dispositivos
// (incrementa a versão de sessão da conta).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { all?: unknown } | null;
  if (body?.all === true) {
    const session = await getSession();
    if (session) bumpSessionVersion(session.userId);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
