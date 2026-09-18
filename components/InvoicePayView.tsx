"use client";

import { useState } from "react";
import type { InvoiceItem, InvoiceState } from "@/lib/invoice-rules";
import { buttonClass } from "@/lib/button-class";
import { brandStyle } from "@/lib/brand-ramp";

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
    // A fatura é uma peça de documento (§10) e não um cartão de aplicativo:
    // cabeçalho da agência, régua da marca, linhas com régua fina, total em
    // figura tabular grande e o bloco de pagamento separado por uma régua
    // estrutural. Cabe num celular e imprime como recibo.
    <article
      className="doc my-8 px-6 py-8 sm:px-10"
      style={{ ...brandStyle(agency.accentColor), ["--doc-measure" as string]: "120mm" } as React.CSSProperties}
      data-no-translate
      data-testid="invoice-page"
      data-state={current}
    >
      <div className="doc-rule" />
      <header className="mt-4 flex items-center gap-3">
        {agency.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agency.logoUrl} alt={agency.name} className="size-9 rounded-xs object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="t6 truncate text-n-500">{agency.name}</p>
          {agency.tagline && <p className="t5 truncate text-n-400">{agency.tagline}</p>}
        </div>
      </header>

      {current === "void" ? (
        <h1 className="d3 mt-10">{t.voidTitle}</h1>
      ) : (
        <>
          <section className="mt-8">
            <p className="t5 text-n-500">
              {t.invoice} {invoice.month} · {t.for} {clientName}
            </p>
            <ul className="mt-4 border-t border-edge">
              {invoice.items.map((item, index) => (
                <li key={index} className="flex justify-between gap-3 border-b border-rule py-2">
                  <span className="t3">{item.label}</span>
                  <span className="n3 shrink-0">{brl(item.amount, lang)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between gap-3">
              <span className="t6 text-n-500">{t.total}</span>
              <span className="n1" data-testid="invoice-total">
                {brl(invoice.total, lang)}
              </span>
            </div>
            <p
              className={`t5 tnum mt-1 text-right ${
                current === "overdue" ? "font-medium text-negative" : "text-n-500"
              }`}
            >
              {t.due} {due}
            </p>
            {current === "overdue" && (
              <p
                className="t4 mt-3 border-l-2 border-negative bg-negative-wash px-3 py-2"
                data-testid="invoice-overdue"
              >
                {t.overdue} {lateNote}
              </p>
            )}
          </section>

          {current === "paid" ? (
            <p
              className="t3 mt-6 border-l-2 border-positive bg-positive-wash px-3 py-2 font-medium"
              data-testid="invoice-paid"
            >
              {t.paid}
            </p>
          ) : current === "paid_claimed" ? (
            <p className="t4 mt-6 border-l-2 border-edge bg-surface-sunken px-3 py-2" data-testid="invoice-claimed">
              {t.claimed}
            </p>
          ) : null}

          {open && invoice.pixPayload && (
            <section className="mt-8 border-t border-edge pt-5">
              <h2 className="t6 text-n-500">{t.pay}</h2>
              <p className="t4 measure-prose mt-1 text-n-500">{t.scan}</p>
              <div
                className="mt-4 w-fit border border-rule bg-white p-3"
                data-testid="invoice-qr"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p
                className="mt-4 break-all border border-rule bg-surface-sunken p-2 font-mono text-[11px] leading-4"
                data-testid="invoice-payload"
              >
                {invoice.pixPayload}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={copy}
                  className={`${buttonClass("primary")} w-full`}
                  data-testid="invoice-copy"
                >
                  {copied ? t.copied : t.copy}
                </button>
                <button
                  type="button"
                  onClick={claim}
                  className={`${buttonClass("secondary")} w-full`}
                  data-testid="invoice-claim"
                >
                  {t.claim}
                </button>
              </div>
              {error && <p className="t4 mt-2 text-negative">{error}</p>}
              <p className="t5 measure-prose mt-4 text-n-500">
                {beneficiary ? `${t.receiver}: ${beneficiary}. ` : ""}
                {t.direct}
              </p>
            </section>
          )}
        </>
      )}
    </article>
  );
}
