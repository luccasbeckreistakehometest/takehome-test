import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bioGrid, bioIndexable, getBioBySlug, getLink } from "@/lib/links-db";
import { carouselBrand } from "@/lib/carousels-db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function load(slug: string) {
  const bio = getBioBySlug(slug);
  if (!bio?.published) return null;
  const brand = carouselBrand(bio.clientId);
  if (!brand) return null;
  const buttons = bio.buttons
    .map((b) => ({ ...b, link: getLink(b.code) }))
    .filter((b) => b.link && !b.link.archivedAt)
    .map((b) => ({ code: b.code, label: b.label || b.link!.label || new URL(b.link!.destUrl).hostname }));
  return { bio, brand, buttons, grid: bioGrid(bio.clientId) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = load(slug);
  if (!data) return { title: "Página não encontrada", robots: { index: false } };
  return {
    title: data.bio.title || data.brand.name,
    description: data.bio.bio.slice(0, 160) || undefined,
    // fora do Google, a menos que o cliente peça E a conta seja paga (ou
    // liberada pelo admin) — mesma régua da página pública da agência
    robots: bioIndexable(data.bio.clientId) ? { index: true, follow: true } : { index: false, follow: false },
    alternates: { canonical: `/b/${data.bio.slug}` },
  };
}

// Link na bio do cliente: botões rastreáveis e a grade dos últimos posts,
// com as cores e o logo da marca (não da agência).
export default async function BioPage({ params }: Props) {
  const { slug } = await params;
  const data = load(slug);
  if (!data) notFound();
  const { bio, brand, buttons, grid } = data;
  const { primary, ink } = brand.palette;
  const fallback = buttons[0]?.code ?? null;
  return (
    <div className="mx-auto max-w-md py-4" data-testid="bio-page" data-primary={primary} style={{ ["--accent" as string]: primary }}>
      <div className="flex flex-col items-center text-center">
        {brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/b/${bio.slug}/logo`} alt={brand.name} width={88} height={88} className="size-22 rounded-md object-contain" />
        ) : (
          <span className="d3 grid size-22 place-items-center rounded-md" style={{ background: primary, color: ink }}>
            {brand.name.charAt(0).toUpperCase()}
          </span>
        )}
        <h1 className="d3 mt-4">{bio.title || brand.name}</h1>
        {bio.bio && <p className="mt-2 whitespace-pre-line t3 text-text-muted">{bio.bio}</p>}
      </div>

      <ul className="mt-6 space-y-3">
        {buttons.map((b) => (
          <li key={b.code}>
            <a
              href={`/l/${b.code}`}
              rel="nofollow"
              className="block rounded-md px-5 py-4 text-center font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
              style={{ background: primary, color: ink }}
              data-testid="bio-button"
            >
              {b.label}
            </a>
          </li>
        ))}
        {buttons.length === 0 && <li className="text-center t3 text-text-muted">Em breve.</li>}
      </ul>

      {grid.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-center t6 text-text-muted">Últimos posts</h2>
          <div className="grid grid-cols-3 gap-1.5" data-testid="bio-grid">
            {grid.map((item) => {
              const code = item.code ?? fallback;
              const tile = item.imageId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/b/${bio.slug}/img/${item.imageId}`} alt={item.title} width={300} height={300} className="aspect-square w-full rounded-md object-cover" />
              ) : (
                <span className="grid aspect-square w-full place-items-center rounded-md p-2 text-center t5 font-medium" style={{ background: primary, color: ink }}>
                  {item.title}
                </span>
              );
              return code ? (
                <a key={item.postId} href={`/l/${code}`} rel="nofollow" data-testid="bio-tile">
                  {tile}
                </a>
              ) : (
                <div key={item.postId}>{tile}</div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
