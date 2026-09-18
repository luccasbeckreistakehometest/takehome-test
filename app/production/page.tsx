"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from "@/lib/marketplace-types";
import { ErrorBox, Select, Spinner, Tag } from "@/components/ui";
import { Icon } from "@/components/icons";

// Kanban de produção: todas as demandas de todos os clientes por status.
// Arraste os cards entre as colunas para mudar o status (HTML5 drag & drop),
// e filtre o board por cliente.
export default function ProductionPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    return api<Project[]>("/api/projects").then(setProjects);
  }, []);

  useEffect(() => {
    refetch();
    api<Client[]>("/api/clients").then((list) =>
      setClients(Object.fromEntries(list.map((client) => [client.id, client.name])))
    );
  }, [refetch]);

  // Clientes que realmente têm demandas no board — popula o filtro só com o
  // que existe, evitando opções mortas.
  const clientOptions = useMemo(() => {
    if (!projects) return [];
    const ids = Array.from(new Set(projects.map((project) => project.clientId)));
    return ids
      .map((id) => ({ id, name: clients[id] ?? "Cliente sem nome" }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [projects, clients]);

  const visible = useMemo(() => {
    if (!projects) return [];
    return clientFilter === "all"
      ? projects
      : projects.filter((project) => project.clientId === clientFilter);
  }, [projects, clientFilter]);

  // Move a demanda para outro status: update otimista, PATCH e refetch.
  // Em caso de erro reverte recarregando o estado real do servidor.
  const moveProject = useCallback(
    async (projectId: string, status: ProjectStatus) => {
      setError(null);
      let changed = false;
      setProjects((prev) => {
        if (!prev) return prev;
        return prev.map((project) => {
          if (project.id !== projectId || project.status === status) return project;
          changed = true;
          return { ...project, status };
        });
      });
      if (!changed) return; // mesma coluna ou id inexistente
      setSavingId(projectId);
      try {
        await api<Project>(`/api/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao mover a demanda");
        await refetch();
      } finally {
        setSavingId(null);
      }
    },
    [refetch]
  );

  if (!projects) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Carregando produção..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Produção
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <Icon name="kanban" size={15} />
            Arraste os cards entre as colunas para mudar a etapa do pipeline.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Filtrar por cliente
          </label>
          <Select
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
          >
            <option value="all">Todos os clientes</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {PROJECT_STATUSES.map((status) => {
          const column = visible.filter((project) => project.status === status);
          const isOver = dragOverStatus === status;
          return (
            <div
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dragOverStatus !== status) setDragOverStatus(status);
              }}
              onDragLeave={(event) => {
                // só limpa quando o ponteiro sai de fato da coluna
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragOverStatus((current) => (current === status ? null : current));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || draggingId;
                setDragOverStatus(null);
                setDraggingId(null);
                if (id) moveProject(id, status);
              }}
              className={`w-64 shrink-0 rounded-xl border p-2 transition-colors ${
                isOver ? "border-accent bg-accent/5" : "border-transparent"
              }`}
            >
              <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {PROJECT_STATUS_LABELS[status]}
                <span className="rounded-full bg-surface-2 px-2 py-0.5">{column.length}</span>
              </p>
              <div className="min-h-24 space-y-2">
                {column.map((project) => {
                  const isDragging = draggingId === project.id;
                  const isSaving = savingId === project.id;
                  return (
                    <Link
                      key={project.id}
                      href={`/clients/${project.clientId}?project=${project.id}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", project.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(project.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                      className={`block cursor-grab rounded-lg border border-edge bg-surface p-3 text-sm transition-colors hover:border-accent/60 active:cursor-grabbing ${
                        isDragging ? "opacity-40" : ""
                      }`}
                    >
                      <p className="font-medium">{project.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {clients[project.clientId] ?? "—"}
                        {project.deadline && ` · até ${project.deadline}`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        {project.mode === "internal" && <Tag>interna</Tag>}
                        {project.escrow === "held" && <Tag>escrow</Tag>}
                        {isSaving && (
                          <span className="ml-auto text-xs text-muted">
                            <Spinner />
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {column.length === 0 && (
                  <p className="rounded-lg border border-dashed border-edge p-3 text-center text-xs text-muted">
                    {isOver ? "soltar aqui" : "vazio"}
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
