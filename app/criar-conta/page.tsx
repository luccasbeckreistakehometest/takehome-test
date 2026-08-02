import Link from "next/link";
import RegistrationForm from "@/components/RegistrationForm";
import { Card } from "@/components/ui";

// Auto-cadastro aberto: qualquer um cria conta (cliente, profissional ou
// agência). Sem agência convidando → marca da plataforma (brandSource platform).
export default function CriarContaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <div className="text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Criar conta
        </h1>
        <p className="mt-2 text-sm text-muted">
          Comece grátis. Você pode evoluir para um plano depois.
        </p>
      </div>
      <Card>
        <RegistrationForm />
      </Card>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
