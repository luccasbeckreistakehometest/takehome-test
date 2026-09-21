"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtMoney, useUiLang } from "@/lib/i18n";
import type { InvoiceItem, InvoiceState } from "@/lib/invoice-rules";
import { Button, EmptyState, ErrorBox, Input, SectionTitle, Select, Spinner, Tag } from "./ui";
import { buttonClass } from "@/lib/button-class";
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
  draft: "border-edge text-text-muted",
  sent: "border-edge text-text",
  paid_claimed: "border-caution/60 text-caution",
  paid: "border-positive/60 text-positive",
  void: "border-edge text-text-muted line-through",
  overdue: "border-negative/60 text-negative",
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
        <p className="rounded-lg border border-caution/50 bg-caution-wash px-3 py-2 t3" data-testid="invoices-no-pix">
          Cadastre sua chave Pix em{" "}
          <Link href="/settings#recebimentos" className="font-medium text-text hover:underline">
            Configurações → Recebimentos
          </Link>{" "}
          para enviar faturas.
        </p>
      )}
      {error && <ErrorBox message={error} />}

      <dl className="grid gap-x-8 gap-y-5 border-y border-edge py-4 sm:grid-cols-3">
        <div>
          <dt className="t6 text-text-muted">A receber</dt>
          <dd className="n2 mt-1" data-testid="invoices-receivable">
            {fmtMoney(receivable, lang)}
          </dd>
        </div>
        <div>
          <dt className="t6 text-text-muted">Atrasadas</dt>
          <dd className={`n2 mt-1 ${summary?.overdue.length ? "text-negative" : "text-text-muted"}`}>
            {summary?.overdue.length ?? 0}
          </dd>
        </div>
        <div>
          <dt className="t6 text-text-muted">Cliente avisou que pagou</dt>
          <dd className={`n2 mt-1 ${summary?.claimed ? "" : "text-text-muted"}`}>{summary?.claimed ?? 0}</dd>
        </div>
      </dl>

      <section>
        <SectionTitle>Nova fatura</SectionTitle>
        <p className="t5 measure-prose text-text-muted">
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
            Criar rascunho
          </Button>
          {invoices.length > 0 && (
            <a
              href={`/api/invoices?format=csv${clientId ? `&clientId=${clientId}` : ""}`}
              className="t5 ml-auto pb-2 font-medium underline-offset-4 hover:underline"
            >
              Baixar CSV
            </a>
          )}
        </div>
      </section>

      {invoices.length === 0 ? (
        <div data-testid="invoices-empty">
          <EmptyState
            icon="money"
            title="Nenhuma fatura ainda"
            condition="Defina o fee mensal do cliente em Horas & margem e crie o primeiro rascunho."
          />
        </div>
      ) : (
        <ul className="border-t border-edge">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="border-b border-rule py-3" data-testid="invoice-row" data-state={invoice.state}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="t3 font-medium">
                    {!clientId && <span>{invoice.clientName} · </span>}
                    {invoice.month}
                  </p>
                  <p className="t5 tnum text-text-muted">{`Vence ${invoice.dueDate.slice(8, 10)}/${invoice.dueDate.slice(5, 7)} · ${invoice.items.length} linha(s)`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="n3">{fmtMoney(invoice.total, lang)}</span>
                  <span className={`t5 rounded-xs border px-2 py-0.5 ${STATE_STYLE[invoice.state]}`}>{STATE_LABEL[invoice.state]}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 t3">
                {invoice.status === "draft" && (
                  <>
                    <Button variant="secondary" onClick={() => act(invoice, "send")} disabled={!ready} title={ready ? "" : "Cadastre sua chave Pix em Configurações"} data-testid="invoice-send">
                      Enviar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(editing === invoice.id ? null : invoice.id)}>
                      Editar
                    </Button>
                  </>
                )}
                {(invoice.status === "sent" || invoice.status === "paid_claimed") && (
                  <>
                    <Button variant="secondary" onClick={() => act(invoice, "paid")} data-testid="invoice-confirm">
                      Confirmar pagamento
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
                  <a href={`/fatura/${invoice.token}`} target="_blank" rel="noreferrer" className={`${buttonClass("secondary")}`} data-testid="invoice-open">
                    Ver página do cliente
                  </a>
                )}
                {invoice.status !== "paid" && invoice.status !== "void" && (
                  <button type="button" onClick={() => act(invoice, "void")} className="t5 ml-auto text-negative underline-offset-4 hover:underline">
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
      <p className="t5 text-text-muted">O pagamento cai direto na sua conta; a confirmação é manual. A Marqa não cobra taxa sobre as faturas.</p>
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
        <button type="button" className="t3 text-text hover:underline" onClick={() => setItems((rows) => [...rows, { label: "", amount: "", kind: "manual" }])}>
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
