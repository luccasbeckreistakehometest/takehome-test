import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { createProject, listProjects } from "@/lib/marketplace-db";
import { projectSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const professionalId = url.searchParams.get("professionalId") ?? undefined;
  const openOnly = url.searchParams.get("open") === "1";
  return NextResponse.json(listProjects({ clientId, professionalId, openOnly }));
}

export async function POST(request: Request) {
  const parsed = projectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  if (!getClient(parsed.data.clientId)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(createProject(parsed.data), { status: 201 });
}
