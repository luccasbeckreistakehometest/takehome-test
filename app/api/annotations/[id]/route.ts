import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteAnnotation, setAnnotationResolved } from "@/lib/marketplace-db";
import { guardDeliverable, notFound } from "@/lib/guard";

async function authorize(id: string) {
  const row = db.prepare("SELECT deliverableId FROM annotations WHERE id = ?").get(id) as { deliverableId: string } | undefined;
  if (!row) return notFound("Anotação não encontrada");
  const auth = await guardDeliverable(row.deliverableId, "portal");
  return auth instanceof Response ? auth : null;
}

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const denied = await authorize(id);
  if (denied) return denied;
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
  const denied = await authorize(id);
  if (denied) return denied;
  if (!deleteAnnotation(id)) {
    return NextResponse.json({ error: "Anotação não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
