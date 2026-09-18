"use client";

import { useState } from "react";
import type { LinkItemView } from "@/lib/approval-links-db";

type Lang = "pt" | "en";
type Agency = { name: string; tagline: string; accentColor: string; logoUrl: string };

// Textos da página pública: na língua do cliente (não passa pelo tradutor).
const T = {
  pt: {
    for: "Aprovação para",
    intro: "Olhe cada peça e toque em Aprovar. Se algo precisar mudar, peça ajuste e conte o quê — a agência recebe na hora.",
    who: "Quem está aprovando? (opcional)",
    whoPh: "Seu nome",
    approve: "Aprovar",
    changes: "Pedir ajuste",
    send: "Enviar pedido",
    cancel: "Cancelar",
    notePh: "O que precisa mudar?",
    approved: "Aprovado",
    requested: "Ajuste pedido",
    pending: "Aguardando você",
    approveAll: "Aprovar tudo que falta",
    allDone: "Tudo respondido. Obrigado! A agência já foi avisada.",
    expiredTitle: "Este link expirou",
    expiredBody: "Peça um link novo para a agência — as peças continuam guardadas.",
    post: "Post",
    delivery: "Entrega",
    on: "em",
    error: "Não deu para salvar. Tente de novo.",
    until: "Link válido até",
    noPassword: "Sem senha, sem cadastro.",
  },
  en: {
    for: "Approval for",
    intro: "Look at each piece and tap Approve. If something needs to change, ask for changes and say what — the agency is told right away.",
    who: "Who is approving? (optional)",
    whoPh: "Your name",
    approve: "Approve",
    changes: "Ask for changes",
    send: "Send request",
    cancel: "Cancel",
    notePh: "What needs to change?",
    approved: "Approved",
    requested: "Changes requested",
    pending: "Waiting for you",
    approveAll: "Approve everything left",
    allDone: "All answered. Thank you! The agency has been told.",
    expiredTitle: "This link has expired",
    expiredBody: "Ask the agency for a new link — the pieces are still saved.",
    post: "Post",
    delivery: "Delivery",
    on: "on",
    error: "We couldn't save that. Try again.",
    until: "Link valid until",
    noPassword: "No password, no sign-up.",
  },
} as const;

export default function ApprovalLinkView({
  token,
  state,
  lang,
  clientName,
  agency,
  expiresAt,
  initialItems,
}: {
  token: string;
  state: "open" | "expired" | "closed";
  lang: Lang;
  clientName: string;
  agency: Agency;
  expiresAt: string;
  initialItems: LinkItemView[];
}) {
  const t = T[lang];
  const locale = lang === "en" ? "en-US" : "pt-BR";
  const [items, setItems] = useState(initialItems);
  // nome lembrado neste aparelho (só conveniência; preenche ao focar)
  const storedName = () => {
    try {
      return localStorage.getItem("marqa_approver") ?? "";
    } catch {
      return "";
    }
  };
  const [approver, setApprover] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(state !== "open");
  const pending = items.filter((i) => i.decision !== "approved" && i.decision !== "changes_requested");

  function rememberName(value: string) {
    setApprover(value);
    try {
      localStorage.setItem("marqa_approver", value);
    } catch {
      // só conveniência
    }
  }

  async function decide(item: LinkItemView, decision: "approved" | "changes_requested", note = ""): Promise<boolean> {
    setBusy(`${item.kind}:${item.id}`);
    setError("");
    try {
      const response = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id, decision, note, approver: approver || storedName() }),
      });
      const body = (await response.json().catch(() => ({}))) as { item?: LinkItemView; error?: string };
      if (response.status === 410) {
        setExpired(true);
        return false;
      }
      if (!response.ok || !body.item) {
        setError(body.error ?? t.error);
        return false;
      }
      setItems((list) => list.map((i) => (i.kind === item.kind && i.id === item.id ? body.item! : i)));
      return true;
    } catch {
      setError(t.error);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function approveAll() {
    for (const item of pending) {
      const ok = await decide(item, "approved");
      if (!ok) break;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-28" style={{ ["--accent" as string]: agency.accentColor }} data-no-translate data-testid="approval-link-page">
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
          <p className="truncate font-[family-name:var(--font-display)] text-lg font-semibold" data-testid="approval-agency">
            {agency.name}
          </p>
          {agency.tagline && <p className="truncate text-xs text-muted">{agency.tagline}</p>}
        </div>
      </header>

      {expired ? (
        <section className="rounded-2xl border border-edge bg-surface p-6 text-center" data-testid="approval-expired">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{t.expiredTitle}</h1>
          <p className="mt-2 text-sm text-muted">{t.expiredBody}</p>
        </section>
      ) : (
        <>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-text">
              {t.for} {clientName}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight">{t.intro}</h1>
            <p className="mt-2 text-xs text-muted">
              {t.noPassword} {t.until} {new Date(expiresAt).toLocaleDateString(locale, { timeZone: "UTC" })}.
            </p>
            <label className="mt-4 block text-xs font-medium text-muted" htmlFor="approver-name">
              {t.who}
            </label>
            <input
              id="approver-name"
              value={approver}
              maxLength={80}
              onChange={(e) => rememberName(e.target.value)}
              onFocus={() => {
                if (!approver) setApprover(storedName());
              }}
              placeholder={t.whoPh}
              className="mt-1 w-full rounded-lg border border-edge bg-surface-2 px-3 py-2.5 text-base outline-none focus:border-edge"
              data-testid="approver-name"
            />
          </section>

          {error && (
            <p role="alert" className="rounded-lg border border-negative/50 bg-negative-wash px-3 py-2 text-sm text-negative">
              {error}
            </p>
          )}

          <ul className="space-y-4">
            {items.map((item) => (
              <ItemCard
                key={`${item.kind}:${item.id}`}
                item={item}
                token={token}
                t={t}
                locale={locale}
                busy={busy === `${item.kind}:${item.id}`}
                onDecide={(decision, note) => decide(item, decision, note)}
              />
            ))}
          </ul>

          {pending.length === 0 ? (
            <p className="rounded-2xl border border-positive/40 bg-positive-wash p-4 text-center text-sm font-medium" data-testid="approval-all-done">
              {t.allDone}
            </p>
          ) : (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-background/95 p-3 backdrop-blur">
              <div className="mx-auto max-w-xl">
                <button
                  type="button"
                  onClick={approveAll}
                  disabled={busy !== null}
                  className="w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-ink disabled:opacity-50"
                  data-testid="approve-all"
                >
                  {t.approveAll} ({pending.length})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ItemCard({
  item,
  token,
  t,
  locale,
  busy,
  onDecide,
}: {
  item: LinkItemView;
  token: string;
  t: (typeof T)[Lang];
  locale: string;
  busy: boolean;
  onDecide: (decision: "approved" | "changes_requested", note?: string) => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const status =
    item.decision === "approved"
      ? { label: t.approved, cls: "border-positive/50 bg-positive-wash text-positive dark:text-positive" }
      : item.decision === "changes_requested"
        ? { label: t.requested, cls: "border-caution/50 bg-caution-wash text-caution dark:text-caution" }
        : { label: t.pending, cls: "border-edge bg-surface-2 text-muted" };
  return (
    <li className="overflow-hidden rounded-2xl border border-edge bg-surface" data-testid="approval-item" data-kind={item.kind} data-id={item.id} data-decision={item.decision}>
      {item.imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/approve/${token}/file/${item.imageId}`} alt={item.title} className="max-h-[70vh] w-full bg-surface-2 object-contain" />
      )}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {item.kind === "post"
                ? `${t.post} · ${item.channel}${item.format ? ` · ${item.format}` : ""} · ${t.on} ${new Date(item.scheduledFor).toLocaleDateString(locale, { day: "2-digit", month: "short" })}`
                : `${t.delivery} · ${item.projectTitle}`}
            </p>
            <h2 className="font-semibold">{item.title}</h2>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${status.cls}`}>{status.label}</span>
        </div>
        {item.kind === "post" && item.caption && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {item.caption}
            {item.hashtags.length > 0 && <span className="mt-1 block text-text">{item.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</span>}
          </p>
        )}
        {item.decision === "changes_requested" && item.note && (
          <p className="rounded-lg border border-caution/40 bg-caution-wash px-3 py-2 text-sm">“{item.note}”</p>
        )}
        {item.decision !== "approved" &&
          (asking ? (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                placeholder={t.notePh}
                className="min-h-24 w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-base outline-none focus:border-edge"
                data-testid="changes-note"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || note.trim().length < 3}
                  onClick={async () => {
                    if (await onDecide("changes_requested", note)) setAsking(false);
                  }}
                  className="flex-1 rounded-lg bg-accent px-3 py-2.5 font-medium text-accent-ink disabled:opacity-40"
                  data-testid="changes-send"
                >
                  {t.send}
                </button>
                <button type="button" onClick={() => setAsking(false)} className="rounded-lg border border-edge px-3 py-2.5">
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide("approved")}
                className="flex-1 rounded-lg bg-accent px-3 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
                data-testid="item-approve"
              >
                {t.approve}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAsking(true)}
                className="flex-1 rounded-lg border border-edge px-3 py-2.5 font-medium"
                data-testid="item-changes"
              >
                {t.changes}
              </button>
            </div>
          ))}
      </div>
    </li>
  );
}
