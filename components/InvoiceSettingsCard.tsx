"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, Label, SectionTitle } from "./ui";

type Settings = { pixKey: string; beneficiaryName: string; city: string; dueDay: number; lateNote: string };

// Recebimentos: a chave Pix da agência e o vencimento padrão das faturas.
export default function InvoiceSettingsCard() {
  const [form, setForm] = useState<Settings | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ settings: Settings; ready: boolean }>("/api/invoices/settings")
      .then((r) => {
        setForm(r.settings);
        setReady(r.ready);
      })
      .catch(() => {});
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const r = await api<{ settings: Settings; ready: boolean }>("/api/invoices/settings", {
        method: "PUT",
        body: JSON.stringify({ ...form, dueDay: Number(form.dueDay) || 10 }),
      });
      setForm(r.settings);
      setReady(r.ready);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!form) return null;
  const set = (patch: Partial<Settings>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
  };
  return (
    <Card className="space-y-4" data-testid="invoice-settings">
      <div>
        <SectionTitle>Recebimentos (Pix)</SectionTitle>
        <p className="t3 text-text-muted">
          As faturas dos clientes saem com Pix copia e cola e QR da sua chave. O pagamento cai direto na sua conta — a Marqa não passa o dinheiro nem cobra taxa. A confirmação do pagamento é sua.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pix-key">Chave Pix</Label>
          <Input id="pix-key" value={form.pixKey} onChange={(e) => set({ pixKey: e.target.value })} placeholder="CNPJ, CPF, e-mail, celular ou chave aleatória" data-testid="pix-key" />
        </div>
        <div>
          <Label htmlFor="pix-name">Nome de quem recebe</Label>
          <Input id="pix-name" value={form.beneficiaryName} maxLength={60} onChange={(e) => set({ beneficiaryName: e.target.value })} placeholder="Como aparece no banco" data-testid="pix-name" />
        </div>
        <div>
          <Label htmlFor="pix-city">Cidade</Label>
          <Input id="pix-city" value={form.city} maxLength={40} onChange={(e) => set({ city: e.target.value })} placeholder="Ex.: São Paulo" data-testid="pix-city" />
        </div>
        <div>
          <Label htmlFor="pix-due">Dia do vencimento</Label>
          <Input id="pix-due" type="number" min={1} max={28} value={form.dueDay} onChange={(e) => set({ dueDay: Number(e.target.value) })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pix-late">Aviso de atraso (opcional)</Label>
          <Input id="pix-late" value={form.lateNote} maxLength={200} onChange={(e) => set({ lateNote: e.target.value })} placeholder="Ex.: após o vencimento, multa de 2% conforme contrato" />
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving} data-testid="pix-save">
          {saving ? "Salvando..." : "Salvar recebimentos"}
        </Button>
        {saved && <span className="t3 text-text">Salvo ✓</span>}
        <span className={`t5 ${ready ? "text-positive" : "text-text-muted"}`}>{ready ? "Pronto para enviar faturas" : "Faltam dados para enviar faturas"}</span>
      </div>
    </Card>
  );
}
