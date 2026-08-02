"use client";

import { useRouter } from "next/navigation";
import ProfessionalForm from "@/components/ProfessionalForm";

export default function NewProfessionalPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Cadastro de profissional
        </h1>
        <p className="mt-1 text-sm text-muted">
          Fotógrafo(a) ou designer: preencha seu perfil para receber demandas com
          fit real — o match considera skills, localização, especialidade e seu
          histórico de entregas na plataforma.
        </p>
      </div>
      <ProfessionalForm
        onSaved={(professional) => router.push(`/professionals/${professional.id}`)}
      />
    </div>
  );
}
