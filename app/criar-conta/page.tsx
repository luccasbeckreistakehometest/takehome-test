import type { Metadata } from "next";
import Link from "next/link";
import RegistrationForm from "@/components/RegistrationForm";
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
    <div className="full-bleed">
      <div className="ed sec">
        <div className="ed-grid">
          <div className="c5">
            <p className="t6 text-text-muted">Marqa</p>
            <h1 className="d2 mt-4">Criar conta</h1>
            <p className="t1 measure-lede mt-4 text-text-muted">
              {chosen && chosen.monthlyPrice > 0
                ? `Plano escolhido: ${chosen.name}. Depois do cadastro você vai direto para o pagamento (pré-pago, sem renovação automática).`
                : "Comece grátis. Você pode evoluir para um plano depois."}
            </p>
            <p className="t3 mt-8 border-t border-rule pt-4 text-text-muted">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium text-text underline underline-offset-4">
                Entrar
              </Link>
            </p>
          </div>
          <div className="c6 c-start7">
            <RegistrationForm
              initialRole={initialRole}
              agencySignupOpen={agencySelfSignupEnabled()}
              plan={chosen && chosen.monthlyPrice > 0 ? chosen.id : undefined}
              period={isBillingPeriod(period) ? period : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
