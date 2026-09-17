import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { Card } from "@/components/ui";
import { supportChannels } from "@/lib/legal";

// Página de contato. E-mail e WhatsApp de suporte só aparecem quando
// configurados (SUPPORT_EMAIL / SUPPORT_WHATSAPP).
export default function ContactPage({ lang, topic }: { lang: "pt" | "en"; topic?: string }) {
  const pt = lang === "pt";
  const support = supportChannels();
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          {pt ? "Fale com a gente" : "Talk to us"}
        </h1>
        <p className="mt-2 text-muted">
          {pt
            ? "Dúvidas, problemas de acesso, pagamentos ou pedidos sobre os seus dados. Respondemos por e-mail."
            : "Questions, sign-in problems, payments or requests about your data. We answer by email."}
        </p>
        {!pt && <p className="mt-1 text-xs text-muted">The form is in Portuguese; you can write in English.</p>}
      </div>
      {(support.email || support.whatsapp) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {support.email && (
            <a href={`mailto:${support.email}`} className="rounded-md border border-edge bg-surface-2 px-3 py-2 hover:border-accent">
              {support.email}
            </a>
          )}
          {support.whatsapp && (
            <a
              href={`https://wa.me/${support.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-edge bg-surface-2 px-3 py-2 hover:border-accent"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}
      <Card>
        <ContactForm initialTopic={topic} />
      </Card>
      <p className="text-sm text-muted">
        {pt ? "Veja também: " : "See also: "}
        <Link href={pt ? "/reembolso" : "/refunds"} className="text-accent hover:underline">
          {pt ? "reembolso e cancelamento" : "refunds and cancellation"}
        </Link>{" "}
        ·{" "}
        <Link href={pt ? "/privacidade" : "/privacy"} className="text-accent hover:underline">
          {pt ? "privacidade" : "privacy"}
        </Link>
      </p>
    </div>
  );
}
