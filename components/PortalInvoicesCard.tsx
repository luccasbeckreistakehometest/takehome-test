"use client";

import { useEffect, useState } from "react";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import type { InvoiceState } from "@/lib/invoice-rules";
import { Card, SectionTitle } from "./ui";

type Row = { id: string; month: string; total: number; dueDate: string; state: InvoiceState; token: string; paidAt: string | null };

const LABEL: Record<InvoiceState, string> = {
  draft: "Rascunho",
  sent: "Em aberto",
  paid_claimed: "Aguardando confirmação",
  paid: "Paga",
  void: "Cancelada",
  overdue: "Atrasada",
};

// Portal: faturas da agência para este cliente (abre a página de pagamento Pix).
export default function PortalInvoicesCard({ clientId }: { clientId: string }) {
  const lang = useUiLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    fetch(`/api/clients/${clientId}/invoices`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, [clientId]);
  if (!rows || rows.length === 0) return null;
  return (
    <Card data-testid="portal-invoices">
      <SectionTitle>Financeiro</SectionTitle>
      <ul className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <li key={row.id}>
            <a
              href={`/fatura/${row.token}`}
              className="flex items-center justify-between gap-2 rounded-md border border-edge bg-surface-2 px-3 py-2 hover:border-accent/60"
              data-state={row.state}
            >
              <span>
                <span className="font-medium">{row.month}</span>{" "}
                <span className={`text-xs ${row.state === "overdue" ? "text-red-500" : "text-muted"}`}>· {LABEL[row.state]}</span>
              </span>
              <span className="tabular-nums">{fmtMoney(row.total, lang)}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
