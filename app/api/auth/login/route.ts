import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSeedUsers, homeForUser, verifyLogin } from "@/lib/auth";
import { getClient } from "@/lib/db";
import { issueSession } from "@/lib/session";
import { checkLimits, clientIp, limiterFor, retryAfterHeader } from "@/lib/rate-limit";

// Login por usuário OU e-mail. Limites por IP e por conta (tentativas
// recusadas contam; um login certo zera o contador da conta).
export async function POST(request: Request) {
  const parsed = z
    .object({
      username: z.string().trim().min(1).max(200),
      password: z.string().min(1).max(200),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe usuário (ou e-mail) e senha." }, { status: 400 });
  }
  const identifier = parsed.data.username.toLowerCase();
  const ip = clientIp(request);
  const verdict = checkLimits([
    ["loginPerIp", ip],
    ["loginPerAccount", identifier],
  ]);
  if (!verdict.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Espere alguns minutos e tente de novo." },
      { status: 429, headers: retryAfterHeader(verdict) }
    );
  }
  await ensureSeedUsers();
  const result = await verifyLogin(identifier, parsed.data.password);
  if (!result.ok) {
    if (result.reason === "disabled") {
      return NextResponse.json(
        { error: "Esta conta está desativada. Fale com o suporte pelo formulário de contato." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }
  limiterFor("loginPerAccount").reset(identifier);
  const user = result.user;
  // Modo da marca (autônoma x agência) para rotear e liberar o workspace.
  const selfServe =
    user.role === "client" && user.refId ? (getClient(user.refId)?.selfServe ?? false) : undefined;
  const home = user.mustChangePassword ? "/conta?trocar=1" : homeForUser(user, { selfServe });
  const response = NextResponse.json({
    ok: true,
    home,
    role: user.role,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  });
  await issueSession(response, user, { selfServe, sessionVersion: user.sessionVersion });
  return response;
}
