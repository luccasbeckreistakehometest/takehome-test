import type { Metadata } from "next";
import ContactPage from "@/components/legal/ContactPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Marqa team: questions, payments, access and privacy.",
  alternates: { canonical: "/contact", languages: { "pt-BR": "/contato", en: "/contact" } },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return <ContactPage lang="en" topic={topic} />;
}
