"use client";

import { useEffect, useState } from "react";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import { Icon } from "./icons";
import type { UsageRow } from "@/lib/scope-rules";
import type { ScopeRequest } from "@/lib/scope-db";

export type PackagePayload = {
  month: string;
  package: { items: UsageRow[]; rolloverUnused: boolean } | null;
  usage: UsageRow[];
  requests: ScopeRequest[];
  aiClassifier: boolean;
  presets?: { key: string; name: string; items: UsageRow[] }[];
  units?: string[];
};

export function monthLabel(month: string, lang: "pt" | "en"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { month: "long", timeZone: "UTC" });
}

// Barras de uso do pacote no mês (agência e portal).
export function UsageBars({ usage }: { usage: UsageRow[] }) {
  return (
    <ul className="space-y-2" data-testid="package-usage">
      {usage.map((row) => {
        const pct = row.allowance > 0 ? Math.min(100, (row.used / row.allowance) * 100) : 100;
        const over = row.used > row.allowance;
        return (
          <li key={row.key} data-key={row.key} data-used={row.used} data-allowance={row.allowance}>
            <div className="flex items-center justify-between t3">
              <span>{row.label}</span>
              <span className={`font-medium tabular-nums ${over ? "text-negative" : row.remaining === 0 ? "text-caution" : ""}`}>{`${row.used}/${row.allowance}`}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <div className={`h-full ${over ? "bg-negative" : row.remaining === 0 ? "bg-caution" : "bg-text"}`} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS: Record<ScopeRequest["status"], string> = {
  pending_client: "Aguardando o cliente aprovar o valor",
  approved: "Extra aprovado",
  declined: "Cancelado",
  converted: "Dentro do pacote",
  waived: "Incluído sem custo",
};

export type RequestDecision = "approved" | "declined" | "waived" | "charge_extra";

export function RequestList({
  requests,
  onDecide,
  actor,
}: {
  requests: ScopeRequest[];
  onDecide?: (id: string, decision: RequestDecision, price?: number) => void;
  actor: "agency" | "client";
}) {
  const lang = useUiLang();
  if (requests.length === 0) return null;
  return (
    <ul className="space-y-1.5 t3" data-testid="scope-requests">
      {requests.map((r) => (
        <li key={r.id} className="rounded-md border border-edge bg-surface-sunken px-3 py-2" data-testid="scope-request" data-status={r.status}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate">{r.text}</span>
            <span className="t5 text-text-muted">{STATUS[r.status]}</span>
          </div>
          <p className="mt-0.5 t5 text-text-muted">
            {`${r.qty}× ${r.itemLabel || "item"}`}
            {r.extraPrice > 0 ? ` · +${fmtMoney(r.extraPrice, lang)}` : ""}
          </p>
          {actor === "agency" && r.needsReview && (
            <p className="mt-0.5 t5 text-caution" data-testid="scope-review">
              O cliente escolheu este item; confira se o pedido é mesmo do pacote.
            </p>
          )}
          {actor === "agency" && r.status === "converted" && r.inPackage && onDecide && (
            <button
              type="button"
              onClick={() => {
                const answer = window.prompt("Cobrar este pedido como extra. Valor em R$:", "0");
                const price = Number((answer ?? "").replace(",", "."));
                if (Number.isFinite(price) && price > 0) onDecide(r.id, "charge_extra", price);
              }}
              className="mt-2 rounded-md border border-edge px-3 py-1.5 t5 hover:border-edge"
              data-testid="scope-charge-extra"
            >
              Cobrar como extra
            </button>
          )}
          {r.status === "pending_client" && onDecide && (
            <div className="mt-2 flex flex-wrap gap-2">
              {actor === "client" ? (
                <>
                  <button type="button" onClick={() => onDecide(r.id, "approved")} className="rounded-md bg-accent px-3 py-1.5 t5 font-medium text-accent-ink" data-testid="scope-approve">
                    {`Aprovar extra de ${fmtMoney(r.extraPrice, lang)}`}
                  </button>
                  <button type="button" onClick={() => onDecide(r.id, "declined")} className="rounded-md border border-edge px-3 py-1.5 t5" data-testid="scope-decline">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => onDecide(r.id, "waived")} className="rounded-md border border-edge px-3 py-1.5 t5 hover:border-edge" data-testid="scope-waive">
                    Incluir sem custo
                  </button>
                  <button type="button" onClick={() => onDecide(r.id, "declined")} className="rounded-md border border-edge px-3 py-1.5 t5 text-negative">
                    Cancelar pedido
                  </button>
                </>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// Card do dashboard (agência): uso do mês e atalho para a aba Pacote.
export function PackageSummaryCard({ clientId, onOpen }: { clientId: string; onOpen: () => void }) {
  const lang = useUiLang();
  const [data, setData] = useState<PackagePayload | null>(null);
  useEffect(() => {
    fetch(`/api/clients/${clientId}/package`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, [clientId]);
  if (!data) return null;
  const pending = data.requests.filter((r) => r.status === "pending_client").length;
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 shadow-sm" data-testid="package-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <Icon name="package" size={16} className="text-text" />
          {data.package ? `Pacote de ${monthLabel(data.month, lang)}` : "Pacote do cliente"}
        </p>
        <button type="button" onClick={onOpen} className="t3 text-text hover:underline">
          {data.package ? "Ver pacote" : "Definir pacote"}
        </button>
      </div>
      {data.package ? (
        <>
          <p className="mt-1 t3 text-text-muted">{data.usage.map((u) => `${u.used}/${u.allowance} ${u.label.toLowerCase()}`).join(" · ")}</p>
          {pending > 0 && <p className="mt-1 t3 text-caution">{`${pending} extra(s) esperando o cliente aprovar o valor`}</p>}
        </>
      ) : (
        <p className="mt-1 t3 text-text-muted">Diga o que o fee cobre por mês. Pedido fora do combinado vira extra com valor aprovado pelo cliente.</p>
      )}
    </div>
  );
}
