import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/lib/button-class";
import { displayStyle } from "@/lib/type";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

// 404 da marca, em português e inglês (o tradutor da interface não roda aqui
// antes da hidratação, então as duas línguas aparecem juntas).
//
// Split editorial em vez de bloco centrado: o numeral é a peça, e ele usa
// displayStyle(160) porque 160px está fora da escala .d1–.d4 e o eixo óptico
// do Fraunces precisa acompanhar o tamanho (§3.3.2).
export default function NotFound() {
  return (
    <div className="full-bleed" data-testid="not-found">
      <div className="ed sec">
        <div className="ed-grid">
          <div className="c4">
            <p className="tnum leading-none" style={displayStyle(120, { soft: 20, weight: 400 })}>
              404
            </p>
          </div>
          <div className="c7 c-start6">
            <h1 className="d2">Não achamos esta página</h1>
            <p className="t1 measure-lede mt-4 text-text-muted">
              O link pode estar errado ou a página foi removida.
            </p>
            <p className="t3 measure-lede mt-2 text-text-muted" lang="en">
              We couldn&apos;t find this page. The link may be wrong or the page was removed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className={buttonClass("primary")}>
                Voltar ao início · Home
              </Link>
              <Link href="/contato" className={buttonClass("secondary")}>
                Falar com o suporte · Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
