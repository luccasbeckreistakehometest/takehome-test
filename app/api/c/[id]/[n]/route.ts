import { carouselBrand, getCarousel } from "@/lib/carousels-db";
import { renderSlide } from "@/lib/carousel-render";
import { verifyMedia } from "@/lib/media-sign";
import { FILE_RESPONSE_HEADERS } from "@/lib/uploads";
import { checkLimits, clientIp } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string; n: string }> };

// Imagem pública e assinada de um slide (o Instagram baixa a mídia por URL).
// A assinatura inclui o hash da versão: texto editado = link novo.
export async function GET(request: Request, { params }: Context) {
  if (!checkLimits([["publicReadPerIp", clientIp(request)]]).ok) return new Response("Muitas tentativas", { status: 429 });
  const { id, n } = await params;
  const url = new URL(request.url);
  const [indexRaw, hash] = n.replace(/\.png$/, "").split("-");
  const index = Number(indexRaw);
  const carousel = getCarousel(id);
  if (!carousel || !Number.isInteger(index) || !hash || !verifyMedia(id, index, hash, url.searchParams.get("sig"))) {
    return new Response("Não encontrado", { status: 404 });
  }
  const brand = carouselBrand(carousel.clientId);
  const rendered = brand ? await renderSlide(carousel, brand, index) : null;
  if (!rendered || rendered.hash !== hash) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(rendered.png), {
    headers: { ...FILE_RESPONSE_HEADERS, "Content-Type": "image/png", "Cache-Control": "public, max-age=604800, immutable", "X-Robots-Tag": "noindex" },
  });
}
