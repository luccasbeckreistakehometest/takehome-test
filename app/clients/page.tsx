"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import { Dash, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { buttonClass } from "@/lib/button-class";

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
      <div className="max-w-[46rem]">
        <PageHeader eyebrow="Agência" title="Clientes" />
        <EmptyState
          icon="briefcase"
          title="Sua agência, centralizada"
          condition="Cadastre o briefing de um cliente uma única vez e gere estratégia com pesquisa real de mercado, plano de campanha, ROI com roadmap, calendário social, identidade visual e landing pages — tudo com IA, pronto para apresentar."
          action={
            <Link href="/clients/new" className={buttonClass("primary")}>
              Cadastrar primeiro cliente
            </Link>
          }
        />
      </div>
    );
  }

  return (
    // Carteira é DADO: tabela com régua fina, não uma grade de cartões com o
    // nome do cliente em manchete. O nome alinha na coluna e a data é tabular.
    <div>
      <PageHeader
        eyebrow="Agência"
        title="Clientes"
        actions={
          <Link href="/clients/new" className={buttonClass("primary")}>
            Novo cliente
          </Link>
        }
      />
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[20%]" />
          <col className="w-[30%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-edge">
            <th className="t6 pb-2 text-text-muted">Cliente</th>
            <th className="t6 pb-2 text-text-muted">Segmento</th>
            <th className="t6 pb-2 text-text-muted">Canais</th>
            <th className="t6 pb-2 text-right text-text-muted">Desde</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              className="border-b border-rule align-baseline transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
            >
              <td className="py-2.5">
                <Link href={`/clients/${client.id}`} className="t3 block truncate font-medium">
                  {client.name}
                </Link>
              </td>
              <td className="t4 truncate py-2.5 text-text-muted">{client.industry || <Dash />}</td>
              <td className="t4 truncate py-2.5 text-text-muted">
                {client.channels.length ? client.channels.join(" · ") : <Dash />}
              </td>
              <td className="t5 tnum py-2.5 text-right text-text-muted">
                {new Date(client.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
