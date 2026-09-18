"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-class";

// Erro inesperado dentro do app (a moldura continua). Mensagem neutra; o
// detalhe fica no log do servidor/console.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="full-bleed" data-testid="error-page">
      <div className="ed sec">
        <div className="ed-grid">
          <div className="c7">
            <p className="t6 text-text-muted">Erro</p>
            <h1 className="d2 mt-4">Algo deu errado</h1>
            <p className="t1 measure-lede mt-4 text-text-muted">
              Tente de novo. Se continuar, fale com a gente e cite o código abaixo.
            </p>
            <p className="t3 measure-lede mt-2 text-text-faint" lang="en">
              Something went wrong. Try again; if it keeps happening, contact us with the code
              below.
            </p>
            {error.digest && (
              <p className="t4 mt-6 border-t border-rule pt-3 font-mono text-text-muted">
                código: {error.digest}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={reset} className={buttonClass("primary")}>
                Tentar de novo · Retry
              </button>
              <Link href="/" className={buttonClass("secondary")}>
                Início · Home
              </Link>
              <Link href="/contato" className={buttonClass("secondary")}>
                Contato · Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
