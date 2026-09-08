import Link from "next/link";
import RegistrationForm from "@/components/RegistrationForm";
import { Card } from "@/components/ui";

type Role = "client" | "professional" | "agency";

// Auto-cadastro aberto: qualquer um cria conta (cliente, profissional ou
// agência). Sem agência convidando → marca da plataforma (brandSource platform).
// ?type= vindo dos funis pré-seleciona o tipo (mas o usuário pode trocar).
export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const initialRole = (["client", "professional", "agency"] as Role[]).includes(type as Role)
    ? (type as Role)
    : undefined;
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
        <RegistrationForm initialRole={initialRole} />
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
