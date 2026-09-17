"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";
import type { QuestionResult, RadarSummary } from "@/lib/ai-visibility-rules";
import { Button, Card, ErrorBox, Input, SectionTitle, Spinner, Tag } from "./ui";
import { Icon } from "./icons";
import { fmtNum, useUiLang } from "@/lib/i18n";

type Run = { id: string; ranAt: string; results: QuestionResult[]; summary: RadarSummary; demo: boolean; whyNotYou: string[]; disclaimer: string };
type Payload = {
  questions: string[];
  suggested: string[] | null;
  runs: Run[];
  canRun: boolean;
  nextRunAt: string | null;
  aiAvailable: boolean;
  maxQuestions: number;
  costCoins: number;
  sample: { results: QuestionResult[]; summary: RadarSummary; whyNotYou: string[] } | null;
};

const dateBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

// Radar de IA: quando alguém pergunta para uma IA, a marca aparece?
export default function AiRadarTab({ client }: { client: Client }) {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "suggest" | "save" | "run">("");
  const [error, setError] = useState("");

  const load = useCallback(
    (resetDraft: boolean) =>
      api<Payload>(`/api/clients/${client.id}/ai-radar`)
        .then((payload) => {
          setData(payload);
          if (resetDraft) setDraft(payload.questions.length ? payload.questions : (payload.suggested ?? []));
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Erro")),
    [client.id]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  async function act(kind: "suggest" | "save" | "run") {
    setBusy(kind);
    setError("");
    try {
      if (kind === "suggest") {
        const r = await api<{ questions: string[] }>(`/api/clients/${client.id}/ai-radar/suggest`, { method: "POST" });
        setDraft(r.questions);
      } else if (kind === "save") {
        const r = await api<{ questions: string[] }>(`/api/clients/${client.id}/ai-radar`, { method: "PUT", body: JSON.stringify({ questions: draft }) });
        setDraft(r.questions);
        await load(false);
      } else {
        await api(`/api/clients/${client.id}/ai-radar`, { method: "PUT", body: JSON.stringify({ questions: draft }) });
        await api(`/api/clients/${client.id}/ai-radar/run`, { method: "POST" });
        await load(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy("");
    }
  }

  if (!data) return <Spinner label="Carregando o radar..." />;
  const latest = data.runs[0] ?? null;
  const previous = data.runs[1] ?? null;
  const trend = latest && previous ? Math.round((latest.summary.shareOfVoice - previous.summary.shareOfVoice) * 10) / 10 : null;
  const questionsValid = draft.filter((q) => q.trim().length >= 8);

  return (
    <div className="space-y-6" data-testid="ai-radar">
      <Card className="space-y-4">
        <div>
          <SectionTitle>Radar de IA</SectionTitle>
          <p className="text-sm text-muted">
            {`Quando alguém pergunta para uma IA "qual o melhor ${client.industry || "negócio"} perto de mim?", ${client.name} aparece? A IA faz as perguntas com busca na web, anota quem é citado e o que fazer para aparecer mais.`}
          </p>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{`Perguntas de quem compra (até ${data.maxQuestions})`}</p>
          {draft.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={q} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Pergunta ${i + 1}`} data-testid="radar-question" />
              <button type="button" aria-label="Remover pergunta" onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="px-1 text-muted hover:text-red-500">
                ×
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {draft.length < data.maxQuestions && (
              <button type="button" className="text-sm text-accent hover:underline" onClick={() => setDraft([...draft, ""])}>
                + Pergunta
              </button>
            )}
            {data.aiAvailable && (
              <button type="button" className="text-sm text-accent hover:underline" onClick={() => act("suggest")} disabled={busy !== ""} data-testid="radar-suggest">
                {busy === "suggest" ? "Pensando nas perguntas..." : "Sugerir perguntas com IA (1 coin)"}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => act("save")} disabled={busy !== "" || questionsValid.length === 0} data-testid="radar-save">
            Salvar perguntas
          </Button>
          <Button onClick={() => act("run")} disabled={busy !== "" || !data.canRun || !data.aiAvailable || questionsValid.length === 0} data-testid="radar-run">
            <Icon name="radar" size={14} /> {busy === "run" ? "Perguntando para a IA (1-3 min)..." : `Rodar radar · ${data.costCoins} coins`}
          </Button>
          {!data.canRun && data.nextRunAt && <span className="text-xs text-muted" data-testid="radar-next">{`Próxima rodada a partir de ${dateBr(data.nextRunAt)}`}</span>}
          {!data.aiAvailable && <span className="text-xs text-muted">A IA não está disponível agora. Abaixo, um exemplo do que o radar mostra.</span>}
        </div>
      </Card>

      {latest ? (
        <RadarResult run={latest} trend={trend} />
      ) : data.sample ? (
        <RadarResult run={{ ...data.sample, id: "sample", ranAt: new Date().toISOString(), demo: true, disclaimer: "" }} trend={null} sample />
      ) : (
        <p className="rounded-md border border-dashed border-edge p-4 text-sm text-muted" data-testid="radar-empty">
          Salve as perguntas e rode o radar. Ele roda uma vez por semana por cliente.
        </p>
      )}
    </div>
  );
}

function RadarResult({ run, trend, sample = false }: { run: Run; trend: number | null; sample?: boolean }) {
  const lang = useUiLang();
  const s = run.summary;
  return (
    <div className="space-y-4" data-testid={sample ? "radar-sample" : "radar-result"}>
      {(sample || run.demo) && <Tag>{sample ? "exemplo — sem IA agora" : "exemplo (modo de teste)"}</Tag>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Participação da marca</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold text-accent" data-testid="radar-sov">{`${fmtNum(s.shareOfVoice, lang)}%`}</p>
          {trend !== null && <p className={`text-xs ${trend >= 0 ? "text-emerald-500" : "text-red-500"}`}>{`${trend >= 0 ? "+" : ""}${fmtNum(trend, lang)} p.p. desde a rodada anterior`}</p>}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Respostas que citam a marca</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold">{`${s.answersWithClient}/${s.questions}`}</p>
          {s.bestPosition !== null && <p className="text-xs text-muted">{`melhor posição: ${s.bestPosition}º`}</p>}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Concorrentes citados</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {s.competitors.slice(0, 4).map((c) => (
              <li key={c.name} className="flex justify-between gap-2">
                <span className="truncate">{c.name}</span>
                <span className="tabular-nums">{c.mentions}</span>
              </li>
            ))}
            {s.competitors.length === 0 && <li className="text-muted">Cadastre concorrentes no briefing ou na estratégia.</li>}
          </ul>
        </Card>
      </div>
      <Card>
        <SectionTitle>Por que não você</SectionTitle>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {run.whyNotYou.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">O que fazer agora</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm" data-testid="radar-actions">
          {s.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </Card>
      <Card>
        <SectionTitle>Pergunta por pergunta</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-1.5 pr-2">Pergunta</th>
                <th className="py-1.5 pr-2">Marcas citadas</th>
                <th className="py-1.5">A marca aparece?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {run.results.map((r) => (
                <tr key={r.question} data-testid="radar-row">
                  <td className="py-1.5 pr-2 align-top">{r.question}</td>
                  <td className="py-1.5 pr-2 align-top text-muted">{r.brandsMentioned.map((b) => `${b.position}. ${b.name}`).join(" · ")}</td>
                  <td className="py-1.5 align-top">{r.brandsMentioned.length === 0 ? "—" : r.clientMentioned || r.clientPosition ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted" data-testid="radar-disclaimer">
        {run.disclaimer || "Simulação feita por IA com busca na web. Assistentes como ChatGPT e Gemini podem responder diferente."}
      </p>
    </div>
  );
}
