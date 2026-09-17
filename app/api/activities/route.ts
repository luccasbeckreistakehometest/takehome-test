import { NextResponse } from "next/server";
import { listActivities, markActivitiesRead } from "@/lib/marketplace-db";
import { guard, isDenied, tenantOf } from "@/lib/guard";
import { ALL_AGENCIES } from "@/lib/tenancy-rules";
import type { SessionPayload } from "@/lib/auth-shared";

// Central de atividade: o feed vem da SESSÃO (a marca só vê o dela; o
// profissional, o dele), nunca de parâmetros da URL.
// O profissional recebe avisos de várias agências (marketplace): o filtro é o
// próprio id. Marca e agência ficam no tenant delas.
function scopeFor(session: SessionPayload) {
  if (session.role === "client") {
    return { audience: "client" as const, scope: tenantOf(session), clientId: session.refId ?? "-" };
  }
  if (session.role === "professional") {
    return { audience: "professional" as const, scope: ALL_AGENCIES, professionalId: session.refId ?? "-" };
  }
  return { audience: "agency" as const, scope: tenantOf(session) };
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
  markActivitiesRead(scope.audience, { ...scope, tenant: scope.scope });
  return NextResponse.json({ ok: true });
}
