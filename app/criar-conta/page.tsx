import type { Metadata } from "next";
import Link from "next/link";
import RegistrationForm from "@/components/RegistrationForm";
import { Card } from "@/components/ui";
import { agencySelfSignupEnabled } from "@/lib/legal";
import { getPlan, isBillingPeriod } from "@/lib/plans";

type Role = "client" | "professional" | "agency";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta na Marqa: marca, profissional ou agência. Comece no plano grátis.",
  alternates: { canonical: "/criar-conta" },
};

// Auto-cadastro. ?type= vindo dos funis pré-seleciona o tipo (dá para trocar);
// ?plan=&period= vindos da tabela de preços levam direto ao pagamento.
export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; plan?: string; period?: string }>;
}) {
  const { type, plan, period } = await searchParams;
  const chosen = plan ? getPlan(plan) : undefined;
  const initialRole = (["client", "professional", "agency"] as Role[]).includes(type as Role)
    ? (type as Role)
    : (chosen?.accountType as Role | undefined);
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">Criar conta</h1>
        <p className="mt-2 text-sm text-muted">
          {chosen && chosen.monthlyPrice > 0
            ? `Plano escolhido: ${chosen.name}. Depois do cadastro você vai direto para o pagamento (pré-pago, sem renovação automática).`
            : "Comece grátis. Você pode evoluir para um plano depois."}
        </p>
      </div>
      <Card>
        <RegistrationForm
          initialRole={initialRole}
          agencySignupOpen={agencySelfSignupEnabled()}
          plan={chosen && chosen.monthlyPrice > 0 ? chosen.id : undefined}
          period={isBillingPeriod(period) ? period : undefined}
        />
      </Card>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="text-text hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
