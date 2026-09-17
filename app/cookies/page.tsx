import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { COOKIES_PT } from "@/lib/legal-content-pt";

export const metadata: Metadata = {
  title: "Política de Cookies",
  description: "A Marqa usa só o cookie essencial de login.",
  alternates: {
    canonical: "/cookies",
    languages: { "pt-BR": "/cookies", en: "/cookie-policy" },
  },
};

export default function Page() {
  return <LegalPage doc={COOKIES_PT} />;
}
