import type { Metadata } from "next";
import Link from "next/link";
import AccessRequestForm from "@/components/AccessRequestForm";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pedir acesso para agências",
  description: "Agências entram na Marqa por convite. Conte sobre a sua e liberamos o acesso.",
  alternates: { canonical: "/pedir-acesso" },
};

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Acesso para agências</h1>
        <p className="mt-2 text-muted">
          Marcas e profissionais criam conta na hora.{" "}
          <Link href="/criar-conta" className="text-accent hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
      <Card>
        <AccessRequestForm />
      </Card>
    </div>
  );
}
