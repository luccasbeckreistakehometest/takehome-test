import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPublishedPage, listPublicWork, listShowcaseClients } from "@/lib/agency-page-db";
import { getAgency } from "@/lib/agencies";
import { agencyLogoUrl } from "@/lib/branding";
import LeadForm from "@/components/LeadForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// Página pública da agência: quem somos, serviços, trabalhos selecionados,
// clientes que consentiram, depoimentos e o formulário que vira prospect.
// A agência vem do endereço (/a/[slug]); cada agência tem a sua.
function loadPage(slug: string) {
  const page = findPublishedPage(slug);
  const agency = page ? getAgency(page.agencyId) : null;
  if (!page || !agency) return null;
  const settings = {
    agencyName: agency.name,
    tagline: agency.tagline,
    accentColor: agency.accentColor,
    logoUrl: agencyLogoUrl(agency),
  };
  return { agencyId: agency.id, config: page.config, settings };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = loadPage(slug);
  if (!page) return { title: "Página não encontrada" };
  const { config, settings } = page;
  const title = config.headline ? `${settings.agencyName} — ${config.headline}` : `${settings.agencyName} — ${settings.tagline}`;
  const description = (config.about || settings.tagline).slice(0, 160);
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: settings.agencyName, locale: "pt_BR" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function AgencyPublicPage({ params }: Props) {
  const { slug } = await params;
  const page = loadPage(slug);
  if (!page) notFound();
  const { config, settings, agencyId } = page;
  const work = listPublicWork(agencyId);
  const clients = config.showClients ? listShowcaseClients(agencyId) : [];
  const cta = config.ctaTitle || "Vamos conversar?";

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-4" style={{ ["--accent" as string]: settings.accentColor }} data-testid="agency-page">
      <section className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        {settings.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt={settings.agencyName} className="size-20 rounded-2xl border border-edge object-contain" />
        ) : (
          <span className="grid size-20 place-items-center rounded-2xl bg-accent font-[family-name:var(--font-display)] text-3xl font-bold text-accent-ink">
            {settings.agencyName.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">{settings.agencyName}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl" data-testid="agency-headline">
            {config.headline || settings.tagline}
          </h1>
          {config.headline && <p className="mt-2 text-muted">{settings.tagline}</p>}
          <a href="#contato" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90">
            Quero conversar →
          </a>
        </div>
      </section>

      {config.about && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Quem somos</h2>
          <p className="max-w-3xl whitespace-pre-line text-base leading-relaxed">{config.about}</p>
        </section>
      )}

      {config.services.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">O que fazemos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="agency-services">
            {config.services.map((service) => (
              <div key={service} className="rounded-xl border border-edge bg-surface p-4 text-sm font-medium">
                <span className="mr-2 text-accent">✓</span>
                {service}
              </div>
            ))}
          </div>
        </section>
      )}

      {work.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Trabalhos selecionados</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="agency-portfolio">
            {work.map((item) => (
              <figure key={item.id} className="overflow-hidden rounded-xl border border-edge bg-surface" data-testid="portfolio-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/a/${config.slug}/work/${item.id}`} alt={item.title} className="aspect-square w-full object-cover" loading="lazy" />
                <figcaption className="p-3 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted">{item.clientName}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {clients.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Quem confia na gente</h2>
          <div className="flex flex-wrap gap-2" data-testid="agency-clients">
            {clients.map((client) => (
              <span key={client.id} className="inline-flex items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1.5 text-sm" data-testid="agency-client">
                {client.hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/a/${config.slug}/logo/${client.id}`} alt={client.name} className="size-6 rounded-full object-cover" />
                ) : (
                  <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">{client.name.charAt(0).toUpperCase()}</span>
                )}
                {client.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {config.testimonials.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">O que dizem</h2>
          <div className="grid gap-3 md:grid-cols-2" data-testid="agency-testimonials">
            {config.testimonials.map((t, i) => (
              <blockquote key={i} className="rounded-xl border border-edge bg-surface p-5">
                <p className="text-sm leading-relaxed">“{t.text}”</p>
                <footer className="mt-3 text-xs text-muted">
                  <span className="font-medium text-foreground">{t.author}</span>
                  {t.role && ` · ${t.role}`}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <section id="contato" className="grid gap-6 rounded-2xl border border-accent/30 bg-accent/5 p-6 md:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">{cta}</h2>
          <p className="mt-2 text-sm text-muted">Conte o que você precisa e a gente responde no seu WhatsApp.</p>
          {config.whatsapp && (
            <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-accent hover:underline">
              Ou chame direto no WhatsApp ↗
            </a>
          )}
        </div>
        <LeadForm slug={config.slug} agencyName={settings.agencyName} />
      </section>

      <p className="text-center text-xs text-muted">
        {settings.agencyName} — {settings.tagline}
      </p>
    </div>
  );
}
