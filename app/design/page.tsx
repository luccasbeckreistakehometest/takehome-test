import type { Metadata } from "next";
import Gallery from "./Gallery";

// A galeria do sistema: é assim que o sistema é OLHADO, não lido em diff.
// Fora do sitemap, negada no robots.ts e noindex aqui — existe para quem
// desenha e para quem revisa, não para busca.
export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false, nocache: true },
};

export default function DesignPage() {
  return <Gallery />;
}
