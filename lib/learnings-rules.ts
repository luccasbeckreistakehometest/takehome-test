// "O que funciona pra este cliente" — cálculo PURO e determinístico: cada
// post publicado no mês recebe o resultado médio diário dos dias seguintes
// (vendas registradas, ou conversões/cliques de métricas com período curto),
// e os posts são comparados por formato, canal, dia da semana, faixa de
// horário e tipo de gancho. Sem banco, sem IA, sem Node (roda no navegador).

import { addDays, dateKey } from "./calendar-utils";

export type LearningPost = {
  id: string;
  channel: string;
  status: "draft" | "scheduled" | "published" | "canceled";
  scheduledFor: string;
  format?: string;
  hookType?: string;
};

export type LearningSnapshot = {
  platform: string;
  periodStart: string;
  periodEnd: string;
  clicks: number;
  conversions: number;
  revenue: number;
  createdAt: string;
};

export type LearningSale = { periodStart: string; periodEnd: string; revenue: number; units: number; currency?: string };

export type LearningMetric = "revenue" | "conversions" | "clicks";
export type LearningDimension = "format" | "hookType" | "channel" | "weekday" | "hour";
export type HourBucket = "morning" | "lunch" | "afternoon" | "evening" | "night";

export const WINDOW_DAYS = 3; // resultado do dia do post + 2 dias seguintes
export const MAX_PERIOD_DAYS = 7; // períodos maiores (ex.: sync de 30 dias) não separam um post do outro
export const MIN_POSTS = 4;
export const MIN_GROUP = 2;

export type ThinReason = "few_posts" | "no_outcomes" | "few_posts_with_outcomes" | "no_variation" | "no_comparison";

export type GroupStat = { key: string; posts: number; avg: number; liftPct: number };
export type Highlight = GroupStat & { dimension: LearningDimension };

export type Learnings = {
  month: string;
  metric: LearningMetric | null;
  currency: string;
  hasEnoughData: boolean;
  reason: ThinReason | null;
  postsPublished: number;
  postsAnalyzed: number;
  baseline: number; // resultado médio diário na janela de um post
  windowDays: number;
  best: Record<LearningDimension, Highlight | null>;
  worst: Highlight | null;
  dimensions: Record<LearningDimension, GroupStat[]>;
};

const DIMENSIONS: LearningDimension[] = ["format", "hookType", "channel", "weekday", "hour"];
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function hourBucket(hour: number): HourBucket {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "lunch";
  if (hour >= 14 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

// Dia e hora locais do post ("YYYY-MM-DDTHH:mm" é lido literalmente).
export function postClock(scheduledFor: string): { day: string; hour: number; weekday: number } {
  const day = dateKey(scheduledFor);
  const local = scheduledFor.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}(:\d{2})?$/);
  const hour = local ? Number(local[1]) : scheduledFor.length > 10 ? new Date(scheduledFor).getHours() : 12;
  const [y, m, d] = day.split("-").map(Number);
  return { day, hour: Number.isFinite(hour) ? hour : 12, weekday: new Date(y, m - 1, d).getDay() };
}

// Dias de um período, inclusive; null quando longo demais para atribuir a posts.
export function periodDays(start: string, end: string): string[] | null {
  const s = (start || end).slice(0, 10);
  const e = (end || start).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e) || e < s) return null;
  const days: string[] = [];
  for (let day = s; day <= e; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > MAX_PERIOD_DAYS) return null;
  }
  return days;
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

// Série diária do resultado. Vendas: somadas e rateadas pelo período.
// Métricas: por plataforma, o snapshot mais recente que cobre o dia.
export function dailySeries(
  metric: LearningMetric,
  snapshots: LearningSnapshot[],
  sales: LearningSale[],
  range: { from: string; to: string }
): Map<string, number> {
  const series = new Map<string, number>();
  const inRange = (day: string) => day >= range.from && day <= range.to;
  if (metric === "revenue") {
    for (const sale of sales) {
      const days = periodDays(sale.periodStart, sale.periodEnd);
      if (!days) continue;
      for (const day of days) if (inRange(day)) series.set(day, (series.get(day) ?? 0) + Number(sale.revenue || 0) / days.length);
    }
    return series;
  }
  const latest = new Map<string, LearningSnapshot & { days: number }>();
  for (const snap of snapshots) {
    const days = periodDays(snap.periodStart, snap.periodEnd);
    if (!days) continue;
    for (const day of days) {
      if (!inRange(day)) continue;
      const key = `${snap.platform}|${day}`;
      const current = latest.get(key);
      if (!current || snap.createdAt > current.createdAt) latest.set(key, { ...snap, days: days.length });
    }
  }
  for (const [key, snap] of latest) {
    const day = key.split("|")[1];
    series.set(day, (series.get(day) ?? 0) + Number(snap[metric] || 0) / snap.days);
  }
  return series;
}

export function pickMetric(snapshots: LearningSnapshot[], sales: LearningSale[], range: { from: string; to: string }): LearningMetric | null {
  for (const metric of ["revenue", "conversions", "clicks"] as const) {
    const series = dailySeries(metric, snapshots, sales, range);
    if ([...series.values()].some((v) => v > 0)) return metric;
  }
  return null;
}

function emptyBest(): Record<LearningDimension, Highlight | null> {
  return { format: null, hookType: null, channel: null, weekday: null, hour: null };
}
function emptyDimensions(): Record<LearningDimension, GroupStat[]> {
  return { format: [], hookType: [], channel: [], weekday: [], hour: [] };
}

export function computeLearnings(input: {
  month: string;
  posts: LearningPost[];
  snapshots: LearningSnapshot[];
  sales: LearningSale[];
  windowDays?: number;
  minPosts?: number;
}): Learnings {
  const windowDays = input.windowDays ?? WINDOW_DAYS;
  const minPosts = input.minPosts ?? MIN_POSTS;
  const published = input.posts.filter((p) => p.status === "published" && dateKey(p.scheduledFor).slice(0, 7) === input.month);
  const base: Learnings = {
    month: input.month,
    metric: null,
    currency: input.sales.find((s) => s.currency)?.currency || "BRL",
    hasEnoughData: false,
    reason: null,
    postsPublished: published.length,
    postsAnalyzed: 0,
    baseline: 0,
    windowDays,
    best: emptyBest(),
    worst: null,
    dimensions: emptyDimensions(),
  };
  if (published.length < minPosts) return { ...base, reason: "few_posts" };

  const range = { from: `${input.month}-01`, to: addDays(monthEnd(input.month), windowDays - 1) };
  const metric = pickMetric(input.snapshots, input.sales, range);
  if (!metric) return { ...base, reason: "no_outcomes" };
  const series = dailySeries(metric, input.snapshots, input.sales, range);
  const covered = [...series.keys()].sort();
  const firstDay = covered[0];
  const lastDay = covered[covered.length - 1];

  // Resultado de cada post: média diária na janela, só nos dias cobertos
  // pelos dados (fora da cobertura não sabemos se foi zero).
  const scored = published
    .map((post) => {
      const clock = postClock(post.scheduledFor);
      const days = Array.from({ length: windowDays }, (_, i) => addDays(clock.day, i)).filter((d) => d >= firstDay && d <= lastDay);
      if (days.length === 0) return null;
      const score = days.reduce((sum, d) => sum + (series.get(d) ?? 0), 0) / days.length;
      return { post, clock, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const analyzed = { ...base, metric, postsAnalyzed: scored.length };
  if (scored.length < minPosts) return { ...analyzed, reason: "few_posts_with_outcomes" };
  const baseline = scored.reduce((s, x) => s + x.score, 0) / scored.length;
  if (scored.every((x) => Math.abs(x.score - scored[0].score) < 1e-9)) {
    return { ...analyzed, baseline: round(baseline), reason: "no_variation" };
  }

  const keyOf = (dim: LearningDimension, x: (typeof scored)[number]): string => {
    switch (dim) {
      case "format":
        return (x.post.format ?? "").trim();
      case "hookType":
        return (x.post.hookType ?? "").trim();
      case "channel":
        return x.post.channel.trim();
      case "weekday":
        return String(x.clock.weekday);
      case "hour":
        return hourBucket(x.clock.hour);
    }
  };
  const dimensions = emptyDimensions();
  for (const dim of DIMENSIONS) {
    const groups = new Map<string, number[]>();
    for (const x of scored) {
      const key = keyOf(dim, x);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), x.score]);
    }
    dimensions[dim] = [...groups.entries()]
      .map(([key, scores]) => {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return { key, posts: scores.length, avg: round(avg), liftPct: baseline > 0 ? Math.round(((avg - baseline) / baseline) * 100) : 0 };
      })
      .sort((a, b) => b.avg - a.avg || b.posts - a.posts || a.key.localeCompare(b.key));
  }

  // Melhor por dimensão: só quando há pelo menos 2 grupos comparáveis
  // (cada um com 2+ posts) e o líder está acima da média.
  const best = emptyBest();
  let worst: Highlight | null = null;
  for (const dim of DIMENSIONS) {
    const qualifying = dimensions[dim].filter((g) => g.posts >= MIN_GROUP);
    if (qualifying.length < 2) continue;
    if (qualifying[0].liftPct > 0) best[dim] = { ...qualifying[0], dimension: dim };
    const bottom = qualifying[qualifying.length - 1];
    if (bottom.liftPct < 0 && (!worst || bottom.liftPct < worst.liftPct)) worst = { ...bottom, dimension: dim };
  }
  const found = DIMENSIONS.some((d) => best[d] !== null);
  return {
    ...analyzed,
    baseline: round(baseline),
    best,
    worst,
    dimensions,
    hasEnoughData: found,
    reason: found ? null : "no_comparison",
  };
}

// ---------- Texto (prompt da IA, relatório, fixture) ----------

const HOUR_PT: Record<HourBucket, string> = { morning: "manhã", lunch: "almoço", afternoon: "tarde", evening: "noite", night: "madrugada" };
const HOUR_EN: Record<HourBucket, string> = { morning: "morning", lunch: "lunchtime", afternoon: "afternoon", evening: "evening", night: "late night" };
const WEEKDAY_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DIM_PT: Record<LearningDimension, string> = { format: "formato", hookType: "tipo de gancho", channel: "canal", weekday: "dia", hour: "horário" };
const DIM_EN: Record<LearningDimension, string> = { format: "format", hookType: "hook type", channel: "channel", weekday: "day", hour: "time of day" };
const METRIC_PT: Record<LearningMetric, string> = { revenue: "vendas registradas por dia", conversions: "conversões por dia", clicks: "cliques por dia" };
const METRIC_EN: Record<LearningMetric, string> = { revenue: "tracked sales per day", conversions: "conversions per day", clicks: "clicks per day" };

export function groupLabel(dimension: LearningDimension, key: string, lang: "pt-BR" | "en"): string {
  const en = lang === "en";
  if (dimension === "weekday") return (en ? WEEKDAY_EN : WEEKDAY_PT)[Number(key)] ?? key;
  if (dimension === "hour") return (en ? HOUR_EN : HOUR_PT)[key as HourBucket] ?? key;
  return key;
}

export function describeLearnings(l: Learnings, lang: "pt-BR" | "en" = "pt-BR"): string[] {
  const en = lang === "en";
  if (!l.hasEnoughData || !l.metric) {
    return [en ? `What works: not enough data this month (${l.reason}; ${l.postsPublished} posts published, ${l.postsAnalyzed} with results).` : `O que funciona: dados insuficientes neste mês (${l.reason}; ${l.postsPublished} posts publicados, ${l.postsAnalyzed} com resultado).`];
  }
  const lines = [
    en
      ? `What works (${l.postsAnalyzed} posts, outcome = ${METRIC_EN[l.metric]} over the ${l.windowDays} days after each post, average ${l.baseline}):`
      : `O que funciona (${l.postsAnalyzed} posts, resultado = ${METRIC_PT[l.metric]} nos ${l.windowDays} dias após cada post, média ${l.baseline}):`,
  ];
  for (const dim of DIMENSIONS) {
    const h = l.best[dim];
    if (!h) continue;
    lines.push(`- ${en ? "best" : "melhor"} ${(en ? DIM_EN : DIM_PT)[dim]}: ${groupLabel(dim, h.key, lang)} (${h.avg}, ${h.liftPct >= 0 ? "+" : ""}${h.liftPct}% ${en ? "vs average" : "vs média"}, ${h.posts} posts)`);
  }
  if (l.worst) {
    lines.push(`- ${en ? "worst" : "pior"} ${(en ? DIM_EN : DIM_PT)[l.worst.dimension]}: ${groupLabel(l.worst.dimension, l.worst.key, lang)} (${l.worst.avg}, ${l.worst.liftPct}% ${en ? "vs average" : "vs média"}, ${l.worst.posts} posts)`);
  }
  return lines;
}

export type LearningsReading = { lines: string[]; demo: boolean };

// Fixture (AI_MOCK=1 ou sem chave): 3 linhas escritas a partir dos números.
export function mockLearningsReading(l: Learnings, lang: "pt-BR" | "en"): LearningsReading {
  const en = lang === "en";
  const pick = (dim: LearningDimension) => (l.best[dim] ? groupLabel(dim, l.best[dim]!.key, lang) : null);
  const format = pick("format");
  const day = pick("weekday");
  const hour = pick("hour");
  const worst = l.worst ? groupLabel(l.worst.dimension, l.worst.key, lang) : null;
  const lines = en
    ? [
        format ? `${format} is carrying the results: posts in that format were followed by ${l.best.format!.liftPct}% more than average. [demo]` : `No single format stands out yet — keep testing. [demo]`,
        day || hour ? `Best moment so far: ${[day, hour].filter(Boolean).join(", ")}. Put next month's key posts there.` : "Timing does not change the result much yet; keep the current rhythm.",
        worst ? `Cut back on ${worst} (${l.worst!.liftPct}% vs average) or change its angle before repeating it.` : "Nothing is clearly underperforming — keep the mix and add one new test.",
      ]
    : [
        format ? `${format} está puxando o resultado: posts nesse formato vieram seguidos de ${l.best.format!.liftPct}% a mais que a média. [demo]` : `Nenhum formato se destacou ainda — continue testando. [demo]`,
        day || hour ? `Melhor momento até aqui: ${[day, hour].filter(Boolean).join(", ")}. Coloque os posts mais importantes do próximo mês aí.` : "O horário ainda não muda muito o resultado; mantenha o ritmo atual.",
        worst ? `Reduza ${worst} (${l.worst!.liftPct}% vs média) ou mude o ângulo antes de repetir.` : "Nada está claramente abaixo — mantenha o mix e inclua um teste novo.",
      ];
  return { lines, demo: true };
}
