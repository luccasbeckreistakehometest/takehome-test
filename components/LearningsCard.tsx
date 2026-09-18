"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtCurrency, fmtNum, useUiLang, type UiLang } from "@/lib/i18n";
import { currentMonth, shiftMonth } from "@/lib/report-aggregate";
import { groupLabel, type Highlight, type LearningDimension, type Learnings, type LearningsReading, type ThinReason } from "@/lib/learnings-rules";
import { Button, Card, ErrorBox, SectionTitle, Spinner, Tag } from "./ui";

type ClickRow = { key: string; posts: number; clicks: number; avg: number };
type Payload = {
  learnings: Learnings;
  reading: (LearningsReading & { createdAt: string }) | null;
  readingStale: boolean;
  clicks?: { byFormat: ClickRow[]; byHour: ClickRow[]; totalClicks: number; postsWithLinks: number };
  panel?: { calibration: { hits: number; total: number; pct: number } | null } | null;
};

const REASON_TEXT: Record<ThinReason, string> = {
  few_posts: "Poucos posts publicados neste mês para comparar — são necessários pelo menos 4.",
  no_outcomes: "Sem resultado diário para cruzar com os posts. Registre as vendas por dia (webhook, CSV ou lançamento manual) ou conecte métricas com período de até 7 dias — sincronizações de 30 dias não separam um post do outro.",
  few_posts_with_outcomes: "Poucos posts têm resultado registrado nos dias seguintes — são necessários pelo menos 4.",
  no_variation: "Todos os posts tiveram o mesmo resultado — nada se destaca ainda.",
  no_comparison: "Cada formato, dia e horário apareceu só uma vez. Repita variações (2 posts de cada) para dar para comparar.",
};

const DIM_TITLE: Record<LearningDimension, string> = {
  format: "Melhor formato",
  weekday: "Melhor dia",
  hour: "Melhor horário",
  hookType: "Melhor gancho",
  channel: "Melhor canal",
};
const DIM_NAME: Record<LearningDimension, string> = { format: "Formato", weekday: "Dia", hour: "Horário", hookType: "Gancho", channel: "Canal" };
const METRIC_TEXT: Record<string, string> = {
  revenue: "vendas registradas por dia",
  conversions: "conversões por dia",
  clicks: "cliques por dia",
};
const ORDER: LearningDimension[] = ["format", "weekday", "hour", "hookType", "channel"];

const toLang = (lang: UiLang) => (lang === "en" ? "en" : "pt-BR");

function useValue(l: Learnings, lang: UiLang) {
  return (v: number) => (l.metric === "revenue" ? fmtCurrency(v, l.currency, lang) : fmtNum(Math.round(v * 10) / 10, lang));
}

function HighlightTile({ title, h, l, lang, tone }: { title: string; h: Highlight; l: Learnings; lang: UiLang; tone: "good" | "bad" }) {
  const value = useValue(l, lang);
  return (
    <div className={`rounded-lg border p-3 ${tone === "good" ? "border-positive/40 bg-positive-wash" : "border-negative/40 bg-negative-wash"}`} data-testid={tone === "good" ? "learning-best" : "learning-worst"} data-dimension={h.dimension} data-key={h.key}>
      <p className="t6 text-text-muted">{title}</p>
      <p className="d4 mt-1 capitalize">{groupLabel(h.dimension, h.key, toLang(lang))}</p>
      <p className={`t5 ${tone === "good" ? "text-positive" : "text-negative"}`}>
        {h.liftPct >= 0 ? "+" : ""}
        {h.liftPct}% <span>vs média</span>
      </p>
      <p className="t5 text-text-muted">
        {value(h.avg)} · {h.posts} <span>posts</span>
      </p>
    </div>
  );
}

// Visão só-leitura dos aprendizados (card do cliente e relatório mensal).
export function LearningsSummary({ learnings: l, reading, lang, compact = false }: { learnings: Learnings; reading: LearningsReading | null; lang: UiLang; compact?: boolean }) {
  const value = useValue(l, lang);
  if (!l.hasEnoughData || !l.metric) {
    return (
      <div className="space-y-1 t3" data-testid="learnings-thin" data-reason={l.reason ?? ""}>
        <p className="text-text-muted">{l.reason ? REASON_TEXT[l.reason] : ""}</p>
        <p className="t5 text-text-muted">
          <span>Posts publicados no mês:</span> {l.postsPublished} · <span>com resultado:</span> {l.postsAnalyzed}
        </p>
      </div>
    );
  }
  const bests = ORDER.map((d) => l.best[d]).filter((h): h is Highlight => h !== null);
  return (
    <div className="space-y-3" data-testid="learnings-ready">
      <p className="t5 text-text-muted">
        <span>Resultado medido:</span> <span>{METRIC_TEXT[l.metric]}</span> · <span>nos</span> {l.windowDays} <span>dias após cada post</span> · <span>média</span> {value(l.baseline)} · {l.postsAnalyzed} <span>posts</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {bests.slice(0, compact ? 3 : 4).map((h) => (
          <HighlightTile key={h.dimension} title={DIM_TITLE[h.dimension]} h={h} l={l} lang={lang} tone="good" />
        ))}
        {l.worst && <HighlightTile title="O que menos funcionou" h={l.worst} l={l} lang={lang} tone="bad" />}
      </div>
      {reading && reading.lines.length > 0 && (
        <div className="rounded-md border border-edge bg-surface-sunken p-3 t3" data-testid="learnings-reading">
          <p className="mb-1 flex items-center gap-2 t6 text-text-muted">
            <span>Leitura da IA</span>
            {reading.demo && <Tag>exemplo — sem chave de IA</Tag>}
          </p>
          <ul className="space-y-1">
            {reading.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && (
        <details>
          <summary className="cursor-pointer t5 text-text">Ver todos os grupos</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ORDER.map((dim) =>
              l.dimensions[dim].length === 0 ? null : (
                <div key={dim} className="rounded-md border border-edge bg-surface-sunken p-2 t5">
                  <p className="mb-1 font-semibold">{DIM_NAME[dim]}</p>
                  {l.dimensions[dim].map((g) => (
                    <p key={g.key} className="flex justify-between gap-2">
                      <span className="capitalize">{groupLabel(dim, g.key, toLang(lang))}</span>
                      <span className={g.liftPct >= 0 ? "text-positive" : "text-negative"}>
                        {value(g.avg)} · {g.liftPct >= 0 ? "+" : ""}
                        {g.liftPct}% · {g.posts}
                      </span>
                    </p>
                  ))}
                </div>
              )
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function monthLabel(month: string, lang: UiLang): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return d.toLocaleDateString(lang === "en" ? "en-US" : "pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Card "O que funciona pra este cliente" (Dashboard do cliente).
export default function LearningsCard({ clientId, canGenerate = true }: { clientId: string; canGenerate?: boolean }) {
  const lang = useUiLang();
  const [month, setMonth] = useState(() => currentMonth());
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Payload>(`/api/clients/${clientId}/learnings?month=${month}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [clientId, month]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/clients/${clientId}/learnings`, { method: "POST", body: JSON.stringify({ month }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar a leitura");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-testid="learnings-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>O que funciona pra este cliente</SectionTitle>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid size-7 place-items-center rounded-md border border-edge t3 hover:border-edge" aria-label="Mês anterior" data-testid="learnings-prev">
            ‹
          </button>
          <span className="min-w-32 text-center t5 font-medium capitalize" data-testid="learnings-month">{monthLabel(month, lang)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid size-7 place-items-center rounded-md border border-edge t3 hover:border-edge" aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>
      {!data ? (
        <Spinner label="Cruzando posts e resultados..." />
      ) : (
        <div className="space-y-3">
          <LearningsSummary learnings={data.learnings} reading={data.reading} lang={lang} />
          {data.clicks && data.clicks.postsWithLinks > 0 && (
            <div className="rounded-md border border-edge bg-surface-sunken p-3 t3" data-testid="learnings-clicks">
              <p className="t6 text-text-muted">Cliques nos links dos posts</p>
              <p className="mt-1">{`${data.clicks.totalClicks} cliques em ${data.clicks.postsWithLinks} post(s) publicados com link`}</p>
              <ul className="mt-1 space-y-0.5 t5 text-text-muted">
                {data.clicks.byFormat.slice(0, 3).map((row) => (
                  <li key={row.key}>{`${row.key}: ${row.avg} cliques por post`}</li>
                ))}
              </ul>
            </div>
          )}
          {data.panel && (
            <p className="t5 text-text-muted" data-testid="learnings-panel">
              {data.panel.calibration
                ? `Painel de público: acertou ${data.panel.calibration.hits} de ${data.panel.calibration.total} testes que foram ao ar (${data.panel.calibration.pct}%).`
                : "Painel de público: ainda sem dados suficientes para saber se ele acerta (precisa de 5 testes que foram ao ar)."}
            </p>
          )}
          {data.learnings.hasEnoughData && canGenerate && (!data.reading || data.readingStale) && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" className="!px-3 !py-1.5 t5" onClick={generate} disabled={busy} data-testid="learnings-generate">
                {busy ? "Lendo os números..." : data.readingStale ? "Atualizar leitura da IA" : "Gerar leitura da IA (3 linhas)"}
              </Button>
              {data.readingStale && <span className="t5 text-text-muted">os números mudaram desde a última leitura</span>}
            </div>
          )}
          {error && <ErrorBox message={error} />}
        </div>
      )}
    </Card>
  );
}
