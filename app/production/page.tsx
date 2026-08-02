"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
} from "@/lib/marketplace-types";
import { Spinner, Tag } from "@/components/ui";

// Kanban de produção: todas as demandas de todos os clientes por status
export default function ProductionPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Record<string, string>>({});

  useEffect(() => {
    api<Project[]>("/api/projects").then(setProjects);
    api<Client[]>("/api/clients").then((list) =>
      setClients(Object.fromEntries(list.map((client) => [client.id, client.name])))
    );
  }, []);

  if (!projects) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando produção..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Produção
        </h1>
        <p className="mt-1 text-sm text-muted">
          Todas as demandas de todos os clientes, por etapa do pipeline.
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PROJECT_STATUSES.map((status) => {
          const column = projects.filter((project) => project.status === status);
          return (
            <div key={status} className="w-64 shrink-0">
              <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                {PROJECT_STATUS_LABELS[status]}
                <span className="rounded-full bg-surface-2 px-2 py-0.5">{column.length}</span>
              </p>
              <div className="space-y-2">
                {column.map((project) => (
                  <Link
                    key={project.id}
                    href={`/clients/${project.clientId}?project=${project.id}`}
                    className="block rounded-lg border border-edge bg-surface p-3 text-sm transition-colors hover:border-accent/60"
                  >
                    <p className="font-medium">{project.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {clients[project.clientId] ?? "—"}
                      {project.deadline && ` · até ${project.deadline}`}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      {project.mode === "internal" && <Tag>🏠 interna</Tag>}
                      {project.escrow === "held" && <Tag>💰 escrow</Tag>}
                    </div>
                  </Link>
                ))}
                {column.length === 0 && (
                  <p className="rounded-lg border border-dashed border-edge p-3 text-center text-xs text-muted">
                    vazio
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
