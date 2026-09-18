"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ASSET_KIND_LABELS, type ClientAsset } from "@/lib/marketplace-types";
import { Card, SectionTitle, Tag } from "./ui";

// Arquivos da marca do cliente: identidade visual importada, projetos
// Photoshop/Illustrator, materiais — baixáveis por todos do contrato.
export default function BrandAssets({ clientId }: { clientId: string }) {
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [kind, setKind] = useState<ClientAsset["kind"]>("brand");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    api<ClientAsset[]>(`/api/clients/${clientId}/assets`).then(setAssets);
  }, [clientId]);

  useEffect(load, [load]);

  return (
    <Card className="space-y-3">
      <SectionTitle>Arquivos da marca</SectionTitle>
      <p className="t3 text-text-muted">
        Importe a identidade visual existente do cliente e arquivos de projeto —
        PSD (Photoshop), AI (Illustrator), PDF, ZIP, fontes, logos... Ficam
        disponíveis para a equipe e para os profissionais das demandas.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ClientAsset["kind"])}
          className="rounded-md border border-edge bg-surface-sunken px-2 py-2 t3 text-text outline-none"
        >
          {Object.entries(ASSET_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-md border border-edge bg-surface-sunken px-3.5 py-2 t3 transition-colors hover:border-edge">
          {uploading ? "Enviando..." : "Enviar arquivo"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const body = new FormData();
                body.append("file", file);
                body.append("kind", kind);
                await fetch(`/api/clients/${clientId}/assets`, { method: "POST", body });
                load();
              } finally {
                setUploading(false);
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
      {assets.length > 0 && (
        <div className="space-y-1.5">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono t5 uppercase text-text">
                  .{asset.ext}
                </span>
                <span className="font-medium">{asset.title}</span>
                <Tag>{ASSET_KIND_LABELS[asset.kind]}</Tag>
              </span>
              <span className="flex gap-2 t5">
                <a href={`/api/assets/${asset.id}`} className="text-text hover:underline">Baixar
                </a>
                <button
                  className="text-text-muted hover:text-negative"
                  onClick={async () => {
                    await api(`/api/assets/${asset.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Excluir
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
