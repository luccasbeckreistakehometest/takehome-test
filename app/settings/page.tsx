"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgencySettings } from "@/lib/settings";

type SettingsView = AgencySettings & {
  hasAnthropicKey?: boolean;
  hasGoogleAiKey?: boolean;
};
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
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    api<SettingsView>("/api/settings").then(setSettings);
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
        <div className="space-y-2 border-t border-edge pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Custo & features de IA
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                {
                  value: "economy",
                  label: "💸 Econômico",
                  desc: "Modelo mais barato (Sonnet) em tudo. Menor custo possível.",
                },
                {
                  value: "balanced",
                  label: "⚖️ Equilibrado",
                  desc: "Sonnet nos entregáveis táticos; Opus em estratégia, identidade, match e análise de arte.",
                },
                {
                  value: "premium",
                  label: "👑 Premium",
                  desc: "Opus (modelo topo) em todas as gerações. Máxima qualidade, maior custo.",
                },
              ] as const
            ).map((mode) => (
              <label
                key={mode.value}
                className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${
                  settings.aiMode === mode.value
                    ? "border-accent bg-accent/10"
                    : "border-edge bg-surface-2 hover:border-muted"
                }`}
              >
                <input
                  type="radio"
                  name="aiMode"
                  className="hidden"
                  checked={settings.aiMode === mode.value}
                  onChange={() => setSettings({ ...settings, aiMode: mode.value })}
                />
                <span className="font-medium">{mode.label}</span>
                <span className="mt-1 block text-xs text-muted">{mode.desc}</span>
              </label>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-md border border-edge bg-surface-2 p-3 text-sm">
            <input
              type="checkbox"
              checked={settings.landingPagesEnabled}
              onChange={(e) =>
                setSettings({ ...settings, landingPagesEnabled: e.target.checked })
              }
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">Gerador de landing pages</span>
              <span className="block text-xs text-muted">
                É o entregável que mais consome tokens (HTML completo). Desligado, a
                aba some do workspace e o kit completo pula essa etapa.
              </span>
            </span>
          </label>
        </div>
        <div className="border-t border-edge pt-4">
          <Label>Estilo da casa (injetado em todas as gerações de IA)</Label>
          <textarea
            value={settings.houseStyle}
            onChange={(e) => setSettings({ ...settings, houseStyle: e.target.value })}
            placeholder="Diretrizes da agência que valem para todos os clientes: tom, o que nunca fazer, formatos preferidos..."
            className="min-h-20 w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="space-y-2 border-t border-edge pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Chaves de API
          </p>
          <p className="text-xs text-muted">
            As chaves ficam apenas no banco local e nunca voltam ao navegador.
            Deixe em branco para manter a atual; digite <code>clear</code> para
            apagar.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Anthropic (Claude){" "}
                {settings.hasAnthropicKey ? (
                  <span className="normal-case text-accent">configurada ✓</span>
                ) : (
                  <span className="normal-case text-red-400">não configurada</span>
                )}
              </Label>
              <Input
                type="password"
                value={settings.anthropicApiKey}
                onChange={(e) =>
                  setSettings({ ...settings, anthropicApiKey: e.target.value })
                }
                placeholder="sk-ant-... (em branco = manter)"
              />
            </div>
            <div>
              <Label>
                Google AI — mockups de imagem{" "}
                {settings.hasGoogleAiKey ? (
                  <span className="normal-case text-accent">configurada ✓</span>
                ) : (
                  <span className="normal-case text-muted">
                    opcional — aistudio.google.com
                  </span>
                )}
              </Label>
              <Input
                type="password"
                value={settings.googleAiApiKey}
                onChange={(e) =>
                  setSettings({ ...settings, googleAiApiKey: e.target.value })
                }
                placeholder="AIza... (habilita mockup fotorrealista)"
              />
            </div>
          </div>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configurações"}
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
