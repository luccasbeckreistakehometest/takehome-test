import { NextResponse } from "next/server";
import {
  createProfessionalAsset,
  getProfessional,
  listProfessionalAssets,
} from "@/lib/marketplace-db";
import { ALLOWED_IMAGE_MIMES, saveUpload, type AllowedImageMime } from "@/lib/uploads";
import { guardProfessional, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

// Portfolio hospedado do profissional (imagens na plataforma)
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProfessional(id);
  if (isDenied(auth)) return auth;
  return NextResponse.json(listProfessionalAssets(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProfessional(id, "edit");
  if (isDenied(auth)) return auth;
  if (!getProfessional(id)) {
    return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !ALLOWED_IMAGE_MIMES.includes(file.type as AllowedImageMime)) {
    return NextResponse.json({ error: "Envie uma imagem (JPEG/PNG/WebP/GIF)" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem acima de 15 MB" }, { status: 400 });
  }
  const asset = createProfessionalAsset({
    professionalId: id,
    title: file.name,
    mime: file.type,
  });
  saveUpload(asset.id, file.type, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json(asset, { status: 201 });
}
