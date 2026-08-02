import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteGeneration, getGeneration, updateGenerationActuals, updateGenerationContent } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const generation = getGeneration(id);
  if (!generation) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  return NextResponse.json(generation);
}

// Valores reais informados pela equipe (ex.: métricas reais do ROI) para
// comparar com a projeção
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = z
    .object({
      actuals: z.record(z.string(), z.string()).optional(),
      content: z.string().min(2).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  let updated = null;
  if (parsed.data.content !== undefined) {
    updated = updateGenerationContent(id, parsed.data.content);
  }
  if (parsed.data.actuals !== undefined) {
    updated = updateGenerationActuals(id, parsed.data.actuals);
  }
  if (!updated) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteGeneration(id)) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
