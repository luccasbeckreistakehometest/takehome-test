import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { createClientAsset, listClientAssets } from "@/lib/marketplace-db";
import { sanitizeExt, saveGenericUpload, storedGenericMime } from "@/lib/uploads";
import { guardClient, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB (PSD/AI são pesados)

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listClientAssets(id));
}

// Upload de arquivos da marca: identidade visual, projetos Photoshop (.psd),
// Illustrator (.ai), PDFs, ZIPs...
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClient(id, "workspace");
  if (isDenied(auth)) return auth;
  if (!getClient(id)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kindRaw = String(form?.get("kind") ?? "brand");
  const kind = (["brand", "project", "other"] as const).includes(
    kindRaw as "brand"
  )
    ? (kindRaw as "brand" | "project" | "other")
    : "brand";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo acima de 100 MB" }, { status: 400 });
  }
  const data = Buffer.from(await file.arrayBuffer());
  const asset = createClientAsset({
    clientId: id,
    title: file.name,
    ext: sanitizeExt(file.name),
    // imagem só se os bytes provarem; SVG/HTML/desconhecido = download
    mime: storedGenericMime(file.type, data),
    kind,
  });
  saveGenericUpload(asset.id, asset.ext, data);
  return NextResponse.json(asset, { status: 201 });
}
