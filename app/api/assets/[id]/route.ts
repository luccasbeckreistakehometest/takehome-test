import { NextResponse } from "next/server";
import { deleteClientAsset, getClientAsset } from "@/lib/marketplace-db";
import { deleteGenericUpload, readGenericUpload } from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = getClientAsset(id);
  if (!asset) return new Response("Não encontrado", { status: 404 });
  const data = readGenericUpload(asset.id, asset.ext);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  const safe = asset.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || `arquivo.${asset.ext}`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Disposition": `attachment; filename="${safe}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = getClientAsset(id);
  if (!asset) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  deleteClientAsset(id);
  deleteGenericUpload(asset.id, asset.ext);
  return NextResponse.json({ ok: true });
}
