import { guardClient, isDenied } from "@/lib/guard";
import { carouselBrand, getCarousel } from "@/lib/carousels-db";
import { renderSlide } from "@/lib/carousel-render";
import { FILE_RESPONSE_HEADERS } from "@/lib/uploads";

type Context = { params: Promise<{ id: string; n: string }> };
export const maxDuration = 60;

// PNG 1080×1350 de um slide (renderizado uma vez por versão do texto).
export async function GET(request: Request, { params }: Context) {
  const { id, n } = await params;
  const carousel = getCarousel(id);
  if (!carousel) return new Response("Não encontrado", { status: 404 });
  const auth = await guardClient(carousel.clientId, "view");
  if (isDenied(auth)) return auth;
  const index = Number(n);
  const brand = carouselBrand(carousel.clientId);
  if (!brand || !Number.isInteger(index)) return new Response("Não encontrado", { status: 404 });
  const rendered = await renderSlide(carousel, brand, index);
  if (!rendered) return new Response("Não encontrado", { status: 404 });
  const headers: Record<string, string> = {
    ...FILE_RESPONSE_HEADERS,
    "Content-Type": "image/png",
    "Cache-Control": "private, max-age=86400",
    ETag: `"${rendered.hash}"`,
    "X-Slide-Hash": rendered.hash,
  };
  if (new URL(request.url).searchParams.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="slide-${index + 1}.png"`;
  }
  return new Response(new Uint8Array(rendered.png), { headers });
}
