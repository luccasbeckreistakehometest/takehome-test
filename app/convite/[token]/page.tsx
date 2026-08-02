"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import RegistrationForm from "@/components/RegistrationForm";
import { Card, Spinner } from "@/components/ui";

type Lookup = { valid: boolean; reason?: string; role?: "client" | "professional" | "agency"; note?: string };

const ROLE_LABEL: Record<string, string> = {
  client: "cliente",
  professional: "profissional",
  agency: "agência",
};

// Página de convite: valida o token e mostra o cadastro do papel convidado.
// Quem entra por aqui fica com a marca whitelabel da agência (brandSource=agency).
export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Lookup | null>(null);

  useEffect(() => {
    api<Lookup>(`/api/invites/${token}`).then(setData).catch(() => setData({ valid: false, reason: "not_found" }));
  }, [token]);

  if (!data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Validando convite..." />
      </div>
    );
  }

  if (!data.valid) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Convite indisponível</h1>
        <p className="mt-3 text-muted">
          {data.reason === "expired"
            ? "Este convite expirou."
            : data.reason === "accepted"
              ? "Este convite já foi utilizado."
              : "Convite não encontrado ou revogado."}
        </p>
        <Link href="/criar-conta" className="mt-4 inline-block text-accent hover:underline">
          Criar uma conta →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-accent">Você foi convidado</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
          Cadastro de {ROLE_LABEL[data.role ?? "client"]}
        </h1>
        {data.note && <p className="mt-2 text-sm text-muted">{data.note}</p>}
      </div>
      <Card>
        <RegistrationForm fixedRole={data.role} token={token} />
      </Card>
    </div>
  );
}
