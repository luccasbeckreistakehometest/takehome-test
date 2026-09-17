import { NextResponse } from "next/server";
import { deleteClientAsset } from "@/lib/marketplace-db";
import { deleteGenericUpload, readGenericUpload } from "@/lib/uploads";
import { guardClientAsset, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClientAsset(id, "view");
  if (isDenied(auth)) return auth;
  const asset = auth.asset;
  const data = readGenericUpload(asset.id, asset.ext);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  const safe = asset.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || `arquivo.${asset.ext}`;
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Disposition": `attachment; filename="${safe}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardClientAsset(id, "workspace");
  if (isDenied(auth)) return auth;
  const asset = auth.asset;
  deleteClientAsset(id);
  deleteGenericUpload(asset.id, asset.ext);
  return NextResponse.json({ ok: true });
}
