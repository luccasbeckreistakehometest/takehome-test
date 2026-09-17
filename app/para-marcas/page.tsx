import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { CLIENT } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Marqa para marcas",
  description: "Estratégia, calendário de 30 dias e posts no tom da sua marca, com IA — sozinho ou com a sua agência. Comece grátis.",
  alternates: { canonical: "/para-marcas" },
  openGraph: { title: "Marqa para marcas", description: "Estratégia, calendário de 30 dias e posts no tom da sua marca, com IA — sozinho ou com a sua agência. Comece grátis.", url: "/para-marcas" },
};

export default function Page() {
  return <LandingPage config={CLIENT} />;
}
