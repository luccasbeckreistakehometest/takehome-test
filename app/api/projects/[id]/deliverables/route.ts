import { NextResponse } from "next/server";
import { createDeliverable, getProject, listDeliverables, logActivity } from "@/lib/marketplace-db";
import { ALLOWED_IMAGE_MIMES, looksLikeVideo, saveUpload, sniffImageMime, type AllowedImageMime } from "@/lib/uploads";
import { guardProject, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listDeliverables(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "workspace");
  if (isDenied(auth)) return auth;
  if (!getProject(id)) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "").trim();
  const kindRaw = String(form?.get("kind") ?? "delivery");
  const kind = kindRaw === "reference" ? "reference" : "delivery";
  const meaning = String(form?.get("meaning") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo é obrigatório" }, { status: 400 });
  }
  const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
  const isImage = ALLOWED_IMAGE_MIMES.includes(file.type as AllowedImageMime);
  const isVideo = VIDEO_MIMES.includes(file.type);
  // Referências base podem ser foto, arte ou vídeo; entregas para revisão
  // visual (pins + análise de IA) precisam ser imagem
  if (kind === "reference" ? !isImage && !isVideo : !isImage) {
    return NextResponse.json(
      {
        error:
          kind === "reference"
            ? "Envie imagem (JPEG/PNG/WebP/GIF) ou vídeo (MP4/MOV/WebM)"
            : "Entregas para revisão devem ser imagem (JPEG, PNG, GIF ou WebP)",
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Imagem acima de 15 MB" }, { status: 400 });
  }
  const data = Buffer.from(await file.arrayBuffer());
  // O tipo declarado precisa bater com os bytes.
  if (isImage ? sniffImageMime(data) !== file.type : !looksLikeVideo(data)) {
    return NextResponse.json({ error: "O conteúdo do arquivo não confere com o formato." }, { status: 400 });
  }
  const deliverable = createDeliverable({
    projectId: id,
    title: title || file.name,
    mime: file.type,
    kind,
    meaning,
  });
  saveUpload(deliverable.id, file.type, data);
  if (kind === "delivery") {
    const project = getProject(id)!;
    logActivity({
      audience: "agency",
      clientId: project.clientId,
      projectId: id,
      text: `📤 Nova entrega "${deliverable.title}" na demanda "${project.title}" — revisar`,
      href: `/clients/${project.clientId}?project=${id}`,
    });
  }
  return NextResponse.json(deliverable, { status: 201 });
}
