import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findPublishedPage, listPublicWork, listShowcaseClients } from "@/lib/agency-page-db";
import { agencyPageIndexable, getAgency } from "@/lib/agencies";
import { agencyLogoUrl } from "@/lib/branding";
import LeadForm from "@/components/LeadForm";
import { buttonClass } from "@/lib/button-class";
import { brandStyle } from "@/lib/brand-ramp";

/** SOFT do Fraunces na peça pública (§3.1). */
const SOFT_20 = { "--soft": 20 } as React.CSSProperties;

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
    // agência nova fica fora do Google até o admin liberar (ou plano pago)
    robots: agencyPageIndexable(page.agencyId) ? { index: true, follow: true } : { index: false, follow: false },
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
    // A página pública da agência é a peça de marca dela: grade editorial de 12
    // colunas com splits alternados, a cor da agência num papel só (o botão de
    // contato), e nenhuma grade de cartões iguais. Antes eram seis seções com a
    // mesma forma: título minúsculo em caixa alta + grade de 3 cartões.
    <div className="full-bleed" style={brandStyle(settings.accentColor) as React.CSSProperties} data-testid="agency-page">
      <section className="sec">
        <div className="ed">
          <div className="ed-grid">
            <div className="c7">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logoUrl}
                    alt={settings.agencyName}
                    className="size-10 rounded-xs border border-rule object-contain"
                  />
                ) : null}
                <p className="t6 text-text-muted">{settings.agencyName}</p>
              </div>
              <h1 className="d1 mt-6" style={SOFT_20} data-testid="agency-headline">
                {config.headline || settings.tagline}
              </h1>
              {config.headline && <p className="t1 measure-lede mt-5 text-text-muted">{settings.tagline}</p>}
              <a href="#contato" className={`${buttonClass("primary", "lg")} mt-8`}>
                Quero conversar
              </a>
            </div>
            {config.about && (
              <div className="c4 c-start9">
                <p className="t6 border-b border-edge pb-2 text-text-muted">Quem somos</p>
                <p className="t3 measure-prose mt-3 whitespace-pre-line text-text-muted">{config.about}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {config.services.length > 0 && (
        <section className="sec border-t border-rule">
          <div className="ed">
            <div className="ed-grid">
              <h2 className="c4 d3">O que fazemos</h2>
              <ul className="c7 c-start6 border-t border-edge" data-testid="agency-services">
                {config.services.map((service, i) => (
                  <li key={service} className="flex items-baseline gap-4 border-b border-rule py-3">
                    <span className="idx t5 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="t2">{service}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {work.length > 0 && (
        <section className="sec border-t border-rule">
          <div className="ed">
            <h2 className="d3">Trabalhos selecionados</h2>
            <div className="ed-grid mt-10" data-testid="agency-portfolio">
              {work.map((item) => (
                <figure key={item.id} className="c4" data-testid="portfolio-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/a/${config.slug}/work/${item.id}`}
                    alt={item.title}
                    className="aspect-[4/5] w-full rounded-xs object-cover"
                    loading="lazy"
                  />
                  <figcaption className="mt-2 border-t border-rule pt-2">
                    <p className="t3 font-medium">{item.title}</p>
                    <p className="t5 text-text-muted">{item.clientName}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {clients.length > 0 && (
        <section className="sec-tight border-t border-rule">
          <div className="ed flex flex-wrap items-center gap-x-8 gap-y-3" data-testid="agency-clients">
            <p className="t6 text-text-muted">Quem confia na gente</p>
            {clients.map((client) => (
              <span key={client.id} className="t3 inline-flex items-center gap-2" data-testid="agency-client">
                {client.hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/a/${config.slug}/logo/${client.id}`}
                    alt={client.name}
                    className="size-6 rounded-full object-cover"
                  />
                ) : null}
                {client.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {config.testimonials.length > 0 && (
        <section className="sec border-t border-rule">
          <div className="ed">
            <div className="ed-grid" data-testid="agency-testimonials">
              <h2 className="c3 d3">O que dizem</h2>
              <div className="c8 c-start5">
                {config.testimonials.map((t, i) => (
                  <blockquote key={i} className="border-b border-rule py-6 first:border-t">
                    <p className="d-quote t1 prose-doc">“{t.text}”</p>
                    <footer className="t5 mt-3 text-text-muted">
                      <span className="font-medium text-text">{t.author}</span>
                      {t.role && ` · ${t.role}`}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="contato" className="sec border-t border-edge">
        <div className="ed">
          <div className="ed-grid">
            <div className="c5">
              <h2 className="d2" style={SOFT_20}>
                {cta}
              </h2>
              <p className="t2 measure-lede mt-4 text-text-muted">
                Conte o que você precisa e a gente responde no seu WhatsApp.
              </p>
              {config.whatsapp && (
                <a
                  href={`https://wa.me/${config.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="t3 mt-4 inline-block font-medium underline underline-offset-4"
                >
                  Ou chame direto no WhatsApp
                </a>
              )}
            </div>
            <div className="c6 c-start7">
              <LeadForm slug={config.slug} agencyName={settings.agencyName} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule py-8">
        <p className="ed t5 text-text-muted">
          {settings.agencyName} — {settings.tagline}
        </p>
      </footer>
    </div>
  );
}
