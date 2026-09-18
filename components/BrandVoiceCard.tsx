"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { BrandVoicePolicy } from "@/lib/brand-voice-rules";
import { Button, Card, ErrorBox, Input, Label, SectionTitle, Textarea } from "./ui";

type Payload = { policy: BrandVoicePolicy; tone: string; stats: { checks: number; rewrites: number } };

// Regras da voz da marca (aba Briefing): o que o guardião checa antes de
// um post ser agendado ou uma resposta do atendente sair.
export default function BrandVoiceCard({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState({ banned: "", required: "", requireCta: true, maxHashtags: "10", maxEmojis: "4", flagClaims: true, notes: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    api<Payload>(`/api/clients/${clientId}/brand-voice`)
      .then((p) => {
        if (loaded.current) return;
        loaded.current = true;
        setData(p);
        setForm({
          banned: p.policy.bannedTerms.join(", "),
          required: p.policy.requiredTerms.join(", "),
          requireCta: p.policy.requireCta,
          maxHashtags: String(p.policy.maxHashtags),
          maxEmojis: String(p.policy.maxEmojis),
          flagClaims: p.policy.flagClaims,
          notes: p.policy.notes,
        });
      })
      .catch(() => {});
  }, [clientId]);

  if (!data) return null;

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const next = await api<Payload>(`/api/clients/${clientId}/brand-voice`, {
        method: "PUT",
        body: JSON.stringify({
          bannedTerms: form.banned,
          requiredTerms: form.required,
          requireCta: form.requireCta,
          maxHashtags: Number(form.maxHashtags) || 0,
          maxEmojis: Number(form.maxEmojis) || 0,
          flagClaims: form.flagClaims,
          notes: form.notes,
        }),
      });
      setData(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4" id="voz-da-marca" data-testid="brand-voice-card">
      <div>
        <SectionTitle>Guardião da voz da marca</SectionTitle>
        <p className="text-sm text-muted">
          Antes de agendar um post ou enviar uma resposta do atendente, um clique compara o texto com o tom do briefing
          {data.tone ? <> (“{data.tone}”)</> : null} e com estas regras. Repetir o mesmo texto não gasta IA.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Termos proibidos (separe por vírgula)</Label>
          <Textarea value={form.banned} onChange={(e) => setForm({ ...form, banned: e.target.value })} placeholder="Ex.: barato, promoção relâmpago, imperdível" data-testid="voice-banned" />
        </div>
        <div>
          <Label>Termos obrigatórios (separe por vírgula)</Label>
          <Textarea value={form.required} onChange={(e) => setForm({ ...form, required: e.target.value })} placeholder="Ex.: nome da marca, assinatura da campanha" data-testid="voice-required" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Máx. de hashtags</Label>
            <Input type="number" min={0} max={30} value={form.maxHashtags} onChange={(e) => setForm({ ...form, maxHashtags: e.target.value })} data-testid="voice-max-hashtags" />
          </div>
          <div>
            <Label>Máx. de emojis</Label>
            <Input type="number" min={0} max={30} value={form.maxEmojis} onChange={(e) => setForm({ ...form, maxEmojis: e.target.value })} data-testid="voice-max-emojis" />
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requireCta} onChange={(e) => setForm({ ...form, requireCta: e.target.checked })} className="accent-[var(--accent)]" />
            Todo post precisa de uma chamada para ação
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.flagClaims} onChange={(e) => setForm({ ...form, flagClaims: e.target.checked })} className="accent-[var(--accent)]" />
            Sinalizar alegações sem fonte (“o melhor”, “100%”, “comprovado”)
          </label>
        </div>
        <div className="md:col-span-2">
          <Label>Orientações extras de tom (vão para a IA)</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: falar de você, nunca de senhor; humor leve; nunca prometer prazo" />
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving} data-testid="voice-save">
          {saving ? "Salvando..." : "Salvar regras da voz"}
        </Button>
        {saved && <span className="text-sm text-text">Aplicado ✓</span>}
        <span className="text-xs text-muted">
          {data.stats.checks} checagens · {data.stats.rewrites} reescritas em cache
        </span>
      </div>
    </Card>
  );
}
