import Link from "next/link";
import type { LegalDoc } from "@/lib/legal-types";
import { legalIdentity, LEGAL_VERSION, supportChannels } from "@/lib/legal";

const COUNTERPART: Record<string, { href: string; label: string }> = {
  termos: { href: "/terms", label: "English version" },
  privacidade: { href: "/privacy", label: "English version" },
  reembolso: { href: "/refunds", label: "English version" },
  cookies: { href: "/cookie-policy", label: "English version" },
  terms: { href: "/termos", label: "Versão em português" },
  privacy: { href: "/privacidade", label: "Versão em português" },
  refunds: { href: "/reembolso", label: "Versão em português" },
  "cookie-policy": { href: "/cookies", label: "Versão em português" },
};

const RELATED = {
  pt: [
    { href: "/termos", label: "Termos de Uso" },
    { href: "/privacidade", label: "Privacidade" },
    { href: "/reembolso", label: "Reembolso" },
    { href: "/cookies", label: "Cookies" },
  ],
  en: [
    { href: "/terms", label: "Terms" },
    { href: "/privacy", label: "Privacy" },
    { href: "/refunds", label: "Refunds" },
    { href: "/cookie-policy", label: "Cookies" },
  ],
};

// Página legal: texto versionado + quem opera (só dados vindos do ambiente).
export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const pt = doc.lang === "pt";
  const identity = legalIdentity();
  const support = supportChannels();
  const other = COUNTERPART[doc.slug];
  const hasIdentity = Boolean(identity.name || identity.document || identity.address || identity.email);
  const updated = new Date(`${LEGAL_VERSION}T12:00:00Z`).toLocaleDateString(pt ? "pt-BR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article lang={pt ? "pt-BR" : "en"} className="mx-auto max-w-3xl space-y-8 py-6" data-no-translate>
      <header className="space-y-3">
        <nav aria-label={pt ? "Documentos legais" : "Legal documents"} className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {RELATED[doc.lang].map((item) => (
            <Link key={item.href} href={item.href} className={item.href === `/${doc.slug}` ? "font-semibold text-accent" : "hover:text-foreground"}>
              {item.label}
            </Link>
          ))}
          {other && (
            <Link href={other.href} hrefLang={pt ? "en" : "pt-BR"} className="ml-auto hover:text-foreground">
              {other.label}
            </Link>
          )}
        </nav>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="text-sm text-muted">
          {pt ? "Versão de" : "Version of"} {updated}
        </p>
        <p className="text-base leading-relaxed">{doc.intro}</p>
      </header>

      <section className="rounded-xl border border-edge bg-surface p-4 text-sm" aria-labelledby="legal-identity">
        <h2 id="legal-identity" className="font-semibold">
          {pt ? "Quem opera a Marqa" : "Who runs Marqa"}
        </h2>
        {hasIdentity ? (
          <dl className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            {identity.name && (
              <>
                <dt className="text-muted">{pt ? "Razão social / nome" : "Legal name"}</dt>
                <dd>{identity.name}</dd>
              </>
            )}
            {identity.document && (
              <>
                <dt className="text-muted">{pt ? "CNPJ / CPF" : "Tax ID (CNPJ/CPF)"}</dt>
                <dd>{identity.document}</dd>
              </>
            )}
            {identity.address && (
              <>
                <dt className="text-muted">{pt ? "Endereço" : "Address"}</dt>
                <dd>{identity.address}</dd>
              </>
            )}
            {identity.email && (
              <>
                <dt className="text-muted">E-mail</dt>
                <dd>
                  <a href={`mailto:${identity.email}`} className="text-accent hover:underline">
                    {identity.email}
                  </a>
                </dd>
              </>
            )}
          </dl>
        ) : null}
        <p className="mt-2 text-muted">
          {pt ? "Fale com a gente pelo " : "Reach us through the "}
          <Link href={pt ? "/contato" : "/contact"} className="text-accent hover:underline">
            {pt ? "formulário de contato" : "contact form"}
          </Link>
          {support.email ? (
            <>
              {pt ? " ou pelo e-mail " : " or by email at "}
              <a href={`mailto:${support.email}`} className="text-accent hover:underline">
                {support.email}
              </a>
            </>
          ) : null}
          .
        </p>
      </section>

      {doc.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{section.heading}</h2>
          {section.bullets && (
            <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
