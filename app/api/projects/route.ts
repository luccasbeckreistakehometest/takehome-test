import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { createProject, listProjects } from "@/lib/marketplace-db";
import { projectSchema } from "@/lib/validation";
import { guard, isDenied } from "@/lib/guard";

// Demandas. A agência lista tudo; a marca só as dela (o clientId vem da
// sessão, não da URL).
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin", "client"]);
  if (isDenied(auth)) return auth;
  const url = new URL(request.url);
  const openOnly = url.searchParams.get("open") === "1";
  if (auth.role === "client") {
    return NextResponse.json(listProjects({ clientId: auth.refId ?? "-", openOnly }));
  }
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const professionalId = url.searchParams.get("professionalId") ?? undefined;
  return NextResponse.json(listProjects({ clientId, professionalId, openOnly }));
}

// A marca pode abrir pedidos da própria conta (portal e workspace).
export async function POST(request: Request) {
  const parsed = projectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const auth = await guard(["agency", "admin", "client"], { clientId: parsed.data.clientId });
  if (isDenied(auth)) return auth;
  if (!getClient(parsed.data.clientId)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(createProject(parsed.data), { status: 201 });
}
