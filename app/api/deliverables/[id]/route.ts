import { NextResponse } from "next/server";
import { deleteDeliverable, getDeliverable } from "@/lib/marketplace-db";
import { deleteUpload } from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const deliverable = getDeliverable(id);
  if (!deliverable) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  deleteDeliverable(id);
  deleteUpload(deliverable.id, deliverable.mime);
  return NextResponse.json({ ok: true });
}
