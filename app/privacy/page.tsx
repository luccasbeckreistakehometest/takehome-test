import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { PRIVACY_EN } from "@/lib/legal-content-en";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Marqa processes personal data under Brazil's LGPD: purposes, legal bases, sub-processors and your rights.",
  alternates: {
    canonical: "/privacy",
    languages: { "pt-BR": "/privacidade", en: "/privacy" },
  },
};

export default function Page() {
  return <LegalPage doc={PRIVACY_EN} />;
}
