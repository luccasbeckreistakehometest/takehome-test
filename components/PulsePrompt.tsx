"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PULSE_FACES, type DuePrompts, type PulseKind } from "@/lib/pulse-rules";
import { Button, Card, ErrorBox, Textarea } from "./ui";

type Payload = { due: DuePrompts; agencyName: string };

type Question = { kind: PulseKind; context: string; title: string; subtitle: string };

// Pulso do cliente no portal: uma pergunta de cada vez, 1 clique (😞😐😀 ou
// 0-10 no NPS) + comentário opcional. Some quando não há nada a perguntar.
export default function PulsePrompt({ clientId, refreshKey = 0 }: { clientId: string; refreshKey?: number }) {
  const [data, setData] = useState<Payload | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);

  const load = useCallback(() => {
    api<Payload>(`/api/clients/${clientId}/pulse`).then(setData).catch(() => {});
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!data) return null;
  const due = data.due;
  const next: Question | null = due.approvals[0]
    ? { kind: "approval", context: due.approvals[0].deliverableId, title: "Como foi essa entrega?", subtitle: due.approvals[0].title }
    : due.monthly
      ? { kind: "monthly", context: "", title: "Como está sendo o mês com a agência?", subtitle: "Uma resposta rápida ajuda a equipe a ajustar o rumo." }
      : due.nps
        ? { kind: "nps", context: "", title: `De 0 a 10, quanto você recomendaria a ${data.agencyName} a um amigo?`, subtitle: "Perguntamos isso uma vez por trimestre." }
        : null;

  if (!next) {
    return thanks ? (
      <Card className="border-emerald-500/40 bg-emerald-500/5" data-testid="pulse-thanks">
        <p className="text-sm">Obrigado! Sua resposta chegou na agência. 🙌</p>
      </Card>
    ) : null;
  }

  async function submit(value: number) {
    if (!next) return;
    setSending(true);
    setError("");
    try {
      await api(`/api/clients/${clientId}/pulse`, {
        method: "POST",
        body: JSON.stringify({ kind: next.kind, score: value, comment, context: next.context }),
      });
      setScore(null);
      setComment("");
      setThanks(true);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-accent/40 bg-accent/5" data-testid="pulse-prompt" data-kind={next.kind}>
      <p className="text-xs uppercase tracking-widest text-accent">Pulso rápido</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">{next.title}</p>
      <p className="text-sm text-muted">{next.subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {next.kind === "nps"
          ? Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={`size-9 rounded-md border text-sm font-medium transition-colors ${score === n ? "border-accent bg-accent text-accent-ink" : "border-edge bg-surface hover:border-accent"}`}
                data-testid="nps-score"
                data-score={n}
              >
                {n}
              </button>
            ))
          : ([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                className={`rounded-xl border px-4 py-2 text-2xl transition-transform hover:-translate-y-0.5 ${score === n ? "border-accent bg-accent/15" : "border-edge bg-surface"}`}
                data-testid="pulse-face"
                data-score={n}
                aria-label={n === 1 ? "Insatisfeito" : n === 2 ? "Neutro" : "Satisfeito"}
              >
                {PULSE_FACES[n]}
              </button>
            ))}
      </div>
      {score !== null && (
        <div className="mt-3 space-y-2">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Quer contar mais? (opcional)" data-testid="pulse-comment" />
          {error && <ErrorBox message={error} />}
          <Button onClick={() => submit(score)} disabled={sending} data-testid="pulse-send">
            {sending ? "Enviando..." : "Enviar resposta"}
          </Button>
        </div>
      )}
    </Card>
  );
}
