"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  GENERATION_LABELS,
  type Generation,
  type GenerationType,
} from "@/lib/types";
import { GenerationContent } from "./renderers";
import { Card, ErrorBox, SectionTitle, Select, Spinner, Tag } from "./ui";
import { Icon } from "@/components/icons";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Uma coluna da comparação: seletor de versão no topo + conteúdo renderizado.
function VersionColumn({
  label,
  versions,
  selectedId,
  onSelect,
  latestId,
}: {
  label: string;
  versions: Generation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  latestId: string | null;
}) {
  const generation = versions.find((v) => v.id === selectedId) ?? null;
  const total = versions.length;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-edge bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text">
            <Icon name="doc" size={14} /> Versão {label}
          </span>
          {generation && generation.id === latestId && <Tag>mais recente</Tag>}
        </div>
        <Select value={selectedId ?? ""} onChange={(e) => onSelect(e.target.value)}>
          {versions.map((v, i) => (
            <option key={v.id} value={v.id}>
              {`v${total - i} · ${formatDate(v.createdAt)}`}
            </option>
          ))}
        </Select>
        {generation && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
            <Icon name="clock" size={13} /> Gerada em {formatDate(generation.createdAt)}
          </p>
        )}
      </div>
      {generation ? (
        // key por id garante remount quando a versão muda (renderers com estado
        // interno, como o calendário social, reinicializam a partir do novo dado)
        <div key={generation.id}>
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-base font-semibold">
            {generation.title}
          </h3>
          <GenerationContent generation={generation} />
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted">Selecione uma versão.</p>
      )}
    </div>
  );
}

export default function VersionCompare({
  clientId,
  type,
}: {
  clientId: string;
  type: GenerationType;
}) {
  const [versions, setVersions] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [idA, setIdA] = useState<string | null>(null);
  const [idB, setIdB] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api<Generation[]>(
        `/api/generations?clientId=${clientId}&type=${type}`
      );
      setVersions(list);
      // Default: as duas mais recentes (A = mais recente, B = anterior)
      setIdA((current) =>
        current && list.some((v) => v.id === current) ? current : list[0]?.id ?? null
      );
      setIdB((current) =>
        current && list.some((v) => v.id === current)
          ? current
          : list[1]?.id ?? list[0]?.id ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar versões");
    } finally {
      setLoading(false);
    }
  }, [clientId, type]);

  useEffect(() => {
    load();
  }, [load]);

  // Recarrega quando uma nova geração é concluída no servidor (mesmo evento
  // usado pela aba de geração), para a comparação ficar sempre atualizada.
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("jobs:changed", handler);
    return () => window.removeEventListener("jobs:changed", handler);
  }, [load]);

  const label = GENERATION_LABELS[type];
  const latestId = versions[0]?.id ?? null;

  if (loading) {
    return <Spinner label="Carregando versões..." />;
  }
  if (error) {
    return <ErrorBox message={error} />;
  }
  if (versions.length < 2) {
    return (
      <Card>
        <SectionTitle>Comparar versões — {label}</SectionTitle>
        <p className="text-sm text-muted">
          {versions.length === 0
            ? "Nenhuma versão gerada ainda — não há o que comparar."
            : "Só existe 1 versão desta geração. Gere outra versão para poder comparar lado a lado."}
        </p>
      </Card>
    );
  }

  const sameSelected = idA !== null && idA === idB;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Comparar versões — {label}</SectionTitle>
          <Tag>{versions.length} versões</Tag>
        </div>
        <p className="text-sm text-muted">
          Escolha duas versões deste entregável para ver as diferenças lado a lado.
        </p>
        {sameSelected && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-caution">
            <Icon name="x" size={13} /> As duas colunas apontam para a mesma versão —
            escolha versões diferentes para comparar.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <VersionColumn
          label="A"
          versions={versions}
          selectedId={idA}
          onSelect={setIdA}
          latestId={latestId}
        />
        <VersionColumn
          label="B"
          versions={versions}
          selectedId={idB}
          onSelect={setIdB}
          latestId={latestId}
        />
      </div>
    </div>
  );
}
