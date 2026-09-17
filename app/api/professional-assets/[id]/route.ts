import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteProfessionalAsset } from "@/lib/marketplace-db";
import { deleteUpload, FILE_RESPONSE_HEADERS, readUpload } from "@/lib/uploads";
import { guardProfessional, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

type AssetRow = { id: string; mime: string; professionalId: string };

function findAsset(id: string): AssetRow | undefined {
  return db.prepare("SELECT id, mime, professionalId FROM professional_assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = findAsset(id);
  if (!asset) return new Response("Não encontrado", { status: 404 });
  const auth = await guardProfessional(asset.professionalId);
  if (isDenied(auth)) return auth;
  const data = readUpload(asset.id, asset.mime);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { ...FILE_RESPONSE_HEADERS, "Content-Type": asset.mime, "Cache-Control": "private, max-age=3600" },
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = findAsset(id);
  if (!asset) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const auth = await guardProfessional(asset.professionalId, "edit");
  if (isDenied(auth)) return auth;
  deleteProfessionalAsset(id);
  deleteUpload(asset.id, asset.mime);
  return NextResponse.json({ ok: true });
}
