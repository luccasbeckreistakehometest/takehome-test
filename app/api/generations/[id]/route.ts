import { NextResponse } from "next/server";
import { deleteGeneration, getGeneration } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const generation = getGeneration(id);
  if (!generation) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  return NextResponse.json(generation);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteGeneration(id)) {
    return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
