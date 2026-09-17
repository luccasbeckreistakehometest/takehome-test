import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { PRIVACY_PT } from "@/lib/legal-content-pt";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como a Marqa trata dados pessoais conforme a LGPD: finalidades, bases legais, suboperadores e seus direitos.",
  alternates: {
    canonical: "/privacidade",
    languages: { "pt-BR": "/privacidade", en: "/privacy" },
  },
};

export default function Page() {
  return <LegalPage doc={PRIVACY_PT} />;
}
