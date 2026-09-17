import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { PRO, landingFor } from "@/lib/landing-content";
import { subscriptionsAvailable } from "@/lib/mercadopago";

// Dinâmica: a assinatura no cartão depende do Mercado Pago deste servidor.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marqa para fotógrafos e designers",
  description: "Perfil com portfólio, demandas abertas de agências e marcas, elo que sobe com entregas bem avaliadas. Comece grátis.",
  alternates: { canonical: "/para-profissionais" },
  openGraph: { title: "Marqa para fotógrafos e designers", description: "Perfil com portfólio, demandas abertas de agências e marcas, elo que sobe com entregas bem avaliadas. Comece grátis.", url: "/para-profissionais" },
};

export default function Page() {
  const card = subscriptionsAvailable();
  return <LandingPage config={landingFor(PRO, card)} cardSubscription={card} />;
}
