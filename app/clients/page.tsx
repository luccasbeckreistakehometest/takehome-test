"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import { Card, Spinner, Tag } from "@/components/ui";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);

  useEffect(() => {
    api<Client[]>("/api/clients").then(setClients).catch(() => setClients([]));
  }, []);

  if (!clients) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando clientes..." />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="d2">
          Sua agência, <span className="text-text">centralizada</span>.
        </h1>
        <p className="mt-4 text-text-muted">
          Cadastre o briefing de um cliente uma única vez e gere estratégia com
          pesquisa real de mercado, plano de campanha, ROI com roadmap, calendário
          social, identidade visual e landing pages — tudo com IA, pronto para
          apresentar.
        </p>
        <Link
          href="/clients/new"
          className="mt-8 inline-block rounded-md bg-accent px-6 py-3 font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          Cadastrar primeiro cliente
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="d3">
          Clientes
        </h1>
        <Link
          href="/clients/new"
          className="rounded-md bg-accent px-4 py-2 t3 font-medium text-accent-ink transition-opacity hover:opacity-90"
        >
          + Novo cliente
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Link key={client.id} href={`/clients/${client.id}`}>
            <Card className="h-full transition-colors hover:border-edge">
              <p className="d4">
                {client.name}
              </p>
              {client.industry && (
                <p className="mt-0.5 t3 text-text-muted">{client.industry}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.channels.slice(0, 4).map((channel) => (
                  <Tag key={channel}>{channel}</Tag>
                ))}
                {client.channels.length > 4 && (
                  <Tag>+{client.channels.length - 4}</Tag>
                )}
              </div>
              <p className="mt-3 t5 text-text-muted">
                Desde{" "}
                {new Date(client.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
