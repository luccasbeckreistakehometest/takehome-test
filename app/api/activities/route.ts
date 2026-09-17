import { NextResponse } from "next/server";
import { listActivities, markActivitiesRead } from "@/lib/marketplace-db";
import { guard, isDenied } from "@/lib/guard";
import type { SessionPayload } from "@/lib/auth-shared";

// Central de atividade: o feed vem da SESSÃO (a marca só vê o dela; o
// profissional, o dele), nunca de parâmetros da URL.
function scopeFor(session: SessionPayload) {
  if (session.role === "client") return { audience: "client" as const, clientId: session.refId ?? "-" };
  if (session.role === "professional") return { audience: "professional" as const, professionalId: session.refId ?? "-" };
  return { audience: "agency" as const };
}

export async function GET() {
  const auth = await guard(["agency", "admin", "client", "professional"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json(listActivities(scopeFor(auth)));
}

export async function PATCH() {
  const auth = await guard(["agency", "admin", "client", "professional"]);
  if (isDenied(auth)) return auth;
  const scope = scopeFor(auth);
  markActivitiesRead(scope.audience, scope);
  return NextResponse.json({ ok: true });
}
