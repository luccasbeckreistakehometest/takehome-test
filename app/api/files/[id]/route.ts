import { getDeliverable } from "@/lib/marketplace-db";
import { readUpload } from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const deliverable = getDeliverable(id);
  if (!deliverable) return new Response("Não encontrado", { status: 404 });
  const data = readUpload(deliverable.id, deliverable.mime);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  const headers: Record<string, string> = {
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
