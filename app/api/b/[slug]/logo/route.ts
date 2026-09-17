import { getBioBySlug } from "@/lib/links-db";
import { carouselBrand } from "@/lib/carousels-db";
import { FILE_RESPONSE_HEADERS, readGenericUpload } from "@/lib/uploads";

type Context = { params: Promise<{ slug: string }> };

// Logo do cliente na página de bio (só com a página publicada).
export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const bio = getBioBySlug(slug);
  const brand = bio?.published ? carouselBrand(bio.clientId) : null;
  const data = brand?.logo ? readGenericUpload(brand.logo.id, brand.logo.ext) : null;
  if (!brand?.logo || !data) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { ...FILE_RESPONSE_HEADERS, "Content-Type": brand.logo.mime, "Cache-Control": "public, max-age=3600" } });
}
