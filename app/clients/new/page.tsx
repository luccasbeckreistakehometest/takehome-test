"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientForm from "@/components/ClientForm";
import OneTimeLogin, { type OneTimeLoginData } from "@/components/OneTimeLogin";
import type { Client } from "@/lib/types";

export default function NewClientPage() {
  const router = useRouter();
  const [created, setCreated] = useState<{ client: Client; login: OneTimeLoginData } | null>(null);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="d3">Novo cliente</h1>
        <p className="mt-1 t3 text-text-muted">
          Quanto mais completo o briefing, mais certeiros os entregáveis da IA. Tudo pode ser editado depois.
        </p>
      </div>
      {created ? (
        <OneTimeLogin
          who={created.client.name}
          login={created.login}
          continueLabel="Abrir o cliente"
          onContinue={() => router.push(`/clients/${created.client.id}`)}
        />
      ) : (
        <ClientForm
          onSaved={(client) => {
            const login = (client as Client & { login?: OneTimeLoginData }).login;
            if (login) setCreated({ client, login });
            else router.push(`/clients/${client.id}`);
          }}
        />
      )}
    </div>
  );
}
