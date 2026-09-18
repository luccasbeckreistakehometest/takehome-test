"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { CheckKind, RuleIssue, Verdict, VoiceCheck } from "@/lib/brand-voice-rules";
import { Button, ErrorBox, Spinner, Tag } from "./ui";
import { Icon } from "./icons";

const VERDICT_LABEL: Record<Verdict, string> = { ok: "No tom da marca", review: "Revisar antes de publicar", block: "Fora da política" };
const VERDICT_STYLE: Record<Verdict, string> = {
  ok: "border-positive/40 bg-positive-wash text-positive",
  review: "border-caution/40 bg-caution-wash text-caution",
  block: "border-negative/40 bg-negative-wash text-negative",
};

export function issueText(issue: RuleIssue): string {
  switch (issue.code) {
    case "banned_term":
      return `Termo proibido: “${issue.detail}”`;
    case "missing_term":
      return `Falta o termo obrigatório: “${issue.detail}”`;
    case "no_cta":
      return "Sem chamada para ação";
    case "too_many_hashtags":
      return `Hashtags acima do limite (${issue.detail})`;
    case "too_many_emojis":
      return `Emojis acima do limite (${issue.detail})`;
    case "claim_needs_source":
      return `Alegação sem fonte: “${issue.detail}”`;
  }
}

// Guardião da voz da marca: 1 clique checa o texto contra a política e o
// tom do cliente; "Reescrever no tom" devolve o texto ajustado ao chamador.
export default function BrandVoiceCheck({
  clientId,
  text,
  kind,
  onRewrite,
  compact = false,
}: {
  clientId: string;
  text: string;
  kind: CheckKind;
  onRewrite?: (text: string) => void;
  compact?: boolean;
}) {
  const [result, setResult] = useState<VoiceCheck | null>(null);
  const [checkedText, setCheckedText] = useState("");
  const [busy, setBusy] = useState<"check" | "rewrite" | null>(null);
  const [error, setError] = useState("");

  async function check() {
    if (!text.trim()) return;
    setBusy("check");
    setError("");
    try {
      const r = await api<VoiceCheck>(`/api/clients/${clientId}/brand-voice/check`, { method: "POST", body: JSON.stringify({ text, kind }) });
      setResult(r);
      setCheckedText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao checar");
    } finally {
      setBusy(null);
    }
  }

  async function rewrite() {
    if (!text.trim()) return;
    setBusy("rewrite");
    setError("");
    try {
      const r = await api<{ text: string }>(`/api/clients/${clientId}/brand-voice/rewrite`, { method: "POST", body: JSON.stringify({ text, kind }) });
      onRewrite?.(r.text);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reescrever");
    } finally {
      setBusy(null);
    }
  }

  const stale = result !== null && checkedText !== text;

  return (
    <div className="space-y-2" data-testid="voice-check" data-verdict={result && !stale ? result.verdict : "none"}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={check} disabled={busy !== null || !text.trim()} data-testid="voice-check-run">
          <Icon name="sparkle" size={13} /> {busy === "check" ? "Checando..." : result && !stale ? "Checar de novo" : "Checar voz da marca"}
        </Button>
        {onRewrite && (
          <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={rewrite} disabled={busy !== null || !text.trim()} data-testid="voice-rewrite">
            <Icon name="edit" size={13} /> {busy === "rewrite" ? "Reescrevendo..." : "Reescrever no tom"}
          </Button>
        )}
        {result && !stale && (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${VERDICT_STYLE[result.verdict]}`} data-testid="voice-verdict">
            {VERDICT_LABEL[result.verdict]} · {result.toneScore}/100
          </span>
        )}
        {result && !stale && result.cached && <span className="text-[10px] uppercase tracking-wide text-muted">cache</span>}
        {stale && <span className="text-[11px] text-muted">texto mudou — cheque de novo</span>}
      </div>
      {busy === "check" && <Spinner label="Comparando com o briefing e a política da marca..." />}
      {error && <ErrorBox message={error} />}
      {result && !stale && (
        <div className={`rounded-md border p-3 text-xs ${compact ? "" : "space-y-2"}`} data-testid="voice-result">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${result.toneScore >= 70 ? "bg-positive" : result.toneScore >= 50 ? "bg-caution" : "bg-negative"}`} style={{ width: `${result.toneScore}%` }} />
          </div>
          {result.issues.length > 0 && (
            <ul className="mt-2 space-y-0.5" data-testid="voice-issues">
              {result.issues.map((issue, i) => (
                <li key={i} className={issue.severity === "block" ? "text-negative" : "text-caution"} data-code={issue.code}>
                  • {issueText(issue)}
                </li>
              ))}
            </ul>
          )}
          {result.toneNotes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-muted">
              {result.toneNotes.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          )}
          {result.claims.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-caution">
              {result.claims.map((c, i) => (
                <li key={i}>“{c.text}” — <span className="text-muted">{c.why}</span>
                </li>
              ))}
            </ul>
          )}
          {!compact && result.suggestions.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {result.suggestions.map((s, i) => (
                <li key={i}>→ {s}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted">
            {result.demo && <Tag>exemplo — sem chave de IA</Tag>}
            <Link href={`/clients/${clientId}?tab=briefing#voz-da-marca`} className="text-text hover:underline">
              Regras da voz →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
