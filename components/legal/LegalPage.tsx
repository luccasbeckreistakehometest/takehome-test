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
    // Anatomia de documento (§10): capa curta, corpo em coluna de leitura de
    // 62ch com pontuação pendurada, e trilho de contexto à direita — em vez de
    // um bloco único de 768px em que título, identidade e cláusula têm o mesmo
    // peso. As seções são numeradas porque um documento legal se cita por
    // número, e o numeral fica pendurado fora da coluna de texto.
    <article lang={pt ? "pt-BR" : "en"} className="full-bleed" data-no-translate>
      <div className="ed sec">
        <header className="ed-grid">
          <div className="c8">
            <p className="t6 text-text-muted">{pt ? "Documento legal" : "Legal document"}</p>
            <h1 className="d2 mt-4">{doc.title}</h1>
            <p className="t5 tnum mt-3 text-text-muted">
              {pt ? "Versão de" : "Version of"} {updated}
            </p>
            <p className="t1 prose-doc mt-6">{doc.intro}</p>
          </div>
        </header>

        <div className="ed-grid mt-14 border-t border-edge pt-10">
          {/* Corpo do documento */}
          <div className="c8">
            {doc.sections.map((section, i) => (
              <section
                key={section.heading}
                className="doc-figure mb-10 grid grid-cols-[2.5rem_1fr] items-baseline gap-x-2"
              >
                <span className="idx t5">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  {/* O numeral fica pendurado fora da coluna; o que estiver no
                      texto do título vira duplicata e sai da exibição. */}
                  <h2 className="d4">{section.heading.replace(/^\s*\d+\.\s*/, "")}</h2>
                  {section.bullets && (
                    <ul className="mt-3 border-t border-rule">
                      {section.bullets.map((item) => (
                        <li key={item} className="t2 prose-doc border-b border-rule py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="t2 prose-doc mt-3">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Trilho: quem opera, documentos irmãos, versão no outro idioma */}
          <aside className="c4 no-print md:sticky md:top-20 md:self-start">
            <section aria-labelledby="legal-identity" className="border-t border-edge pt-3">
              <h2 id="legal-identity" className="t6 text-text-muted">
                {pt ? "Quem opera a Marqa" : "Who runs Marqa"}
              </h2>
              {hasIdentity ? (
                <dl className="mt-3">
                  {identity.name && (
                    <div className="border-b border-rule py-2">
                      <dt className="t5 text-text-muted">{pt ? "Razão social / nome" : "Legal name"}</dt>
                      <dd className="t4 mt-0.5">{identity.name}</dd>
                    </div>
                  )}
                  {identity.document && (
                    <div className="border-b border-rule py-2">
                      <dt className="t5 text-text-muted">{pt ? "CNPJ / CPF" : "Tax ID (CNPJ/CPF)"}</dt>
                      <dd className="t4 tnum mt-0.5">{identity.document}</dd>
                    </div>
                  )}
                  {identity.address && (
                    <div className="border-b border-rule py-2">
                      <dt className="t5 text-text-muted">{pt ? "Endereço" : "Address"}</dt>
                      <dd className="t4 mt-0.5">{identity.address}</dd>
                    </div>
                  )}
                  {identity.email && (
                    <div className="border-b border-rule py-2">
                      <dt className="t5 text-text-muted">E-mail</dt>
                      <dd className="t4 mt-0.5">
                        <a href={`mailto:${identity.email}`} className="underline-offset-4 hover:underline">
                          {identity.email}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : null}
              <p className="t4 mt-3 text-text-muted">
                {pt ? "Fale com a gente pelo " : "Reach us through the "}
                <Link href={pt ? "/contato" : "/contact"} className="text-text underline underline-offset-4">
                  {pt ? "formulário de contato" : "contact form"}
                </Link>
                {support.email ? (
                  <>
                    {pt ? " ou pelo e-mail " : " or by email at "}
                    <a href={`mailto:${support.email}`} className="text-text underline underline-offset-4">
                      {support.email}
                    </a>
                  </>
                ) : null}
                .
              </p>
            </section>

            <nav
              aria-label={pt ? "Documentos legais" : "Legal documents"}
              className="mt-8 border-t border-edge pt-3"
            >
              <p className="t6 text-text-muted">{pt ? "Outros documentos" : "Other documents"}</p>
              <ul className="mt-2">
                {RELATED[doc.lang].map((item) => (
                  <li key={item.href} className="border-b border-rule">
                    <Link
                      href={item.href}
                      aria-current={item.href === `/${doc.slug}` ? "page" : undefined}
                      className={`t4 block py-2 underline-offset-4 hover:underline ${
                        item.href === `/${doc.slug}` ? "font-medium" : "text-text-muted"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                {other && (
                  <li>
                    <Link
                      href={other.href}
                      hrefLang={pt ? "en" : "pt-BR"}
                      className="t4 block py-2 text-text-muted underline-offset-4 hover:underline"
                    >
                      {other.label}
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </article>
  );
}
