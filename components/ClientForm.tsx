"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { CHANNEL_OPTIONS, type Client, type ClientInput } from "@/lib/types";
import { Button, Card, ErrorBox, Input, Label, Select, Spinner, Textarea } from "./ui";
import VoiceBriefing from "./VoiceBriefing";
import type { VoiceBriefing as Briefing } from "@/lib/voice-briefing";

const EMPTY: ClientInput = {
  name: "",
  industry: "",
  description: "",
  audience: "",
  tone: "",
  goals: "",
  budget: "",
  channels: [],
  differentials: "",
  competitors: "",
  brandColors: "",
  website: "",
  instagram: "",
  notes: "",
  capabilities: "",
  language: "pt-BR",
  source: "agency",
  country: "Brasil",
  selfServe: false,
};

export default function ClientForm({
  initial,
  onSaved,
  selfService = false,
  showSelfServeChoice = false,
}: {
  initial?: Client;
  onSaved: (client: Client) => void;
  selfService?: boolean;
  showSelfServeChoice?: boolean;
}) {
  const [form, setForm] = useState<ClientInput>(
    initial ? { ...EMPTY, ...initial } : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Só no cadastro novo: quem prefere falar preenche o briefing pelo microfone
  // e revisa os campos antes de salvar. Edição continua digitada.
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [voiceBriefingId, setVoiceBriefingId] = useState<string | undefined>();
  function applyBriefing(b: Briefing, id: string) {
    setForm((prev) => ({ ...prev, ...b.fields, name: b.fields.name || prev.name, country: b.fields.country || prev.country }));
    setVoiceBriefingId(id);
    setMode("text");
  }

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleChannel = (channel: string) =>
    set(
      "channels",
      form.channels.includes(channel)
        ? form.channels.filter((c) => c !== channel)
        : [...form.channels, channel]
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = initial
        ? await api<Client>(`/api/clients/${initial.id}`, {
            method: "PUT",
            body: JSON.stringify({ ...form, source: initial.source }),
          })
        : await api<Client>("/api/clients", {
            method: "POST",
            body: JSON.stringify({ ...form, source: selfService ? "self" : "agency" }),
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!initial && (
        <div className="flex flex-wrap items-center gap-2" data-tour="briefing-mode">
          <button type="button" onClick={() => setMode("text")} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${mode === "text" ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-foreground"}`} data-testid="mode-text">Digitar o briefing</button>
          <button type="button" onClick={() => setMode("voice")} className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${mode === "voice" ? "border-accent bg-accent/10 text-accent" : "border-edge text-muted hover:text-foreground"}`} data-testid="mode-voice">🎙 Falar o briefing</button>
          {voiceBriefingId && <span className="text-xs text-emerald-400">Preenchido por voz — revise e salve</span>}
        </div>
      )}
      {mode === "voice" && !initial && <VoiceBriefing onConfirm={applyBriefing} onTypeInstead={() => setMode("text")} />}
      <div className={mode === "voice" && !initial ? "hidden" : "space-y-5"}>
      {error && <ErrorBox message={error} />}
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Nome do cliente *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Café Aurora"
              required
            />
          </div>
          <div>
            <Label>País / mercado-alvo</Label>
            <Input
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="Ex.: Brasil"
            />
          </div>
          <div>
            <Label>Idioma dos entregáveis</Label>
            <Select
              value={form.language}
              onChange={(e) => set("language", e.target.value as ClientInput["language"])}
            >
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English (US)</option>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Segmento</Label>
            <Input
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              placeholder="Ex.: cafeteria artesanal"
            />
          </div>
          <div>
            <Label>Site</Label>
            <Input
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="@perfil"
            />
          </div>
        </div>
        <div>
          <Label>Sobre a empresa</Label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="O que a empresa faz, história, produtos/serviços principais..."
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Público-alvo</Label>
            <Textarea
              value={form.audience}
              onChange={(e) => set("audience", e.target.value)}
              placeholder="Quem compra, idade, hábitos, dores..."
            />
          </div>
          <div>
            <Label>Objetivos de marketing</Label>
            <Textarea
              value={form.goals}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="Ex.: dobrar leads em 6 meses, abrir 2ª unidade..."
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Tom de voz</Label>
            <Input
              value={form.tone}
              onChange={(e) => set("tone", e.target.value)}
              placeholder="Ex.: acolhedor e bem-humorado"
            />
          </div>
          <div>
            <Label>Verba mensal</Label>
            <Input
              value={form.budget}
              onChange={(e) => set("budget", e.target.value)}
              placeholder="Ex.: R$ 8.000/mês"
            />
          </div>
          <div>
            <Label>Cores / identidade atual</Label>
            <Input
              value={form.brandColors}
              onChange={(e) => set("brandColors", e.target.value)}
              placeholder="Ex.: verde-escuro e creme"
            />
          </div>
        </div>
        <div>
          <Label>Canais ativos</Label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((channel) => {
              const active = form.channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-edge bg-surface-2 text-muted hover:border-muted"
                  }`}
                >
                  {channel}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Diferenciais</Label>
            <Textarea
              value={form.differentials}
              onChange={(e) => set("differentials", e.target.value)}
              placeholder="Por que escolher esse cliente e não o concorrente?"
            />
          </div>
          <div>
            <Label>Concorrentes</Label>
            <Textarea
              value={form.competitors}
              onChange={(e) => set("competitors", e.target.value)}
              placeholder="Nomes e o que fazem bem/mal"
            />
          </div>
        </div>
        <div>
          <Label>Recursos & capacidade produtiva</Label>
          <Textarea
            value={form.capabilities}
            onChange={(e) => set("capabilities", e.target.value)}
            placeholder="O que o cliente TEM disponível: máquinas, tecidos/materiais, cores, equipe, equipamentos, serviços que consegue oferecer... A IA usa isso para recomendar o que produzir/ofertar."
          />
        </div>
        <div>
          <Label>Observações extras</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Qualquer contexto que ajude a IA a acertar mais"
          />
        </div>
      </Card>

      {showSelfServeChoice && (
        <Card>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.selfServe}
              onChange={(e) => set("selfServe", e.target.checked)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">Quero gerenciar minha conta eu mesmo(a)</span>
              <span className="block text-xs text-muted">
                Modo autônomo: você usa a plataforma diretamente (estratégia, campanhas,
                identidade, demandas com freelancers) sem uma agência intermediando.
              </span>
            </span>
          </label>
        </Card>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} data-testid="save-client">
          {initial ? "Salvar alterações" : "Criar cliente"}
        </Button>
        {saving && <Spinner label="Salvando..." />}
      </div>
      </div>
    </form>
  );
}
