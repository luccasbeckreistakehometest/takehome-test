import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { COOKIES_EN } from "@/lib/legal-content-en";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Marqa only uses an essential sign-in cookie.",
  alternates: {
    canonical: "/cookie-policy",
    languages: { "pt-BR": "/cookies", en: "/cookie-policy" },
  },
};

export default function Page() {
  return <LegalPage doc={COOKIES_EN} />;
}
