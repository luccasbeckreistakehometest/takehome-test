import { guardClient, isDenied } from "@/lib/guard";
import { carouselBrand, getCarousel } from "@/lib/carousels-db";
import { renderSlide } from "@/lib/carousel-render";
import { captionText } from "@/lib/carousel-rules";
import { buildZip, type ZipEntry } from "@/lib/zip";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 120;

// Todas as imagens + legenda.txt num ZIP para postar à mão.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const carousel = getCarousel(id);
  if (!carousel) return new Response("Não encontrado", { status: 404 });
  const auth = await guardClient(carousel.clientId, "view");
  if (isDenied(auth)) return auth;
  const brand = carouselBrand(carousel.clientId);
  if (!brand) return new Response("Não encontrado", { status: 404 });
  const entries: ZipEntry[] = [];
  for (let i = 0; i < carousel.content.slides.length; i++) {
    const rendered = await renderSlide(carousel, brand, i);
    if (rendered) entries.push({ name: `slide-${String(i + 1).padStart(2, "0")}.png`, data: rendered.png });
  }
  entries.push({ name: "legenda.txt", data: new TextEncoder().encode(captionText(carousel.content)) });
  const zip = buildZip(entries);
  const safe = carousel.topic.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "carrossel";
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safe}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
