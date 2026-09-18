"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Generation, GenerationType } from "@/lib/types";
import VersionCompare from "./VersionCompare";
import { actionCost } from "@/lib/plans";
import { Button, Card, ErrorBox, Input, Label, Select, Spinner, Textarea } from "./ui";

export type FieldConfig = {
  name: string;
  label: string;
  kind: "text" | "number" | "select";
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
};

export default function GeneratorTab({
  clientId,
  type,
  description,
  fields,
  generateLabel,
  loadingHint,
  render,
}: {
  clientId: string;
  type: GenerationType;
  description: string;
  fields: FieldConfig[];
  generateLabel: string;
  loadingHint?: string;
  render: (generation: Generation) => React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""]))
  );
  const [feedback, setFeedback] = useState("");
  const [refineFromSelected, setRefineFromSelected] = useState(false);
  const [history, setHistory] = useState<Generation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const selected = history.find((g) => g.id === selectedId) ?? null;

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const generations = await api<Generation[]>(
        `/api/generations?clientId=${clientId}&type=${type}`
      );
      setHistory(generations);
      setSelectedId((current) => current ?? generations[0]?.id ?? null);
    } catch {
      // histórico indisponível não bloqueia a aba
    } finally {
      setLoadingHistory(false);
    }
  }, [clientId, type]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Gerações concluídas no servidor (mesmo após refresh) recarregam o histórico
  useEffect(() => {
    const handler = () => loadHistory();
    window.addEventListener("jobs:changed", handler);
    return () => window.removeEventListener("jobs:changed", handler);
  }, [loadHistory]);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const params: Record<string, unknown> = { ...values };
      if (feedback.trim()) params.feedback = feedback.trim();
      if (refineFromSelected && selected) params.previous = selected.content;
      const generation = await api<Generation>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ clientId, type, params }),
      });
      setHistory((prev) => [generation, ...prev]);
      setSelectedId(generation.id);
      setFeedback("");
      setRefineFromSelected(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    await api(`/api/generations/${selected.id}`, { method: "DELETE" });
    setHistory((prev) => {
      const next = prev.filter((g) => g.id !== selected.id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <p className="text-sm text-muted">{description}</p>
        {fields.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <div key={field.name}>
                <Label>{field.label}</Label>
                {field.kind === "select" ? (
                  <Select
                    value={values[field.name]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                  >
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={field.kind === "number" ? "number" : "text"}
                    value={values[field.name]}
                    placeholder={field.placeholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div>
          <Label>Instruções adicionais / feedback da equipe (opcional)</Label>
          <Textarea
            value={feedback}
            placeholder="Ex.: focar mais no lançamento de outubro, evitar tom formal..."
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={generate} disabled={generating}>
            {generating ? "Gerando..." : generateLabel}
            {!generating && <span className="opacity-75">{` · ${actionCost(type)} coins`}</span>}
          </Button>
          {selected && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={refineFromSelected}
                onChange={(e) => setRefineFromSelected(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Refinar a partir da versão selecionada
            </label>
          )}
          {generating && (
            <Spinner label={loadingHint ?? "A IA está trabalhando — isso pode levar 1-3 minutos..."} />
          )}
        </div>
        {error && <ErrorBox message={error} />}
      </Card>

      {loadingHistory ? (
        <Spinner label="Carregando histórico..." />
      ) : history.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Nenhuma geração ainda. Preencha os parâmetros e clique em “{generateLabel}”.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {history.map((generation) => (
              <button
                key={generation.id}
                onClick={() => setSelectedId(generation.id)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  generation.id === selectedId
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-edge bg-surface text-muted hover:border-muted"
                }`}
              >
                {new Date(generation.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </button>
            ))}
            {selected && (
              <span className="ml-auto flex items-center gap-2">
                <a
                  href={`/print/${selected.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-edge bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                >PDF
                </a>
                <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={removeSelected}>
                  Excluir versão
                </Button>
              </span>
            )}
          </div>
          {selected && (
            <div>
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">
                {selected.title}
              </h2>
              <SafeRender generation={selected} render={render} />
            </div>
          )}
          {history.length >= 2 && (
            <details className="rounded-lg border border-edge bg-surface-2">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-foreground">
                Comparar versões lado a lado
              </summary>
              <div className="border-t border-edge p-4">
                <VersionCompare clientId={clientId} type={type} />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function SafeRender({
  generation,
  render,
}: {
  generation: Generation;
  render: (generation: Generation) => React.ReactNode;
}) {
  try {
    return <>{render(generation)}</>;
  } catch {
    return (
      <Card>
        <p className="mb-2 text-sm text-muted">
          Não foi possível renderizar esta versão — conteúdo bruto:
        </p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-xs text-muted">
          {generation.content}
        </pre>
      </Card>
    );
  }
}
