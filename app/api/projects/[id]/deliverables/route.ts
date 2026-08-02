import { NextResponse } from "next/server";
import { createDeliverable, getProject, listDeliverables } from "@/lib/marketplace-db";
import { ALLOWED_IMAGE_MIMES, saveUpload, type AllowedImageMime } from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(listDeliverables(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!getProject(id)) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_MIMES.includes(file.type as AllowedImageMime)) {
    return NextResponse.json(
      { error: "Envie uma imagem (JPEG, PNG, GIF ou WebP)" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Imagem acima de 15 MB" }, { status: 400 });
  }
  const deliverable = createDeliverable({
    projectId: id,
    title: title || file.name,
    mime: file.type,
  });
  saveUpload(
    deliverable.id,
    file.type as AllowedImageMime,
    Buffer.from(await file.arrayBuffer())
  );
  return NextResponse.json(deliverable, { status: 201 });
}
