import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import { ALLOWED_IMAGE_MIMES, readUpload, saveUpload, type AllowedImageMime } from "@/lib/uploads";

const LOGO_ID = "agency-logo";

// Serve o logo whitelabel salvo (usado no header, login e cadastro).
export async function GET() {
  const settings = getSettings();
  if (!settings.logoMime) {
    return NextResponse.json({ error: "sem logo" }, { status: 404 });
  }
  const data = readUpload(LOGO_ID, settings.logoMime);
  if (!data) return NextResponse.json({ error: "sem logo" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": settings.logoMime, "Cache-Control": "no-cache" },
  });
}

// Upload do logo (multipart). Aceita PNG/JPEG/WEBP/GIF.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  }
  const mime = file.type;
  if (!ALLOWED_IMAGE_MIMES.includes(mime as AllowedImageMime)) {
    return NextResponse.json({ error: "Formato inválido (use PNG, JPEG ou WEBP)." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  saveUpload(LOGO_ID, mime, buffer);
  saveSettings({ ...getSettings(), logoMime: mime });
  return NextResponse.json({ ok: true, logoMime: mime }, { status: 201 });
}

export async function DELETE() {
  saveSettings({ ...getSettings(), logoMime: "" });
  return NextResponse.json({ ok: true });
}
