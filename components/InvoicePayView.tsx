"use client";

import { useState } from "react";
import type { InvoiceItem, InvoiceState } from "@/lib/invoice-rules";

type Lang = "pt" | "en";

const T = {
  pt: {
    invoice: "Fatura",
    for: "para",
    due: "Vence em",
    total: "Total",
    pay: "Pague com Pix",
    scan: "Aponte a câmera do app do banco para o QR ou copie o código.",
    copy: "Copiar código Pix",
    copied: "Código copiado ✓",
    claim: "Já paguei",
    claimed: "Aviso enviado. A agência confere o pagamento e confirma por aqui.",
    paid: "Pagamento confirmado. Obrigado!",
    overdue: "Esta fatura está atrasada.",
    voidTitle: "Fatura cancelada",
    receiver: "Quem recebe",
    direct: "O pagamento cai direto na conta da agência. A confirmação é feita por ela.",
    error: "Não deu para avisar agora. Tente de novo.",
  },
  en: {
    invoice: "Invoice",
    for: "for",
    due: "Due on",
    total: "Total (billed in BRL)",
    pay: "Pay with Pix",
    scan: "Point your banking app's camera at the QR or copy the code.",
    copy: "Copy Pix code",
    copied: "Code copied ✓",
    claim: "I've paid",
    claimed: "Notice sent. The agency will check the payment and confirm it here.",
    paid: "Payment confirmed. Thank you!",
    overdue: "This invoice is overdue.",
    voidTitle: "Invoice canceled",
    receiver: "Paid to",
    direct: "The payment goes straight to the agency's account. The agency confirms it.",
    error: "We couldn't send the notice right now. Try again.",
  },
} as const;

const brl = (n: number, lang: Lang) =>
  n.toLocaleString(lang === "en" ? "en-US" : "pt-BR", { style: "currency", currency: "BRL" });

export default function InvoicePayView({
  token,
  lang,
  state,
  clientName,
  beneficiary,
  lateNote,
  agency,
  invoice,
  qrSvg,
}: {
  token: string;
  lang: Lang;
  state: InvoiceState;
  clientName: string;
  beneficiary: string;
  lateNote: string;
  agency: { name: string; tagline: string; accentColor: string; logoUrl: string };
  invoice: { month: string; items: InvoiceItem[]; total: number; dueDate: string; pixPayload: string; paidAt: string | null };
  qrSvg: string;
}) {
  const t = T[lang];
  const [current, setCurrent] = useState<InvoiceState>(state);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const due = `${invoice.dueDate.slice(8, 10)}/${invoice.dueDate.slice(5, 7)}/${invoice.dueDate.slice(0, 4)}`;
  const open = current === "sent" || current === "overdue";

  async function copy() {
    try {
      await navigator.clipboard.writeText(invoice.pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function claim() {
    setError("");
    const response = await fetch(`/api/fatura/${token}/paid`, { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      setError(t.error);
      return;
    }
    const body = (await response.json()) as { status: InvoiceState };
    setCurrent(body.status);
  }

  return (
    <div className="mx-auto max-w-md space-y-5" style={{ ["--accent" as string]: agency.accentColor }} data-no-translate data-testid="invoice-page" data-state={current}>
      <header className="flex items-center gap-3">
        {agency.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.logoUrl} alt={agency.name} className="size-11 rounded-lg object-contain" />
        ) : (
          <span className="grid size-11 place-items-center rounded-sm bg-surface-sunken font-[family-name:var(--font-display)] text-lg font-bold text-text">
            {agency.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--font-display)] text-lg font-semibold">{agency.name}</p>
          {agency.tagline && <p className="truncate text-xs text-muted">{agency.tagline}</p>}
        </div>
      </header>

      {current === "void" ? (
        <section className="rounded-2xl border border-edge bg-surface p-6 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{t.voidTitle}</h1>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-edge bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-text">
              {t.invoice} {invoice.month} · {t.for} {clientName}
            </p>
            <ul className="mt-3 divide-y divide-edge text-sm">
              {invoice.items.map((item, index) => (
                <li key={index} className="flex justify-between gap-3 py-2">
                  <span>{item.label}</span>
                  <span className="shrink-0 tabular-nums">{brl(item.amount, lang)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-end justify-between border-t border-edge pt-3">
              <span className="text-sm text-muted">{t.total}</span>
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold" data-testid="invoice-total">
                {brl(invoice.total, lang)}
              </span>
            </div>
            <p className={`mt-1 text-right text-sm ${current === "overdue" ? "font-medium text-negative" : "text-muted"}`}>
              {t.due} {due}
            </p>
            {current === "overdue" && (
              <p className="mt-2 rounded-lg border border-negative/40 bg-negative-wash px-3 py-2 text-sm" data-testid="invoice-overdue">
                {t.overdue} {lateNote}
              </p>
            )}
          </section>

          {current === "paid" ? (
            <p className="rounded-2xl border border-positive/40 bg-positive-wash p-4 text-center font-medium" data-testid="invoice-paid">
              {t.paid}
            </p>
          ) : current === "paid_claimed" ? (
            <p className="rounded-2xl border border-edge bg-surface-sunken p-4 text-center text-sm" data-testid="invoice-claimed">
              {t.claimed}
            </p>
          ) : null}

          {open && invoice.pixPayload && (
            <section className="space-y-3 rounded-2xl border border-edge bg-surface p-5 text-center">
              <h2 className="font-semibold">{t.pay}</h2>
              <p className="text-sm text-muted">{t.scan}</p>
              <div className="mx-auto w-fit rounded-xl bg-white p-3" data-testid="invoice-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="break-all rounded-lg border border-edge bg-surface-2 p-2 text-left font-mono text-[11px]" data-testid="invoice-payload">
                {invoice.pixPayload}
              </p>
              <button type="button" onClick={copy} className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink" data-testid="invoice-copy">
                {copied ? t.copied : t.copy}
              </button>
              <button type="button" onClick={claim} className="w-full rounded-xl border border-edge px-4 py-3 font-medium" data-testid="invoice-claim">
                {t.claim}
              </button>
              {error && <p className="text-sm text-negative">{error}</p>}
              <p className="text-xs text-muted">
                {beneficiary ? `${t.receiver}: ${beneficiary}. ` : ""}
                {t.direct}
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
