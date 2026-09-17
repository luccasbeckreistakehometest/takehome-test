import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { PRO } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Marqa para fotógrafos e designers",
  description: "Perfil com portfólio, demandas abertas de agências e marcas, elo que sobe com entregas bem avaliadas. Comece grátis.",
  alternates: { canonical: "/para-profissionais" },
  openGraph: { title: "Marqa para fotógrafos e designers", description: "Perfil com portfólio, demandas abertas de agências e marcas, elo que sobe com entregas bem avaliadas. Comece grátis.", url: "/para-profissionais" },
};

export default function Page() {
  return <LandingPage config={PRO} />;
}
