"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import type { InvoiceItem, InvoiceState } from "@/lib/invoice-rules";
import { Button, Card, ErrorBox, Input, SectionTitle, Select, Spinner, Tag } from "./ui";
import { Icon } from "./icons";
import { openAfter } from "@/lib/open-later";

type Invoice = {
  id: string;
  clientId: string;
  clientName: string;
  month: string;
  items: InvoiceItem[];
  total: number;
  dueDate: string;
  status: string;
  state: InvoiceState;
  token: string;
  paidAt: string | null;
};
type Summary = { dueSoon: { id: string }[]; overdue: { id: string }[]; drafts: number; claimed: number };

const STATE_LABEL: Record<InvoiceState, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  paid_claimed: "Cliente diz que pagou",
  paid: "Paga",
  void: "Cancelada",
  overdue: "Atrasada",
};
const STATE_STYLE: Record<InvoiceState, string> = {
  draft: "border-edge text-muted",
  sent: "border-accent/50 text-accent",
  paid_claimed: "border-amber-500/60 text-amber-600 dark:text-amber-300",
  paid: "border-emerald-500/60 text-emerald-600 dark:text-emerald-300",
  void: "border-edge text-muted line-through",
  overdue: "border-red-500/60 text-red-500",
};

const thisMonth = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 7);

// Cobranças: faturas do fee (e extras aprovados) com Pix direto na conta da
// agência. Com `clientId`, só as daquele cliente.
export default function InvoicesPanel({ clientId, clients = [] }: { clientId?: string; clients?: { id: string; name: string }[] }) {
  const lang = useUiLang();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ready, setReady] = useState(true);
  const [newClient, setNewClient] = useState(clientId ?? "");
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
    api<{ invoices: Invoice[]; summary: Summary }>(`/api/invoices${query}`)
      .then((r) => {
        setInvoices(r.invoices);
        setSummary(r.summary);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
    api<{ ready: boolean }>("/api/invoices/settings")
      .then((r) => setReady(r.ready))
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(invoice: Invoice, action: "send" | "paid" | "unpaid" | "void") {
    setError("");
    if (action === "void" && !confirm("Cancelar esta fatura? Os extras voltam para a próxima.")) return;
    try {
      if (action === "send") {
        await openAfter(async () => (await api<{ whatsappUrl?: string }>(`/api/invoices/${invoice.id}`, { method: "PATCH", body: JSON.stringify({ action }) })).whatsappUrl);
      } else {
        await api(`/api/invoices/${invoice.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function remind(invoice: Invoice) {
    await openAfter(async () => (await api<{ whatsappUrl: string }>(`/api/invoices/${invoice.id}`)).whatsappUrl).catch((e) =>
      setError(e instanceof Error ? e.message : "Erro")
    );
  }

  async function createDraft() {
    setBusy(true);
    setError("");
    try {
      await api("/api/invoices", { method: "POST", body: JSON.stringify({ clientId: newClient, month }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!invoices) return <Spinner label="Carregando cobranças..." />;
  const open = invoices.filter((i) => i.state === "sent" || i.state === "overdue" || i.state === "paid_claimed");
  const receivable = open.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-5" data-testid="invoices-panel">
      {!ready && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm" data-testid="invoices-no-pix">
          Cadastre sua chave Pix em{" "}
          <Link href="/settings#recebimentos" className="font-medium text-accent hover:underline">
            Configurações → Recebimentos
          </Link>{" "}
          para enviar faturas.
        </p>
      )}
      {error && <ErrorBox message={error} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">A receber</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold" data-testid="invoices-receivable">
            {fmtMoney(receivable, lang)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Atrasadas</p>
          <p className={`mt-1 font-[family-name:var(--font-display)] text-2xl font-bold ${summary?.overdue.length ? "text-red-500" : ""}`}>{summary?.overdue.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Cliente avisou que pagou</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">{summary?.claimed ?? 0}</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <SectionTitle>Nova fatura</SectionTitle>
        <p className="text-sm text-muted">
          No dia 1 a Marqa cria o rascunho de cada cliente com fee (mais os extras aprovados). Você confere e envia. O Pix cai direto na sua conta; a confirmação é sua.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          {!clientId && (
            <Select aria-label="Cliente" value={newClient} onChange={(e) => setNewClient(e.target.value)} data-testid="invoice-new-client">
              <option value="">Escolha o cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <div className="w-40">
            <Input aria-label="Mês" type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="invoice-new-month" />
          </div>
          <Button onClick={createDraft} disabled={busy || !newClient || !month} data-testid="invoice-create">
            <Icon name="plus" size={14} /> Criar rascunho
          </Button>
          {invoices.length > 0 && (
            <a href={`/api/invoices?format=csv${clientId ? `&clientId=${clientId}` : ""}`} className="ml-auto text-sm text-accent hover:underline">
              Baixar CSV
            </a>
          )}
        </div>
      </Card>

      {invoices.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-4 text-sm text-muted" data-testid="invoices-empty">
          Nenhuma fatura ainda. Defina o fee mensal do cliente em Horas & margem e crie o primeiro rascunho.
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="rounded-xl border border-edge bg-surface p-4" data-testid="invoice-row" data-state={invoice.state}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {!clientId && <span>{invoice.clientName} · </span>}
                    {invoice.month}
                  </p>
                  <p className="text-xs text-muted">{`Vence ${invoice.dueDate.slice(8, 10)}/${invoice.dueDate.slice(5, 7)} · ${invoice.items.length} linha(s)`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{fmtMoney(invoice.total, lang)}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLE[invoice.state]}`}>{STATE_LABEL[invoice.state]}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {invoice.status === "draft" && (
                  <>
                    <Button onClick={() => act(invoice, "send")} disabled={!ready} title={ready ? "" : "Cadastre sua chave Pix em Configurações"} data-testid="invoice-send">
                      <Icon name="whatsapp" size={14} /> Enviar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(editing === invoice.id ? null : invoice.id)}>
                      Editar
                    </Button>
                  </>
                )}
                {(invoice.status === "sent" || invoice.status === "paid_claimed") && (
                  <>
                    <Button onClick={() => act(invoice, "paid")} data-testid="invoice-confirm">
                      <Icon name="check" size={14} /> Confirmar pagamento
                    </Button>
                    <Button variant="ghost" onClick={() => remind(invoice)} data-testid="invoice-remind">
                      Lembrar no WhatsApp
                    </Button>
                  </>
                )}
                {invoice.status === "paid" && (
                  <Button variant="ghost" onClick={() => act(invoice, "unpaid")}>
                    Desfazer confirmação
                  </Button>
                )}
                {invoice.status !== "draft" && invoice.status !== "void" && (
                  <a href={`/fatura/${invoice.token}`} target="_blank" rel="noreferrer" className="rounded-md border border-edge px-3 py-2 text-sm hover:border-accent" data-testid="invoice-open">
                    Ver página do cliente ↗
                  </a>
                )}
                {invoice.status !== "paid" && invoice.status !== "void" && (
                  <button type="button" onClick={() => act(invoice, "void")} className="ml-auto text-xs text-red-500 hover:underline">
                    Cancelar fatura
                  </button>
                )}
              </div>
              {editing === invoice.id && (
                <DraftEditor
                  invoice={invoice}
                  onSaved={() => {
                    setEditing(null);
                    load();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">O pagamento cai direto na sua conta; a confirmação é manual. A Marqa não cobra taxa sobre as faturas.</p>
    </div>
  );
}

function DraftEditor({ invoice, onSaved }: { invoice: Invoice; onSaved: () => void }) {
  const [items, setItems] = useState(invoice.items.map((i) => ({ ...i, amount: String(i.amount) })));
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      await api(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "update",
          dueDate,
          items: items.map((i) => ({ ...i, amount: Number(String(i.amount).replace(",", ".")) || 0 })),
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }
  return (
    <div className="mt-3 space-y-2 border-t border-edge pt-3" data-testid="invoice-editor">
      {error && <ErrorBox message={error} />}
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[1fr_110px] gap-2">
          <Input aria-label="Descrição" value={item.label} onChange={(e) => setItems((rows) => rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))} />
          <Input aria-label="Valor" inputMode="decimal" value={item.amount} onChange={(e) => setItems((rows) => rows.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-sm text-accent hover:underline" onClick={() => setItems((rows) => [...rows, { label: "", amount: "", kind: "manual" }])}>
          + Linha
        </button>
        <div className="w-40">
          <Input aria-label="Vencimento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Tag>Rascunho</Tag>
        <Button onClick={save} className="ml-auto">
          Salvar
        </Button>
      </div>
    </div>
  );
}
