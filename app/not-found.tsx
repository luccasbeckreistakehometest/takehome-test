import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

// 404 da marca, em português e inglês (o tradutor da interface não roda aqui
// antes da hidratação, então as duas línguas aparecem juntas).
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center" data-testid="not-found">
      <p className="font-[family-name:var(--font-display)] text-6xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold">Não achamos esta página</h1>
      <p className="mt-2 text-muted">O link pode estar errado ou a página foi removida.</p>
      <p className="mt-1 text-sm text-muted" lang="en">
        We couldn&apos;t find this page. The link may be wrong or the page was removed.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90">
          Voltar ao início · Home
        </Link>
        <Link href="/contato" className="rounded-md border border-edge bg-surface-2 px-4 py-2 text-sm hover:border-accent">
          Falar com o suporte · Contact
        </Link>
      </div>
    </div>
  );
}
