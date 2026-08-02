"use client";

import { useRouter } from "next/navigation";
import ClientForm from "@/components/ClientForm";

export default function NewClientPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Novo cliente
        </h1>
        <p className="mt-1 text-sm text-muted">
          Quanto mais completo o briefing, mais certeiros os entregáveis da IA.
          Tudo pode ser editado depois.
        </p>
      </div>
      <ClientForm onSaved={(client) => router.push(`/clients/${client.id}`)} />
    </div>
  );
}
