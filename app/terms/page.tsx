import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { TERMS_EN } from "@/lib/legal-content-en";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Rules for using Marqa: accounts, AI, prepaid plans and liability.",
  alternates: {
    canonical: "/terms",
    languages: { "pt-BR": "/termos", en: "/terms" },
  },
};

export default function Page() {
  return <LegalPage doc={TERMS_EN} />;
}
