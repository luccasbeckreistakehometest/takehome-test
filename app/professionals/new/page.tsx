"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProfessionalForm from "@/components/ProfessionalForm";
import OneTimeLogin, { type OneTimeLoginData } from "@/components/OneTimeLogin";
import type { Professional } from "@/lib/marketplace-types";

export default function NewProfessionalPage() {
  const router = useRouter();
  const [created, setCreated] = useState<{ professional: Professional; login: OneTimeLoginData } | null>(null);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Cadastro de profissional</h1>
        <p className="mt-1 text-sm text-muted">
          Fotógrafo(a) ou designer: preencha o perfil para receber demandas com fit real — o match considera skills,
          localização, especialidade e o histórico de entregas na plataforma.
        </p>
      </div>
      {created ? (
        <OneTimeLogin
          who={created.professional.name}
          login={created.login}
          continueLabel="Abrir o perfil"
          onContinue={() => router.push(`/professionals/${created.professional.id}`)}
        />
      ) : (
        <ProfessionalForm
          onSaved={(professional) => {
            const login = (professional as Professional & { login?: OneTimeLoginData }).login;
            if (login) setCreated({ professional, login });
            else router.push(`/professionals/${professional.id}`);
          }}
        />
      )}
    </div>
  );
}
