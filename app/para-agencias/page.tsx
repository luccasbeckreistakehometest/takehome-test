import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { AGENCY } from "@/lib/landing-content";

export const metadata: Metadata = {
  title: "Marqa para agências",
  description: "Atenda mais clientes com o mesmo time: briefing falado, kit de estratégia e conteúdo com IA, aprovação do cliente, relatório mensal, horas e margem por cliente.",
  alternates: { canonical: "/para-agencias" },
  openGraph: { title: "Marqa para agências", description: "Atenda mais clientes com o mesmo time: briefing falado, kit de estratégia e conteúdo com IA, aprovação do cliente, relatório mensal, horas e margem por cliente.", url: "/para-agencias" },
};

export default function Page() {
  return <LandingPage config={AGENCY} />;
}
