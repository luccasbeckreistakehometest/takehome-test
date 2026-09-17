"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useUiLang } from "@/lib/i18n";
import { SCOPE_UNITS, UNIT_LABEL, type PackageItem, type ScopeUnit } from "@/lib/scope-rules";
import { Button, Card, ErrorBox, Input, SectionTitle, Select, Spinner } from "./ui";
import { monthLabel, RequestList, UsageBars, type PackagePayload, type RequestDecision } from "./PackageUsage";

type Draft = Omit<PackageItem, "qty" | "extraPrice"> & { qty: string; extraPrice: string };

const toDraft = (items: PackageItem[]): Draft[] =>
  items.map((i) => ({ ...i, qty: String(i.qty), extraPrice: String(i.extraPrice) }));

// Aba "Pacote" (agência): o que o fee cobre por mês, quanto já foi usado e
// os pedidos que passaram do combinado.
export default function PackageTab({ clientId }: { clientId: string }) {
  const lang = useUiLang();
  const [data, setData] = useState<PackagePayload | null>(null);
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [rollover, setRollover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    (resetDraft: boolean) =>
      api<PackagePayload>(`/api/clients/${clientId}/package`)
        .then((payload) => {
          setData(payload);
          if (resetDraft) {
            setDraft(toDraft(payload.package?.items ?? []));
            setRollover(Boolean(payload.package?.rolloverUnused));
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Erro")),
    [clientId]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  function update(index: number, patch: Partial<Draft>) {
    setDraft((rows) => (rows ?? []).map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api(`/api/clients/${clientId}/package`, {
        method: "PUT",
        body: JSON.stringify({
          rolloverUnused: rollover,
          items: (draft ?? []).map((row) => ({
            key: row.key,
            label: row.label,
            unit: row.unit,
            qty: Math.max(0, Math.floor(Number(row.qty) || 0)),
            extraPrice: Math.max(0, Number(row.extraPrice.replace(",", ".")) || 0),
          })),
        }),
      });
      setSaved(true);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, decision: RequestDecision, price?: number) {
    try {
      await api(`/api/scope-requests/${id}`, { method: "PATCH", body: JSON.stringify({ decision, price }) });
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  if (!data || !draft) return <Spinner label="Carregando o pacote..." />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]" data-testid="package-tab">
      <Card className="space-y-4">
        <div>
          <SectionTitle>O que o fee cobre por mês</SectionTitle>
          <p className="text-sm text-muted">
            O cliente vê quanto já usou. Pedido que passa do pacote só vira demanda depois que ele aprova o valor do extra — e o extra entra na fatura do mês.
          </p>
        </div>
        {error && <ErrorBox message={error} />}
        {draft.length === 0 && (
          <div className="space-y-2" data-testid="package-presets">
            <p className="text-sm">Comece por um modelo e ajuste:</p>
            <div className="flex flex-wrap gap-2">
              {(data.presets ?? []).map((preset) => (
                <Button key={preset.key} variant="ghost" onClick={() => setDraft(toDraft(preset.items))} data-testid={`preset-${preset.key}`}>
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        {draft.length > 0 && (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1.4fr_1fr_70px_100px_32px] gap-2 text-[11px] uppercase tracking-wide text-muted sm:grid">
              <span>Item</span>
              <span>Unidade</span>
              <span>Por mês</span>
              <span>Extra (R$/un.)</span>
              <span />
            </div>
            {draft.map((row, index) => (
              <div key={`${row.key}-${index}`} className="grid grid-cols-2 gap-2 rounded-md border border-edge p-2 sm:grid-cols-[1.4fr_1fr_70px_100px_32px] sm:border-0 sm:p-0" data-testid="package-row">
                <div className="col-span-2 sm:col-span-1">
                  <Input aria-label="Item" value={row.label} onChange={(e) => update(index, { label: e.target.value })} />
                </div>
                <Select aria-label="Unidade" value={row.unit} onChange={(e) => update(index, { unit: e.target.value as ScopeUnit })}>
                  {SCOPE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u].many}
                    </option>
                  ))}
                </Select>
                <Input aria-label="Por mês" type="number" min={0} value={row.qty} onChange={(e) => update(index, { qty: e.target.value })} data-testid="package-qty" />
                <Input aria-label="Extra (R$/un.)" inputMode="decimal" value={row.extraPrice} onChange={(e) => update(index, { extraPrice: e.target.value })} data-testid="package-extra" />
                <button
                  type="button"
                  aria-label="Remover item"
                  onClick={() => setDraft((rows) => (rows ?? []).filter((_, i) => i !== index))}
                  className="text-muted hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-accent hover:underline"
              onClick={() => setDraft((rows) => [...(rows ?? []), { key: `item_${(rows ?? []).length + 1}`, label: "Novo item", unit: "demanda", qty: "1", extraPrice: "0" }])}
            >
              + Adicionar item
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
              Acumular o que sobrar para o mês seguinte (um mês)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={saving} data-testid="package-save">
                {saving ? "Salvando..." : "Salvar pacote"}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Tirar o pacote deste cliente? Os pedidos voltam a virar demanda direto.")) return;
                  await api(`/api/clients/${clientId}/package`, { method: "PUT", body: JSON.stringify({ items: [] }) }).catch(() => {});
                  await load(true);
                }}
              >
                Sem pacote
              </Button>
              {saved && <span className="text-sm text-accent">Salvo ✓</span>}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-6">
        <Card>
          <SectionTitle>{`Uso em ${monthLabel(data.month, lang)}`}</SectionTitle>
          {data.usage.length > 0 ? <UsageBars usage={data.usage} /> : <p className="text-sm text-muted">Defina o pacote para acompanhar o uso.</p>}
        </Card>
        <Card>
          <SectionTitle>Pedidos do cliente</SectionTitle>
          {data.requests.length === 0 ? (
            <p className="text-sm text-muted">Os pedidos feitos no portal aparecem aqui, com o que cabe no pacote e o que é extra.</p>
          ) : (
            <RequestList requests={data.requests} actor="agency" onDecide={decide} />
          )}
        </Card>
      </div>
    </div>
  );
}
