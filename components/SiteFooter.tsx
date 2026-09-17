import Link from "next/link";
import { legalIdentity, supportChannels } from "@/lib/legal";

// Rodapé de todas as páginas: documentos legais e contato.
export default function SiteFooter({ brandName, tagline }: { brandName: string; tagline: string }) {
  const identity = legalIdentity();
  const support = supportChannels();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-edge py-6 text-xs text-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {brandName} — {tagline}
          {identity.name ? ` · © ${year} ${identity.name}` : ""}
          {identity.document ? ` · ${identity.document}` : ""}
        </p>
        <nav aria-label="Links institucionais" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/termos" className="hover:text-foreground">Termos</Link>
          <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
          <Link href="/reembolso" className="hover:text-foreground">Reembolso</Link>
          <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
          <Link href="/contato" className="hover:text-foreground">Contato</Link>
          {support.whatsapp && (
            <a href={`https://wa.me/${support.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              WhatsApp
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
