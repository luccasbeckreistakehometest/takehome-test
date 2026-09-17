import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { REFUNDS_PT } from "@/lib/legal-content-pt";

export const metadata: Metadata = {
  title: "Reembolso e cancelamento",
  description: "Arrependimento em 7 dias, estornos e fim dos planos pré-pagos da Marqa.",
  alternates: {
    canonical: "/reembolso",
    languages: { "pt-BR": "/reembolso", en: "/refunds" },
  },
};

export default function Page() {
  return <LegalPage doc={REFUNDS_PT} />;
}
