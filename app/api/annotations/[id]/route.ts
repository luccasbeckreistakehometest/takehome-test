import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAnnotation, setAnnotationResolved } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const parsed = z
    .object({ resolved: z.boolean() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (!setAnnotationResolved(id, parsed.data.resolved)) {
    return NextResponse.json({ error: "Anotação não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteAnnotation(id)) {
    return NextResponse.json({ error: "Anotação não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
