"use client";

import { useState } from "react";
import { buildCampaignUrl } from "@/lib/analytics-rules";
import { CopyButton, Input, Label, Select } from "@/components/ui";

const PAGES = ["/", "/para-agencias", "/para-marcas", "/para-profissionais", "/criar-conta"];

// Monta o link de campanha com UTM para anúncios, bio e parcerias.
export default function UtmBuilder({ base }: { base: string }) {
  const [form, setForm] = useState({ path: "/para-agencias", source: "instagram", medium: "social", campaign: "", content: "" });
  const url = buildCampaignUrl(base, form.path, form);
  return (
    <section className="space-y-3 rounded-xl border border-edge bg-surface p-5" data-testid="utm-builder">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text">Link de campanha</h2>
      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <Label htmlFor="utm-path">Página</Label>
          <Select id="utm-path" value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })}>
            {PAGES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        {(["source", "medium", "campaign", "content"] as const).map((key) => (
          <div key={key}>
            <Label htmlFor={`utm-${key}`}>{`utm_${key}`}</Label>
            <Input id={`utm-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} data-testid={`utm-${key}`} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-xs" data-testid="utm-url">
          {url}
        </code>
        <CopyButton text={url} label="Copiar link" />
      </div>
    </section>
  );
}
