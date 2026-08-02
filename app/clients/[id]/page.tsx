"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import Workspace from "@/components/Workspace";
import { Spinner } from "@/components/ui";

export default function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api<Client>(`/api/clients/${id}`)
      .then(setClient)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted">Cliente não encontrado.</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">
          ← Voltar para clientes
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando cliente..." />
      </div>
    );
  }

  return <Workspace client={client} onClientUpdated={setClient} />;
}
