import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { CLIENT, landingFor } from "@/lib/landing-content";
import { subscriptionsAvailable } from "@/lib/mercadopago";

// Dinâmica: a assinatura no cartão depende do Mercado Pago deste servidor.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marqa para marcas",
  description: "Estratégia, calendário de 30 dias e posts no tom da sua marca, com IA — sozinho ou com a sua agência. Comece grátis.",
  alternates: { canonical: "/para-marcas" },
  openGraph: { title: "Marqa para marcas", description: "Estratégia, calendário de 30 dias e posts no tom da sua marca, com IA — sozinho ou com a sua agência. Comece grátis.", url: "/para-marcas" },
};

export default function Page() {
  const card = subscriptionsAvailable();
  return <LandingPage config={landingFor(CLIENT, card)} cardSubscription={card} />;
}
