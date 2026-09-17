import type { Metadata } from "next";
import ContactPage from "@/components/legal/ContactPage";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a equipe da Marqa: dúvidas, pagamentos, acesso e privacidade.",
  alternates: { canonical: "/contato", languages: { "pt-BR": "/contato", en: "/contact" } },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ assunto?: string }> }) {
  const { assunto } = await searchParams;
  return <ContactPage lang="pt" topic={assunto} />;
}
