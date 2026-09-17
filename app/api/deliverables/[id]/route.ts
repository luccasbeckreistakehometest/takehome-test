import { NextResponse } from "next/server";
import { deleteDeliverable } from "@/lib/marketplace-db";
import { deleteUpload } from "@/lib/uploads";
import { guardDeliverable, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "workspace");
  if (isDenied(auth)) return auth;
  const deliverable = auth.deliverable;
  deleteDeliverable(id);
  deleteUpload(deliverable.id, deliverable.mime);
  return NextResponse.json({ ok: true });
}
