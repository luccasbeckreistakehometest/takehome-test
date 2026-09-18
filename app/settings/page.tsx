"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgencySettings } from "@/lib/settings";

type SettingsView = AgencySettings & {
  canManagePlatform?: boolean;
  hasAnthropicKey?: boolean;
  hasGoogleAiKey?: boolean;
  hasTogetherKey?: boolean;
  hasHfKey?: boolean;
};
import { Button, ErrorBox, Input, Label, PageHeader, SectionTitle, Textarea } from "@/components/ui";
import InviteGenerator from "@/components/InviteGenerator";
import ApprovalRulesCard from "@/components/ApprovalRulesCard";
import AgencyPageCard from "@/components/AgencyPageCard";
import InvoiceSettingsCard from "@/components/InvoiceSettingsCard";

type IntegrationStatus = "live" | "beta" | "soon";
const INTEGRATIONS: {
  name: string;
  area: string;
  status: IntegrationStatus;
  where?: string;
}[] = [
  { name: "WhatsApp (API oficial da Meta)", area: "Mensageria", status: "live", where: "Mensagens → Conexões" },
  { name: "Instagram DM (API)", area: "Mensageria", status: "live", where: "Mensagens → Conexões" },
  { name: "Google Analytics 4", area: "Dados & métricas", status: "live", where: "Cliente → Vendas & Dados" },
  { name: "Meta Ads (Facebook/Instagram)", area: "Mídia paga", status: "live", where: "Cliente → Vendas & Dados" },
  { name: "Vendas / marketplace (genérico)", area: "Receita", status: "live", where: "Cliente → Vendas & Dados" },
  { name: "Google Ads", area: "Mídia paga", status: "beta", where: "gancho pronto — falta credencial" },
  { name: "TikTok Business", area: "Mídia paga", status: "beta", where: "gancho pronto — falta credencial" },
  { name: "Instagram Publishing", area: "Publicação social", status: "beta", where: "posts agendados na Agenda" },
  { name: "Google Calendar / Meet", area: "Reuniões", status: "beta", where: "links de calendário na Agenda" },
  { name: "Canva / Figma", area: "Design", status: "soon" },
  { name: "Stripe / Mercado Pago", area: "Pagamentos entre agência e profissional", status: "soon" },
  { name: "RD Station / HubSpot", area: "CRM & leads", status: "soon" },
];

const STATUS_BADGE: Record<IntegrationStatus, { label: string; cls: string }> = {
  live: { label: "Ativo", cls: "border-positive/40 bg-positive-wash text-positive" },
  beta: { label: "Beta", cls: "border-caution/40 bg-caution-wash text-caution" },
  soon: { label: "Em breve", cls: "border-edge text-text-muted" },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [logoVersion, setLogoVersion] = useState(0);
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
    // Ajustes é formulário longo: coluna de trabalho estreita (o campo não
    // precisa de 1000px) e seções separadas por régua em vez de dois cartões
    // gigantes empilhados.
    <div className="max-w-[46rem]">
      <PageHeader eyebrow="Agência" title="Configurações" />

      <section className="space-y-4 border-t border-edge pt-5">
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
                className="h-9 w-12 cursor-pointer rounded-md border border-edge bg-surface-sunken"
              />
              <Input
                value={settings.accentColor}
                onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 border-t border-edge pt-4">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-edge bg-surface-sunken">
            {settings.logoMime ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/settings/logo?v=${logoVersion}`} alt="logo" className="size-full object-contain" />
            ) : (
              <span className="d4 font-bold text-text">
                {settings.agencyName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <Label>Logo da agência</Label>
            <p className="mb-2 t5 text-text-muted">
              Aparece no cabeçalho e nas telas que o cliente/profissional vê ao entrar pelo convite.
            </p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-edge bg-surface-sunken px-3 py-1.5 t3 transition-colors hover:border-edge">
                Enviar logo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/settings/logo", { method: "POST", body: fd });
                    if (res.ok) {
                      setSettings((prev) => (prev ? { ...prev, logoMime: file.type } : prev));
                      setLogoVersion((v) => v + 1);
                    }
                  }}
                />
              </label>
              {settings.logoMime && (
                <button
                  onClick={async () => {
                    await fetch("/api/settings/logo", { method: "DELETE" });
                    setSettings((prev) => (prev ? { ...prev, logoMime: "" } : prev));
                    setLogoVersion((v) => v + 1);
                  }}
                  className="rounded-md border border-edge px-3 py-1.5 t3 text-text-muted transition-colors hover:border-negative/60 hover:text-negative"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
        {!settings.canManagePlatform && (
          <p className="border-t border-edge pt-4 t5 text-text-muted">
            O modo de IA, as landing pages e as chaves de API são definidos pelo admin da plataforma.
          </p>
        )}
        {settings.canManagePlatform && (
        <div className="space-y-2 border-t border-edge pt-4">
          <p className="t6 text-text-muted">
            Custo & features de IA
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                {
                  value: "economy",
                  label: "Econômico",
                  desc: "Modelo mais barato (Sonnet) em tudo. Menor custo possível.",
                },
                {
                  value: "balanced",
                  label: "Equilibrado",
                  desc: "Sonnet nos entregáveis táticos; Opus em estratégia, identidade, match e análise de arte.",
                },
                {
                  value: "premium",
                  label: "Premium",
                  desc: "Opus (modelo topo) em todas as gerações. Máxima qualidade, maior custo.",
                },
              ] as const
            ).map((mode) => (
              <label
                key={mode.value}
                className={`cursor-pointer rounded-md border p-3 t3 transition-colors ${
                  settings.aiMode === mode.value
                    ? "border-edge bg-surface-sunken"
                    : "border-edge bg-surface-sunken hover:border-edge"
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
                <span className="mt-1 block t5 text-text-muted">{mode.desc}</span>
              </label>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-md border border-edge bg-surface-sunken p-3 t3">
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
              <span className="block t5 text-text-muted">
                É o entregável que mais consome tokens (HTML completo). Desligado, a
                aba some do workspace e o kit completo pula essa etapa.
              </span>
            </span>
          </label>
        </div>
        )}
        <div className="border-t border-edge pt-4">
          <Label>Estilo da casa (injetado em todas as gerações de IA)</Label>
          <Textarea
            value={settings.houseStyle}
            onChange={(e) => setSettings({ ...settings, houseStyle: e.target.value })}
            placeholder="Diretrizes da agência que valem para todos os clientes: tom, o que nunca fazer, formatos preferidos..."
            className="min-h-20"
          />
        </div>
        {settings.canManagePlatform && (
        <div className="space-y-2 border-t border-edge pt-4">
          <p className="t6 text-text-muted">
            Chaves de API
          </p>
          <p className="t5 text-text-muted">
            As chaves ficam apenas no banco local e nunca voltam ao navegador.
            Deixe em branco para manter a atual; digite <code>clear</code> para
            apagar.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Anthropic (Claude){" "}
                {settings.hasAnthropicKey ? (
                  <span className="normal-case text-text">configurada ✓</span>
                ) : (
                  <span className="normal-case text-negative">não configurada</span>
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
                  <span className="normal-case text-text">configurada ✓</span>
                ) : (
                  <span className="normal-case text-text-muted">
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

          <div className="mt-4 rounded-lg border border-edge bg-surface-sunken p-4">
            <Label>Conceitos de imagem (grátis, gera várias)</Label>
            <p className="mb-3 t5 text-text-muted">
              Para <strong>testar e mostrar</strong> direções visuais sem custo. O botão
              “Gerar 4 conceitos” em cada demanda usa este provedor. (Para mockup
              <em> fiel</em> compondo foto real de produto/modelo, use o Google AI acima.)
            </p>
            <div>
              <Label>Provedor</Label>
              <select
                value={settings.imageProvider}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    imageProvider: e.target.value as "huggingface" | "together" | "pollinations",
                  })
                }
                className="w-full rounded-md border border-edge bg-surface px-3 py-2 t3 text-text outline-none focus:border-edge"
              >
                <option value="huggingface">Hugging Face — FLUX.1-dev · melhor qualidade (chave grátis)</option>
                <option value="together">Together AI — FLUX.1-schnell-Free · rápido (chave grátis)</option>
                <option value="pollinations">Pollinations — sem chave, qualidade menor</option>
              </select>
              <p className="mt-1 t5 text-text-muted">
                Recomendado: <strong>Hugging Face FLUX.1-dev</strong> — a melhor qualidade grátis.
                Crie um token em huggingface.co → Settings → Access Tokens (não pede cartão).
              </p>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>
                  Hugging Face API Key{" "}
                  {settings.hasHfKey ? (
                    <span className="normal-case text-text">configurada ✓</span>
                  ) : (
                    <span className="normal-case text-text-muted">para FLUX.1-dev</span>
                  )}
                </Label>
                <Input
                  type="password"
                  value={settings.hfApiKey}
                  onChange={(e) => setSettings({ ...settings, hfApiKey: e.target.value })}
                  placeholder="hf_... (em branco = manter)"
                />
              </div>
              <div>
                <Label>
                  Together API Key{" "}
                  {settings.hasTogetherKey ? (
                    <span className="normal-case text-text">configurada ✓</span>
                  ) : (
                    <span className="normal-case text-text-muted">para FLUX-schnell</span>
                  )}
                </Label>
                <Input
                  type="password"
                  value={settings.togetherApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, togetherApiKey: e.target.value })
                  }
                  placeholder="together key (em branco = manter)"
                />
              </div>
            </div>
          </div>
        </div>
        )}
        {error && <ErrorBox message={error} />}
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
          {saved && <span className="t3 text-text">Aplicado ✓</span>}
        </div>
      </section>

      <div id="pagina-publica" className="scroll-mt-20">
        <AgencyPageCard origin={origin} />
      </div>

      <ApprovalRulesCard />

      <div id="recebimentos" className="scroll-mt-20">
        <InvoiceSettingsCard />
      </div>

      <div id="convites" className="scroll-mt-20">
        <InviteGenerator origin={origin} />
      </div>

      <section className="space-y-3 border-t border-edge pt-5">
        <SectionTitle>Integrações</SectionTitle>
        <p className="t3 text-text-muted">
          <span className="text-positive">Ativo</span> = já funciona com sua credencial.{" "}
          <span className="text-caution">Beta</span> = gancho pronto, falta plugar o token.{" "}
          Mensagens ficam em <strong>Mensagens → Conexões</strong>; dados e vendas de cada
          conta em <strong>Cliente → Vendas & Dados</strong>.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {INTEGRATIONS.map((integration) => {
            const badge = STATUS_BADGE[integration.status];
            return (
              <div
                key={integration.name}
                className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-sunken px-3 py-2 t3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{integration.name}</p>
                  <p className="truncate t5 text-text-muted">
                    {integration.area}
                    {integration.where && ` · ${integration.where}`}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-xs border px-2 py-0.5 t6 ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
