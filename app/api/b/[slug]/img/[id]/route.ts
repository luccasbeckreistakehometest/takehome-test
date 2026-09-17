import { getBioBySlug, bioGrid } from "@/lib/links-db";
import { getDeliverable } from "@/lib/marketplace-db";
import { FILE_RESPONSE_HEADERS, isInlineImageMime, readUpload } from "@/lib/uploads";

type Context = { params: Promise<{ slug: string; id: string }> };

// Imagem de um post publicado que aparece na grade da bio.
export async function GET(_request: Request, { params }: Context) {
  const { slug, id } = await params;
  const bio = getBioBySlug(slug);
  if (!bio?.published || !bioGrid(bio.clientId).some((item) => item.imageId === id)) return new Response("Não encontrado", { status: 404 });
  const deliverable = getDeliverable(id);
  const data = deliverable && isInlineImageMime(deliverable.mime) ? readUpload(deliverable.id, deliverable.mime) : null;
  if (!deliverable || !data) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { ...FILE_RESPONSE_HEADERS, "Content-Type": deliverable.mime, "Cache-Control": "public, max-age=3600" } });
}
