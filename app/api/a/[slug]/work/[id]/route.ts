import { getAgencyPage, getPublicDeliverable } from "@/lib/agency-page-db";
import { isPageLive } from "@/lib/agency-page-rules";
import { readUpload } from "@/lib/uploads";

type Context = { params: Promise<{ slug: string; id: string }> };

// Imagem de uma peça do portfólio público. Só entregas marcadas "mostrar no
// portfólio" saem por aqui — as demais continuam atrás do login.
export async function GET(_request: Request, { params }: Context) {
  const { slug, id } = await params;
  if (!isPageLive(getAgencyPage(), slug)) return new Response("Não encontrado", { status: 404 });
  const deliverable = getPublicDeliverable(id);
  if (!deliverable) return new Response("Não encontrado", { status: 404 });
  const data = readUpload(deliverable.id, deliverable.mime);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": deliverable.mime, "Cache-Control": "public, max-age=3600" },
  });
}
