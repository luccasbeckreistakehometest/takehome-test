"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgencySettings } from "@/lib/settings";
import { Button, Card, CopyButton, ErrorBox, Input, Label, SectionTitle } from "@/components/ui";

const INTEGRATIONS = [
  { name: "Meta Ads (Facebook/Instagram)", area: "Mídia paga" },
  { name: "Google Ads", area: "Mídia paga" },
  { name: "Google Analytics 4", area: "Dados & métricas" },
  { name: "TikTok Business", area: "Mídia paga" },
  { name: "Instagram Publishing", area: "Publicação social" },
  { name: "Canva", area: "Design" },
  { name: "Figma", area: "Design" },
  { name: "Google Calendar / Meet", area: "Reuniões" },
  { name: "Stripe / Mercado Pago", area: "Pagamentos & escrow" },
  { name: "RD Station / HubSpot", area: "CRM & leads" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    api<AgencySettings>("/api/settings").then(setSettings);
    setOrigin(window.location.origin);
  }, []);

  if (!settings) return null;

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSaved(true);
      // Recarrega para o layout aplicar a nova marca
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
        Configurações
      </h1>

      <Card className="space-y-4">
        <SectionTitle>Whitelabel — a plataforma com a sua marca</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Nome da agência</Label>
            <Input
              value={settings.agencyName}
              onChange={(e) => setSettings({ ...settings, agencyName: e.target.value })}
            />
          </div>
          <div>
            <Label>Tagline (rodapé)</Label>
            <Input
              value={settings.tagline}
              onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
            />
          </div>
          <div>
            <Label>Cor de destaque</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded-md border border-edge bg-surface-2"
              />
              <Input
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              />
            </div>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar marca"}
          </Button>
          {saved && <span className="text-sm text-accent">Aplicado ✓</span>}
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Convites para externos</SectionTitle>
        <p className="text-sm text-muted">
          Compartilhe estes links para trazer gente de fora para dentro da
          plataforma — cada um cai direto no fluxo certo do seu papel.
        </p>
        {[
          {
            label: "Convite para cliente (auto-cadastro de briefing)",
            path: "/cadastro",
          },
          {
            label: "Convite para fotógrafo/designer (cadastro de perfil)",
            path: "/professionals/new",
          },
          { label: "Porta de entrada por papel (agência/cliente/profissional)", path: "/portal" },
        ].map((invite) => (
          <div
            key={invite.path}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{invite.label}</p>
              <p className="font-mono text-xs text-muted">{origin + invite.path}</p>
            </div>
            <CopyButton text={origin + invite.path} label="Copiar link" />
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Integrações</SectionTitle>
        <p className="text-sm text-muted">
          O hub de integrações conecta a plataforma às principais ferramentas do
          ecossistema. Cada conexão exige um app/credencial na plataforma de
          origem — em breve, com OAuth guiado.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{integration.name}</p>
                <p className="text-xs text-muted">{integration.area}</p>
              </div>
              <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                Em breve
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
