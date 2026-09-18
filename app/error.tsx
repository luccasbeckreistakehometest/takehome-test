"use client";

import { useEffect } from "react";
import Link from "next/link";

// Erro inesperado dentro do app (a moldura continua). Mensagem neutra; o
// detalhe fica no log do servidor/console.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-xl py-16 text-center" data-testid="error-page">
      <h1 className="d3">Algo deu errado</h1>
      <p className="mt-2 text-text-muted">Tente de novo. Se continuar, fale com a gente e cite o código abaixo.</p>
      <p className="mt-1 t3 text-text-muted" lang="en">
        Something went wrong. Try again; if it keeps happening, contact us with the code below.
      </p>
      {error.digest && <p className="mt-3 font-mono t5 text-text-muted">código: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-accent px-4 py-2 t3 font-medium text-accent-ink hover:opacity-90">
          Tentar de novo · Retry
        </button>
        <Link href="/" className="rounded-md border border-edge bg-surface-sunken px-4 py-2 t3 hover:border-edge">
          Início · Home
        </Link>
        <Link href="/contato" className="rounded-md border border-edge bg-surface-sunken px-4 py-2 t3 hover:border-edge">
          Contato · Contact
        </Link>
      </div>
    </div>
  );
}
