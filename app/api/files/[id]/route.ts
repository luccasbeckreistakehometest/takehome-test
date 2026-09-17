import { FILE_RESPONSE_HEADERS, readUpload } from "@/lib/uploads";
import { guardDeliverable, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "view");
  if (isDenied(auth)) return auth;
  const deliverable = auth.deliverable;
  const data = readUpload(deliverable.id, deliverable.mime);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  const headers: Record<string, string> = {
    ...FILE_RESPONSE_HEADERS,
    "Content-Type": deliverable.mime,
    "Cache-Control": "private, max-age=3600",
  };
  // Download disponível para todos os integrantes do contrato
  // (agência, profissional e cliente)
  if (new URL(request.url).searchParams.get("download") === "1") {
    const ext = deliverable.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
    const safe = deliverable.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "entrega";
    headers["Content-Disposition"] = `attachment; filename="${safe}.${ext}"`;
  }
  return new Response(new Uint8Array(data), { headers });
}
