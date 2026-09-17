import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { AGENCY, landingFor } from "@/lib/landing-content";
import { subscriptionsAvailable } from "@/lib/mercadopago";

// Dinâmica: a assinatura no cartão depende do Mercado Pago deste servidor.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marqa para agências",
  description: "Atenda mais clientes com o mesmo time: aprovação por link, escopo sob controle, fatura Pix sem taxa, relatório mensal e briefing falado com IA.",
  alternates: { canonical: "/para-agencias" },
  openGraph: { title: "Marqa para agências", description: "Atenda mais clientes com o mesmo time: aprovação por link, escopo sob controle, fatura Pix sem taxa, relatório mensal e briefing falado com IA.", url: "/para-agencias" },
};

export default function Page() {
  const card = subscriptionsAvailable();
  return <LandingPage config={landingFor(AGENCY, card)} cardSubscription={card} />;
}
