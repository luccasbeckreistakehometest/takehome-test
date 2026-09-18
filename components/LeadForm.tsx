"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { BUDGET_BANDS, BUDGET_BAND_LABELS, type BudgetBand } from "@/lib/agency-page-rules";
import { Button, ErrorBox, Input, Label, Select, Textarea } from "./ui";

// Formulário de captação da página pública: nome, WhatsApp, o que precisa e
// faixa de verba. O campo "website" é o honeypot (invisível; robôs preenchem).
export default function LeadForm({ slug, agencyName }: { slug: string; agencyName: string }) {
  const lang = useUiLang();
  const [form, setForm] = useState({ name: "", whatsapp: "", need: "", budgetBand: "" as BudgetBand | "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    setSending(true);
    setError("");
    try {
      await api(`/api/a/${slug}/lead`, { method: "POST", body: JSON.stringify(form) });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-md border border-positive/40 bg-positive-wash p-5 t3" data-testid="lead-sent">
        <p className="d4">Recebemos! </p>
        <p className="mt-1 text-text-muted">A equipe da {agencyName} vai te chamar no WhatsApp em breve.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      data-testid="lead-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Seu nome</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Como devemos te chamar" data-testid="lead-name" required />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" data-testid="lead-whatsapp" required inputMode="tel" />
        </div>
      </div>
      <div>
        <Label>O que você precisa?</Label>
        <Textarea value={form.need} onChange={(e) => setForm({ ...form, need: e.target.value })} placeholder="Ex.: posts para o Instagram e alguém para responder o WhatsApp da loja" data-testid="lead-need" required />
      </div>
      <div>
        <Label>Verba mensal</Label>
        <Select value={form.budgetBand} onChange={(e) => setForm({ ...form, budgetBand: e.target.value as BudgetBand })} data-testid="lead-budget" required>
          <option value="">Escolha uma faixa</option>
          {BUDGET_BANDS.map((band) => (
            <option key={band} value={band}>
              {BUDGET_BAND_LABELS[band][lang === "en" ? "en" : "pt"]}
            </option>
          ))}
        </Select>
      </div>
      {/* honeypot: fora da tela e fora do tab; humanos nunca preenchem */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
      </div>
      {error && <ErrorBox message={error} />}
      <Button type="submit" disabled={sending || !form.name.trim() || !form.whatsapp.trim() || !form.need.trim() || !form.budgetBand} data-testid="lead-submit">
        {sending ? "Enviando..." : "Quero conversar →"}
      </Button>
      <p className="t5 text-text-muted">Sem spam: só a equipe da agência recebe.</p>
    </form>
  );
}
