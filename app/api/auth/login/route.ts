import { NextResponse } from "next/server";
import { z } from "zod";
import { homeForUser, verifyLogin } from "@/lib/auth";
import { SESSION_COOKIE, signSession } from "@/lib/auth-shared";
import { getClient } from "@/lib/db";

export async function POST(request: Request) {
  const parsed = z
    .object({ username: z.string().trim().min(1), password: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe usuário e senha" }, { status: 400 });
  }
  const user = verifyLogin(parsed.data.username, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Usuário ou senha inválidos" }, { status: 401 });
  }
  // Modo da marca (autônoma x agência) para rotear e liberar o workspace.
  const selfServe =
    user.role === "client" && user.refId
      ? (getClient(user.refId)?.selfServe ?? false)
      : undefined;
  const token = await signSession({
    userId: user.id,
    role: user.role,
    refId: user.refId,
    name: user.name,
    brandSource: user.brandSource,
    selfServe,
  });
  const home = homeForUser(user, { selfServe });
  const response = NextResponse.json({ ok: true, home, role: user.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
