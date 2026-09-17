// Regras PURAS do "pulso do cliente": quando perguntar (depois de cada
// aprovação, uma vez por mês, NPS a cada trimestre), tendência por mês,
// NPS e a detecção de cliente em risco (nota caindo, 😞 recente, detrator,
// silêncio longo). Sem banco, sem React — testado em isolamento.

export type PulseKind = "approval" | "monthly" | "nps";

export type PulseLike = {
  kind: PulseKind;
  score: number; // approval/monthly: 1 (😞) 2 (😐) 3 (😀) · nps: 0-10
  comment: string;
  context: string; // deliverableId (approval) · "YYYY-MM" (monthly) · "" (nps)
  createdAt: string;
};

export const PULSE_FACES: Record<1 | 2 | 3, string> = { 1: "😞", 2: "😐", 3: "😀" };

export const APPROVAL_WINDOW_DAYS = 14; // pergunta sobre a entrega até 14 dias depois da aprovação
export const NPS_EVERY_DAYS = 90; // trimestral

const DAY = 24 * 60 * 60 * 1000;

export function isValidScore(kind: PulseKind, score: number): boolean {
  if (!Number.isInteger(score)) return false;
  return kind === "nps" ? score >= 0 && score <= 10 : score >= 1 && score <= 3;
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

function daysBetween(fromIso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY);
}

export type DuePrompts = {
  approvals: { deliverableId: string; title: string; approvedAt: string }[];
  monthly: boolean;
  nps: boolean;
};

// O que perguntar agora: entregas aprovadas recentemente sem pulso, o pulso
// do mês (uma vez por mês) e o NPS (a cada 90 dias).
export function duePrompts(input: {
  pulses: PulseLike[];
  approvals: { deliverableId: string; title: string; approvedAt: string }[];
  now?: Date;
}): DuePrompts {
  const now = input.now ?? new Date();
  const answered = new Set(input.pulses.filter((p) => p.kind === "approval").map((p) => p.context));
  const approvals = input.approvals
    .filter((a) => daysBetween(a.approvedAt, now) <= APPROVAL_WINDOW_DAYS && daysBetween(a.approvedAt, now) >= 0)
    .filter((a) => !answered.has(a.deliverableId))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  const month = monthKeyOf(now.toISOString());
  const monthly = !input.pulses.some((p) => p.kind === "monthly" && p.context === month);
  const nps = !input.pulses.some((p) => p.kind === "nps" && daysBetween(p.createdAt, now) < NPS_EVERY_DAYS);
  return { approvals, monthly, nps };
}

export type NpsResult = { score: number | null; promoters: number; passives: number; detractors: number; responses: number };

export function npsFrom(scores: number[]): NpsResult {
  const valid = scores.filter((s) => Number.isInteger(s) && s >= 0 && s <= 10);
  const promoters = valid.filter((s) => s >= 9).length;
  const detractors = valid.filter((s) => s <= 6).length;
  const passives = valid.length - promoters - detractors;
  return {
    score: valid.length ? Math.round(((promoters - detractors) / valid.length) * 100) : null,
    promoters,
    passives,
    detractors,
    responses: valid.length,
  };
}

function satisfaction(pulses: PulseLike[]): PulseLike[] {
  return pulses.filter((p) => p.kind !== "nps").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export type TrendPoint = { month: string; avg: number | null; count: number };

// Média mensal (1-3) dos últimos N meses, do mais antigo ao mais recente.
export function monthlyTrend(pulses: PulseLike[], now: Date = new Date(), months = 6): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = date.toISOString().slice(0, 7);
    const scores = satisfaction(pulses)
      .filter((p) => monthKeyOf(p.createdAt) === month)
      .map((p) => p.score);
    points.push({ month, avg: avg(scores) === null ? null : Math.round(avg(scores)! * 100) / 100, count: scores.length });
  }
  return points;
}

export type RiskReason = "unhappy_recent" | "falling" | "detractor" | "silent" | "no_feedback";
export type RiskLevel = "ok" | "watch" | "risk";
export type RiskFlag = { reason: RiskReason; level: "watch" | "risk"; detail: string };

export type RiskAssessment = {
  level: RiskLevel;
  flags: RiskFlag[];
  latestScore: number | null; // 1-3
  latestAt: string | null;
  latestNps: number | null;
  daysSilent: number;
};

// Cliente em risco: 😞 nos últimos 60 dias, média caindo (últimas 2 vs as 3
// anteriores), NPS detrator no semestre, silêncio (30 dias = atenção, 60 =
// risco) ou nenhum feedback depois de 45 dias de conta.
export function assessRisk(input: {
  pulses: PulseLike[];
  lastActivityAt: string | null; // última ação do cliente (mensagem, aprovação, pulso)
  clientSince: string;
  now?: Date;
}): RiskAssessment {
  const now = input.now ?? new Date();
  const sat = satisfaction(input.pulses);
  const latest = sat[sat.length - 1] ?? null;
  const flags: RiskFlag[] = [];

  if (latest && latest.score === 1 && daysBetween(latest.createdAt, now) <= 60) {
    flags.push({ reason: "unhappy_recent", level: "risk", detail: latest.comment || "" });
  }
  if (sat.length >= 4) {
    const last = sat.slice(-2).map((p) => p.score);
    const previous = sat.slice(-5, -2).map((p) => p.score);
    const drop = (avg(previous) ?? 0) - (avg(last) ?? 0);
    if (previous.length >= 2 && drop >= 0.75) {
      flags.push({ reason: "falling", level: "risk", detail: `${(avg(previous) ?? 0).toFixed(1)} → ${(avg(last) ?? 0).toFixed(1)}` });
    }
  }
  const nps = input.pulses
    .filter((p) => p.kind === "nps")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latestNps = nps[nps.length - 1] ?? null;
  if (latestNps && latestNps.score <= 6 && daysBetween(latestNps.createdAt, now) <= 180) {
    flags.push({ reason: "detractor", level: "risk", detail: `NPS ${latestNps.score}` });
  }
  const since = input.lastActivityAt ?? input.clientSince;
  const daysSilent = Math.max(0, daysBetween(since, now));
  if (daysSilent >= 60) flags.push({ reason: "silent", level: "risk", detail: `${daysSilent}` });
  else if (daysSilent >= 30) flags.push({ reason: "silent", level: "watch", detail: `${daysSilent}` });
  if (input.pulses.length === 0 && daysBetween(input.clientSince, now) >= 45) {
    flags.push({ reason: "no_feedback", level: "watch", detail: "" });
  }
  const level: RiskLevel = flags.some((f) => f.level === "risk") ? "risk" : flags.length ? "watch" : "ok";
  return {
    level,
    flags,
    latestScore: latest?.score ?? null,
    latestAt: latest?.createdAt ?? null,
    latestNps: latestNps?.score ?? null,
    daysSilent,
  };
}

export type MonthSatisfaction = {
  hasData: boolean;
  responses: number;
  avg: number | null; // 1-3
  happy: number;
  neutral: number;
  sad: number;
  comments: string[];
  nps: NpsResult; // NPS do trimestre que termina neste mês
};

// Números do mês para o relatório: respostas 😞😐😀 do mês + NPS dos últimos
// três meses (o NPS é trimestral, então o mês pode não ter resposta própria).
export function satisfactionForMonth(pulses: PulseLike[], month: string): MonthSatisfaction {
  const inMonth = satisfaction(pulses).filter((p) => monthKeyOf(p.createdAt) === month);
  const scores = inMonth.map((p) => p.score);
  const [year, m] = month.split("-").map(Number);
  const quarterStart = new Date(Date.UTC(year, m - 3, 1)).toISOString().slice(0, 7);
  const quarterNps = pulses
    .filter((p) => p.kind === "nps" && monthKeyOf(p.createdAt) >= quarterStart && monthKeyOf(p.createdAt) <= month)
    .map((p) => p.score);
  const nps = npsFrom(quarterNps);
  return {
    hasData: inMonth.length > 0 || nps.responses > 0,
    responses: inMonth.length,
    avg: avg(scores) === null ? null : Math.round(avg(scores)! * 100) / 100,
    happy: scores.filter((s) => s === 3).length,
    neutral: scores.filter((s) => s === 2).length,
    sad: scores.filter((s) => s === 1).length,
    comments: inMonth.map((p) => p.comment.trim()).filter(Boolean).slice(0, 6),
    nps,
  };
}
