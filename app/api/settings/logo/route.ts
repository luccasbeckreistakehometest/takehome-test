import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_MIMES, readUpload, saveUpload, type AllowedImageMime } from "@/lib/uploads";
import { actingAgencyId, agencyOnly, isDenied } from "@/lib/guard";
import { getAgency, setAgencyLogoMime } from "@/lib/agencies";
import { getSession } from "@/lib/session";
import { agencyLogoUploadId, HOUSE_AGENCY_ID } from "@/lib/tenancy-rules";

// Serve o logo whitelabel de uma agência (header, página pública, proposta,
// relatório). Público: ?agency=<id>; sem parâmetro, o da agência da sessão.
export async function GET(request: Request) {
  const wanted = new URL(request.url).searchParams.get("agency");
  const agencyId = wanted || (await getSession())?.agencyId || HOUSE_AGENCY_ID;
  const agency = getAgency(agencyId);
  if (!agency?.logoMime) {
    return NextResponse.json({ error: "sem logo" }, { status: 404 });
  }
  const data = readUpload(agencyLogoUploadId(agency.id), agency.logoMime);
  if (!data) return NextResponse.json({ error: "sem logo" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": agency.logoMime, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" },
  });
}

// Upload do logo (multipart). Aceita PNG/JPEG/WEBP/GIF. Vai para a agência da
// sessão (admin: a do ?agency=, ou a da casa).
export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const agencyId = actingAgencyId(auth, request);
  if (!getAgency(agencyId)) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  }
  const mime = file.type;
  if (!ALLOWED_IMAGE_MIMES.includes(mime as AllowedImageMime)) {
    return NextResponse.json({ error: "Formato inválido (use PNG, JPEG ou WEBP)." }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Logo acima de 2 MB." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  saveUpload(agencyLogoUploadId(agencyId), mime, buffer);
  setAgencyLogoMime(agencyId, mime);
  return NextResponse.json({ ok: true, logoMime: mime }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  setAgencyLogoMime(actingAgencyId(auth, request), "");
  return NextResponse.json({ ok: true });
}
