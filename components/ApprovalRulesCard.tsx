"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApprovalRules } from "@/lib/approval-rules";
import { Button, Card, ErrorBox, Input, Label, SectionTitle } from "./ui";

type Payload = { rules: ApprovalRules; whatsappConnected: boolean };

// Card de Configurações: as regras da "aprovação que dispara ação" — visíveis
// e editáveis pela agência. Salva separado do formulário principal.
export default function ApprovalRulesCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Payload>("/api/automation/approval").then(setData).catch(() => {});
  }, []);

  if (!data) return null;
  const { rules } = data;
  const set = (patch: Partial<ApprovalRules>) =>
    setData((prev) => (prev ? { ...prev, rules: { ...prev.rules, ...patch } } : prev));

  async function save() {
    if (!data) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const next = await api<Payload>("/api/automation/approval", {
        method: "PUT",
        body: JSON.stringify(data.rules),
      });
      setData(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4" data-tour="settings-approval">
      <div>
        <SectionTitle>Aprovação que dispara ação</SectionTitle>
        <p className="text-sm text-muted">
          Quando o cliente aprova uma peça no portal, isto acontece sozinho. Cada aprovação fica registrada na linha do tempo da entrega.
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-edge bg-surface-2 p-3 text-sm">
        <input
          type="checkbox"
          checked={rules.autoPostDraft}
          onChange={(e) => set({ autoPostDraft: e.target.checked })}
          className="mt-0.5 accent-[var(--accent)]"
          data-testid="rule-auto-post"
        />
        <span>
          <span className="font-medium">Peça de rede social aprovada vira rascunho de post</span>
          <span className="block text-xs text-muted">
            Imagem ou vídeo de uma demanda de conteúdo (posts, reels, stories, carrossel) entra no calendário como rascunho, com a peça anexada, para você só confirmar a data.
          </span>
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2 sm:pl-8">
        <div>
          <Label>Sugerir publicação em (dias após a aprovação)</Label>
          <Input
            type="number"
            min={0}
            max={30}
            value={rules.postDelayDays}
            onChange={(e) => set({ postDelayDays: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Hora sugerida</Label>
          <Input
            type="number"
            min={0}
            max={23}
            value={rules.postHour}
            onChange={(e) => set({ postHour: Number(e.target.value) })}
          />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-edge bg-surface-2 p-3 text-sm">
        <input
          type="checkbox"
          checked={rules.notifyWhatsapp}
          onChange={(e) => set({ notifyWhatsapp: e.target.checked })}
          className="mt-0.5 accent-[var(--accent)]"
          data-testid="rule-notify-whatsapp"
        />
        <span>
          <span className="font-medium">Avisar a agência por WhatsApp</span>
          <span className="block text-xs text-muted">
            A mensagem entra na fila de envio (Mensagens → Conexões). Sem canal conectado, o aviso aparece só no sino do painel.
          </span>
          {data.whatsappConnected ? (
            <span className="mt-1 block text-xs text-emerald-500">WhatsApp conectado ✓</span>
          ) : (
            <span className="mt-1 block text-xs text-amber-500">WhatsApp ainda não conectado — o aviso vai só para o painel.</span>
          )}
        </span>
      </label>
      <div className="sm:pl-8">
        <Label>WhatsApp da agência (com DDI e DDD, só números)</Label>
        <Input
          value={rules.notifyPhone}
          onChange={(e) => set({ notifyPhone: e.target.value })}
          placeholder="5511999999999"
          data-testid="rule-phone"
        />
      </div>
      {error && <ErrorBox message={error} />}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} data-testid="rules-save">
          {saving ? "Salvando..." : "Salvar regras"}
        </Button>
        {saved && <span className="text-sm text-accent">Aplicado ✓</span>}
      </div>
    </Card>
  );
}
