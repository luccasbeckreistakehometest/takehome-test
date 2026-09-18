import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { supportChannels } from "@/lib/legal";

// Página de contato. E-mail e WhatsApp de suporte só aparecem quando
// configurados (SUPPORT_EMAIL / SUPPORT_WHATSAPP).
export default function ContactPage({ lang, topic }: { lang: "pt" | "en"; topic?: string }) {
  const pt = lang === "pt";
  const support = supportChannels();
  return (
    // Split doc (8+4): o formulário é o trabalho, os canais diretos são o
    // trilho. Antes eram três blocos empilhados com o mesmo peso no meio da
    // página.
    <div className="full-bleed">
      <div className="ed sec">
        <div className="ed-grid">
          <div className="c7">
            <p className="t6 text-text-muted">{pt ? "Suporte" : "Support"}</p>
            <h1 className="d2 mt-4">{pt ? "Fale com a gente" : "Talk to us"}</h1>
            <p className="t1 measure-lede mt-5 text-text-muted">
              {pt
                ? "Dúvidas, problemas de acesso, pagamentos ou pedidos sobre os seus dados. Respondemos por e-mail."
                : "Questions, sign-in problems, payments or requests about your data. We answer by email."}
            </p>
            {!pt && (
              <p className="t5 mt-2 text-text-muted">
                The form is in Portuguese; you can write in English.
              </p>
            )}
            <div className="mt-10 border-t border-edge pt-8">
              <ContactForm initialTopic={topic} />
            </div>
          </div>

          <aside className="c4 c-start9">
            {(support.email || support.whatsapp) && (
              <section className="border-t border-edge pt-3">
                <p className="t6 text-text-muted">{pt ? "Canais diretos" : "Direct channels"}</p>
                <ul className="mt-2">
                  {support.email && (
                    <li className="border-b border-rule">
                      <a
                        href={`mailto:${support.email}`}
                        className="t4 block py-2 underline-offset-4 hover:underline"
                      >
                        {support.email}
                      </a>
                    </li>
                  )}
                  {support.whatsapp && (
                    <li className="border-b border-rule">
                      <a
                        href={`https://wa.me/${support.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="t4 block py-2 underline-offset-4 hover:underline"
                      >
                        WhatsApp
                      </a>
                    </li>
                  )}
                </ul>
              </section>
            )}
            <section className="mt-8 border-t border-edge pt-3">
              <p className="t6 text-text-muted">{pt ? "Veja também" : "See also"}</p>
              <ul className="mt-2">
                <li className="border-b border-rule">
                  <Link
                    href={pt ? "/reembolso" : "/refunds"}
                    className="t4 block py-2 text-text-muted underline-offset-4 hover:text-text hover:underline"
                  >
                    {pt ? "Reembolso e cancelamento" : "Refunds and cancellation"}
                  </Link>
                </li>
                <li className="border-b border-rule">
                  <Link
                    href={pt ? "/privacidade" : "/privacy"}
                    className="t4 block py-2 text-text-muted underline-offset-4 hover:text-text hover:underline"
                  >
                    {pt ? "Privacidade" : "Privacy"}
                  </Link>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
