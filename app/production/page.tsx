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
import { Density, EmptyState, ErrorBox, Field, Select, Skeleton, Spinner, Tag } from "@/components/ui";
import { buttonClass } from "@/lib/button-class";

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

  return (
    // Densidade `compact` (§4.4): o kanban é ferramenta.
    <Density value="compact" className="space-y-6" data-testid="production-page">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-5">
        <div>
          <h1 className="d3">Produção</h1>
          <p className="t3 measure-lede mt-2 text-text-muted">Arraste os cards entre as colunas para mudar a etapa do pipeline.</p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
          <Field label="Filtrar por cliente">
            {(field) => (
              <Select {...field} value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="sm:w-56">
                <option value="all">Todos os clientes</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {/* O único elemento expressivo desta tela (§5.5): o board não tinha
              nenhum — e produção existe para PÔR trabalho no board. */}
          <Link
            href={clientFilter === "all" ? "/clients" : `/clients/${clientFilter}?tab=projects`}
            className={buttonClass("primary")}
            data-testid="production-new"
            title={clientFilter === "all" ? "Escolha o cliente da demanda" : undefined}
          >
            Nova demanda
          </Link>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {projects === null ? (
        // Esqueleto com A MESMA caixa do board — não um spinner no vazio (§11.4).
        <div className="scroll-x flex gap-3 pb-4" aria-busy="true" aria-label="Carregando o board">
          {PROJECT_STATUSES.map((status) => (
            <div key={status} className="w-64 shrink-0 space-y-2 p-2">
              <Skeleton className="h-3 w-24" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-sm" />
              ))}
            </div>
          ))}
        </div>
      ) : (
      <div className="scroll-x flex gap-3 pb-4">
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
              className={`w-64 shrink-0 rounded-md border p-2 transition-colors ${
                isOver ? "border-edge bg-surface-sunken" : "border-transparent"
              }`}
            >
              <p className="mb-2 flex items-center justify-between px-1 t6 text-text-muted">
                {PROJECT_STATUS_LABELS[status]}
                <span className="tnum text-text-muted">{column.length}</span>
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
                      className={`block cursor-grab rounded-sm border border-edge bg-surface p-3 t3 transition-colors hover:border-edge active:cursor-grabbing ${
                        isDragging ? "opacity-40" : ""
                      }`}
                    >
                      <p className="font-medium">{project.title}</p>
                      <p className="mt-1 t5 text-text-muted">
                        {clients[project.clientId] ?? "—"}
                        {project.deadline && ` · até ${project.deadline}`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        {project.mode === "internal" && <Tag>interna</Tag>}
                        {project.escrow === "held" && <Tag>escrow</Tag>}
                        {isSaving && (
                          <span className="ml-auto t5 text-text-muted">
                            <Spinner />
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {column.length === 0 && (
                  // §9.4: o estado vazio diz o que VAI aparecer aqui. Era a
                  // palavra "vazio".
                  <p className="grid min-h-20 place-items-center rounded-sm border border-dashed border-rule p-3 text-center t5 text-text-muted">
                    {isOver ? "Solte aqui" : "As demandas desta etapa aparecem aqui"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {projects !== null && projects.length === 0 && (
        <EmptyState
          icon="layers"
          title="As demandas de todos os clientes aparecem aqui, uma coluna por etapa."
          condition="A primeira entra pela aba Demandas de um cliente."
          action={
            <Link href="/clients" className={buttonClass("secondary")}>
              Escolher um cliente
            </Link>
          }
        />
      )}
    </Density>
  );
}
