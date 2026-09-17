import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionPayload } from "./auth-shared";

export type Role = SessionPayload["role"];

// Guarda de papel para rotas de API novas: o middleware só garante que existe
// sessão; aqui a rota declara QUEM pode chamar. Uma marca (role client) só
// passa quando o clientId da rota é o dela.
//
// Uso:
//   const auth = await guard(["agency", "admin"]);
//   if (auth instanceof NextResponse) return auth;
export async function guard(
  roles: Role[],
  opts: { clientId?: string | null } = {}
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  if (session.role === "client" && opts.clientId && session.refId !== opts.clientId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return session;
}

export function isDenied(auth: SessionPayload | NextResponse): auth is NextResponse {
  return auth instanceof NextResponse;
}
