import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { REFUNDS_EN } from "@/lib/legal-content-en";

export const metadata: Metadata = {
  title: "Refund and cancellation",
  description: "7-day cooling-off, refunds and how Marqa prepaid plans end.",
  alternates: {
    canonical: "/refunds",
    languages: { "pt-BR": "/reembolso", en: "/refunds" },
  },
};

export default function Page() {
  return <LegalPage doc={REFUNDS_EN} />;
}
