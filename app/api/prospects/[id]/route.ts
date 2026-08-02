import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db";
import { deleteProspect, getProspect, updateProspect } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["new", "contacted", "converted", "discarded"]),
});

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const prospect = getProspect(id);
  if (!prospect) {
    return NextResponse.json({ error: "Prospect não encontrado" }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Converter em cliente: cria o cadastro pré-preenchido a partir do prospect
  if (parsed.data.status === "converted" && !prospect.clientId) {
    const client = createClient({
      name: prospect.name,
      industry: prospect.segment,
      description: "",
      audience: "",
      tone: "",
      goals: "",
      budget: "",
      channels: [],
      differentials: "",
      competitors: "",
      brandColors: "",
      website: prospect.website,
      instagram: prospect.instagram,
      notes: `Origem: prospecção (${prospect.searchQuery}). Maturidade: ${prospect.marketingMaturity}. Abordagem usada: ${prospect.suggestedApproach}`,
      language: "pt-BR",
      source: "agency",
    });
    const updated = updateProspect(id, { status: "converted", clientId: client.id });
    return NextResponse.json({ prospect: updated, clientId: client.id });
  }

  const updated = updateProspect(id, { status: parsed.data.status });
  return NextResponse.json({ prospect: updated, clientId: updated?.clientId ?? null });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteProspect(id)) {
    return NextResponse.json({ error: "Prospect não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
