import { NextResponse } from "next/server";
import { db, } from "@/lib/db";
import { deleteProfessionalAsset } from "@/lib/marketplace-db";
import { deleteUpload, readUpload } from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = db.prepare("SELECT * FROM professional_assets WHERE id = ?").get(id) as
    | { id: string; mime: string }
    | undefined;
  if (!asset) return new Response("Não encontrado", { status: 404 });
  const data = readUpload(asset.id, asset.mime);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": asset.mime, "Cache-Control": "private, max-age=3600" },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = db.prepare("SELECT * FROM professional_assets WHERE id = ?").get(id) as
    | { id: string; mime: string }
    | undefined;
  if (!asset) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  deleteProfessionalAsset(id);
  deleteUpload(asset.id, asset.mime);
  return NextResponse.json({ ok: true });
}
