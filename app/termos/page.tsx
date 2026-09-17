import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { TERMS_PT } from "@/lib/legal-content-pt";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Regras de uso da Marqa: contas, IA, planos pré-pagos e responsabilidades.",
  alternates: {
    canonical: "/termos",
    languages: { "pt-BR": "/termos", en: "/terms" },
  },
};

export default function Page() {
  return <LegalPage doc={TERMS_PT} />;
}
