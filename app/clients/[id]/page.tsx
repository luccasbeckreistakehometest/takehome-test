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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    // Timeout defensivo: alguns webviews (ex.: navegador embutido do VS Code)
    // deixam requests pendurados — nunca ficar em spinner eterno
    fetch(`/api/clients/${id}`, { signal: AbortSignal.timeout(15000) })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setClient((await response.json()) as Client);
      })
      .catch(() => setFailed(true));
  }, [id, attempt]);

  if (failed) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted">
          Não consegui carregar este cliente (conexão lenta, navegador limitado ou
          cliente inexistente).
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Tentar de novo
          </button>
          <Link href="/" className="text-accent hover:underline">
            ← Voltar para clientes
          </Link>
        </div>
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
