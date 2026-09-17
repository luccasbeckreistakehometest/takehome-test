import { findPublishedPage, getShowcaseLogo } from "@/lib/agency-page-db";
import { readGenericUpload } from "@/lib/uploads";

type Context = { params: Promise<{ slug: string; clientId: string }> };

// Logo de um cliente na faixa "quem confia": só com consentimento (flag
// showcase) e só a imagem de identidade visual enviada nos arquivos da marca.
export async function GET(_request: Request, { params }: Context) {
  const { slug, clientId } = await params;
  const page = findPublishedPage(slug);
  if (!page) return new Response("Não encontrado", { status: 404 });
  // Só marcas da agência dona da página.
  const asset = getShowcaseLogo(page.agencyId, clientId);
  if (!asset) return new Response("Não encontrado", { status: 404 });
  const data = readGenericUpload(asset.id, asset.ext);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": asset.mime, "Cache-Control": "public, max-age=3600" },
  });
}
