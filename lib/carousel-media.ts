import { db } from "./db";
import { carouselBrand, getCarousel, type Carousel } from "./carousels-db";
import { slideHash } from "./carousel-rules";
import { signMedia } from "./media-sign";
import { appBaseUrl } from "./legal";
import { setPostMedia } from "./marketplace-db";

// Endereços públicos assinados dos slides de um carrossel. A assinatura leva
// o hash da versão atual (texto, paleta, logo, nome da marca): mudou a marca,
// muda o endereço. Por isso o agendador regera os endereços na hora de
// publicar, em vez de confiar nos que foram gravados ao agendar.
export function carouselMediaUrls(carousel: Carousel): string[] {
  const brand = carouselBrand(carousel.clientId);
  if (!brand) return [];
  const total = carousel.content.slides.length;
  const base = appBaseUrl();
  return carousel.content.slides
    .map((slide, index) => {
      const hash = slideHash({ template: carousel.template, palette: brand.palette, logoId: brand.logo?.id ?? null, brandName: brand.name, slide, index, total });
      const sig = signMedia(carousel.id, index, hash);
      return sig ? `${base}/api/c/${carousel.id}/${index}-${hash}.png?sig=${sig}` : null;
    })
    .filter((u): u is string => Boolean(u));
}

// Antes de publicar: se o post veio de um carrossel, grava os endereços da
// versão atual dos slides. Devolve as URLs (ou null quando não é carrossel).
export function refreshPostCarouselMedia(postId: string): string[] | null {
  const row = db.prepare("SELECT id FROM carousels WHERE postId = ? ORDER BY updatedAt DESC LIMIT 1").get(postId) as { id: string } | undefined;
  const carousel = row ? getCarousel(row.id) : null;
  if (!carousel) return null;
  const urls = carouselMediaUrls(carousel);
  setPostMedia(postId, urls);
  return urls;
}
