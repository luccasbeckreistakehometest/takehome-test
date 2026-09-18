"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Input, SectionTitle, Tag } from "@/components/ui";
import { fmtMoney } from "@/lib/i18n";

type Payment = {
  id: string;
  status: string;
  mpStatus: string;
  externalReference: string;
  accountType: string | null;
  accountId: string | null;
  amount: number;
  detail: string;
  createdAt: string;
  updatedAt: string | null;
};
type Tx = { id: string; accountType: string; accountId: string; kind: string; description: string; amount: number; coins: number; createdAt: string };

const STATUS: Record<string, string> = {
  credited: "creditado",
  refunded: "estornado",
  rejected: "recusado",
  pending: "pendente",
  invalid: "inválido",
  linked: "cobrança da assinatura",
};
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminPayments({ agency = "" }: { agency?: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ payments: Payment[]; transactions: Tx[] }>(`/api/admin/payments${agency ? `?agency=${encodeURIComponent(agency)}` : ""}`)
      .then((r) => {
        setPayments(r.payments);
        setTransactions(r.transactions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [agency]);

  useEffect(() => {
    load();
  }, [load]);

  async function reprocess(id: string) {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const r = await api<{ outcome: string; mpStatus: string }>("/api/admin/payments/reprocess", {
        method: "POST",
        body: JSON.stringify({ paymentId: id }),
      });
      setMsg(`Pagamento ${id}: ${r.outcome} (Mercado Pago: ${r.mpStatus}).`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Reprocessar pagamento</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          Relê o pagamento no Mercado Pago e aplica o estado (idempotente). Use quando o webhook falhou ou o cliente pagou e
          não recebeu.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (paymentId.trim()) reprocess(paymentId.trim());
          }}
        >
          <Input aria-label="Número do pagamento no Mercado Pago" placeholder="Número do pagamento (ex.: 1234567890)" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
          <Button type="submit" disabled={busy} data-testid="admin-reprocess">
            Reprocessar
          </Button>
        </form>
        {msg && (
          <p role="status" className="mt-2 text-sm text-text">
            {msg}
          </p>
        )}
        {error && (
          <div className="mt-2">
            <ErrorBox message={error} />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Pagamentos do Mercado Pago ({payments.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="admin-payments">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Pagamento</th>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{when(p.updatedAt ?? p.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <p className="font-mono">{p.id}</p>
                    <p className="text-xs text-muted">{p.externalReference.split("|").slice(0, 1).concat(p.externalReference.split("|").slice(3)).join(" · ")}</p>
                  </td>
                  <td className="py-2 pr-3 text-xs">{p.accountType ? `${p.accountType} · ${p.accountId?.slice(0, 8)}` : "—"}</td>
                  <td className="py-2 pr-3">{fmtMoney(p.amount)}</td>
                  <td className="py-2 pr-3">
                    <Tag>{STATUS[p.status] ?? p.status}</Tag>
                    {p.detail && <p className="mt-1 text-xs text-muted">{p.detail}</p>}
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" disabled={busy} onClick={() => reprocess(p.id)}>
                      Reprocessar
                    </Button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-muted">
                    Nenhum pagamento recebido ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Lançamentos recentes</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Conta</th>
                <th className="py-2 pr-3">Lançamento</th>
                <th className="py-2 pr-3 text-right">Coins</th>
                <th className="py-2 text-right">R$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{when(t.createdAt)}</td>
                  <td className="py-1.5 pr-3 text-xs">
                    {t.accountType} · {t.accountId.slice(0, 8)}
                  </td>
                  <td className="py-1.5 pr-3">{t.description}</td>
                  <td className="py-1.5 pr-3 text-right">{t.coins ? Math.round(t.coins) : ""}</td>
                  <td className="py-1.5 text-right">{t.amount ? fmtMoney(t.amount) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
