import { NextResponse } from "next/server";
import { z } from "zod";
import { changePassword, getUserById } from "@/lib/auth";
import { getSession, reissueSession } from "@/lib/session";
import { checkLimits, retryAfterHeader } from "@/lib/rate-limit";

// Trocar a senha (todo papel). Derruba as outras sessões; esta continua.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const verdict = checkLimits([["passwordPerAccount", session.userId]]);
  if (!verdict.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Espere alguns minutos." }, { status: 429, headers: retryAfterHeader(verdict) });
  }
  const parsed = z
    .object({ current: z.string().min(1).max(200), next: z.string().max(200) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe a senha atual e a nova." }, { status: 400 });
  const result = await changePassword(session.userId, parsed.data.current, parsed.data.next);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const user = getUserById(session.userId);
  const response = NextResponse.json({ ok: true });
  await reissueSession(response, session, { sv: result.sessionVersion, name: user?.name ?? session.name });
  return response;
}
