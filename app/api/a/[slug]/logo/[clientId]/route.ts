import { getAgencyPage, getShowcaseLogo } from "@/lib/agency-page-db";
import { isPageLive } from "@/lib/agency-page-rules";
import { readGenericUpload } from "@/lib/uploads";

type Context = { params: Promise<{ slug: string; clientId: string }> };

// Logo de um cliente na faixa "quem confia": só com consentimento (flag
// showcase) e só a imagem de identidade visual enviada nos arquivos da marca.
export async function GET(_request: Request, { params }: Context) {
  const { slug, clientId } = await params;
  if (!isPageLive(getAgencyPage(), slug)) return new Response("Não encontrado", { status: 404 });
  const asset = getShowcaseLogo(clientId);
  if (!asset) return new Response("Não encontrado", { status: 404 });
  const data = readGenericUpload(asset.id, asset.ext);
  if (!data) return new Response("Arquivo indisponível", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": asset.mime, "Cache-Control": "public, max-age=3600" },
  });
}
