"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Field, FormGrid, Input, SectionTitle } from "./ui";

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
      {/* §11.2: a largura comunica o conteúdo esperado, e a instrução sai do
          placeholder. "Dia do vencimento" tinha 337px para dois dígitos. */}
      <FormGrid>
        <Field label="Chave Pix" hint="CNPJ, CPF, e-mail, celular ou chave aleatória." required>
          {(field) => <Input {...field} value={form.pixKey} onChange={(e) => set({ pixKey: e.target.value })} data-testid="pix-key" />}
        </Field>
        <Field label="Nome de quem recebe" hint="Como aparece no banco." required width="name">
          {(field) => (
            <Input {...field} value={form.beneficiaryName} maxLength={60} onChange={(e) => set({ beneficiaryName: e.target.value })} data-testid="pix-name" />
          )}
        </Field>
        <Field label="Cidade" required width="name">
          {(field) => <Input {...field} value={form.city} maxLength={40} onChange={(e) => set({ city: e.target.value })} data-testid="pix-city" />}
        </Field>
        <Field label="Dia do vencimento" hint="De 1 a 28." width="pct">
          {(field) => (
            <Input {...field} type="number" min={1} max={28} className="tnum" value={form.dueDay} onChange={(e) => set({ dueDay: Number(e.target.value) })} />
          )}
        </Field>
        <Field
          label="Aviso de atraso"
          hint="Opcional — sai impresso na fatura."
          counter={`${form.lateNote.length}/200`}
        >
          {(field) => (
            <Input {...field} value={form.lateNote} maxLength={200} onChange={(e) => set({ lateNote: e.target.value })} placeholder="Após o vencimento, multa de 2% conforme contrato" />
          )}
        </Field>
      </FormGrid>
      {error && <ErrorBox message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={save} loading={saving} data-testid="pix-save">
          Salvar recebimentos
        </Button>
        {saved && <span className="t3 text-text">Salvo ✓</span>}
        <span className={`t5 ${ready ? "text-positive" : "text-text-muted"}`}>{ready ? "Pronto para enviar faturas" : "Faltam dados para enviar faturas"}</span>
      </div>
    </Card>
  );
}
