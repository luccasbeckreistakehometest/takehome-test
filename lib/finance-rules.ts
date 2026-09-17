// Regras PURAS de horas e margem: minutos de um apontamento (cronômetro ou
// manual), custo por hora (padrão da agência ou do profissional), margem por
// cliente no mês (receita do fee × horas × custo), sinalização de cliente
// que dá prejuízo e exportação CSV. Sem banco, sem React.

export type TimeEntryLike = {
  id: string;
  clientId: string;
  projectId: string | null;
  deliverableId: string | null;
  userId: string;
  userName: string;
  professionalId: string | null;
  note: string;
  startedAt: string; // ISO
  endedAt: string | null; // null = cronômetro rodando
  minutes: number; // fechado: minutos apontados; rodando: 0
  manual: boolean;
};

export type FinanceSettings = {
  defaultHourlyCost: number; // custo/hora da equipe interna (quando o apontamento não tem profissional)
  targetMarginPct: number; // abaixo disso a conta é "apertada"
  currency: string; // moeda dos fees e custos (sem conversão)
};

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  defaultHourlyCost: 0,
  targetMarginPct: 30,
  currency: "BRL",
};

export type Rates = { defaultHourlyCost: number; professional: Record<string, number> };

const money = (n: unknown, fallback = 0, max = 10_000_000) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v * 100) / 100) : fallback;
};

export function sanitizeFinanceSettings(input: Partial<FinanceSettings>, base: FinanceSettings = DEFAULT_FINANCE_SETTINGS): FinanceSettings {
  const pct = Number(input.targetMarginPct);
  return {
    defaultHourlyCost: input.defaultHourlyCost !== undefined ? money(input.defaultHourlyCost, base.defaultHourlyCost, 100_000) : base.defaultHourlyCost,
    targetMarginPct: Number.isFinite(pct) ? Math.min(95, Math.max(0, Math.round(pct))) : base.targetMarginPct,
    currency: /^[A-Z]{3}$/.test(String(input.currency ?? "")) ? String(input.currency) : base.currency,
  };
}

export function sanitizeMoney(value: unknown): number {
  return money(value);
}

// Minutos de um apontamento agora: rodando = desde o início; fechado = o
// que ficou gravado. Nunca negativo, teto de 24h por apontamento.
export function entryMinutes(entry: Pick<TimeEntryLike, "startedAt" | "endedAt" | "minutes">, now: Date = new Date()): number {
  if (entry.endedAt) return Math.max(0, Math.round(entry.minutes));
  const elapsed = Math.floor((now.getTime() - new Date(entry.startedAt).getTime()) / 60_000);
  return Math.min(24 * 60, Math.max(0, elapsed));
}

export function hourlyRateFor(entry: Pick<TimeEntryLike, "professionalId">, rates: Rates): number {
  if (entry.professionalId && rates.professional[entry.professionalId] > 0) return rates.professional[entry.professionalId];
  return rates.defaultHourlyCost;
}

export function entryCost(entry: Pick<TimeEntryLike, "startedAt" | "endedAt" | "minutes" | "professionalId">, rates: Rates, now: Date = new Date()): number {
  return Math.round(((entryMinutes(entry, now) / 60) * hourlyRateFor(entry, rates)) * 100) / 100;
}

export function monthEntries<T extends Pick<TimeEntryLike, "startedAt">>(entries: T[], month: string): T[] {
  return entries.filter((e) => e.startedAt.slice(0, 7) === month);
}

export type MarginStatus = "ok" | "thin" | "loss" | "no_fee" | "idle";

export type ClientMargin = {
  clientId: string;
  name: string;
  fee: number;
  minutes: number;
  hours: number; // decimal, 2 casas
  cost: number;
  margin: number;
  marginPct: number | null; // null sem fee
  effectiveHourlyRate: number | null; // fee / horas
  status: MarginStatus;
  entries: number;
};

// Margem do cliente no mês: fee mensal − (horas × custo/hora). "loss" =
// custa mais do que paga; "thin" = abaixo da margem-alvo; "no_fee" = tem
// horas mas nenhum fee cadastrado; "idle" = sem horas e sem fee.
export function clientMargin(input: {
  clientId: string;
  name: string;
  fee: number;
  entries: TimeEntryLike[];
  rates: Rates;
  targetMarginPct: number;
  now?: Date;
}): ClientMargin {
  const now = input.now ?? new Date();
  const minutes = input.entries.reduce((sum, e) => sum + entryMinutes(e, now), 0);
  const cost = Math.round(input.entries.reduce((sum, e) => sum + entryCost(e, input.rates, now), 0) * 100) / 100;
  const fee = money(input.fee);
  const margin = Math.round((fee - cost) * 100) / 100;
  const hours = Math.round((minutes / 60) * 100) / 100;
  const marginPct = fee > 0 ? Math.round((margin / fee) * 1000) / 10 : null;
  let status: MarginStatus;
  if (fee <= 0 && minutes === 0) status = "idle";
  else if (fee <= 0) status = "no_fee";
  else if (margin < 0) status = "loss";
  else if (marginPct !== null && marginPct < input.targetMarginPct) status = "thin";
  else status = "ok";
  return {
    clientId: input.clientId,
    name: input.name,
    fee,
    minutes,
    hours,
    cost,
    margin,
    marginPct,
    effectiveHourlyRate: minutes > 0 && fee > 0 ? Math.round((fee / (minutes / 60)) * 100) / 100 : null,
    status,
    entries: input.entries.length,
  };
}

export type MarginTotals = { fee: number; cost: number; margin: number; hours: number; marginPct: number | null; flagged: number };

export function marginTotals(rows: ClientMargin[]): MarginTotals {
  const fee = rows.reduce((s, r) => s + r.fee, 0);
  const cost = Math.round(rows.reduce((s, r) => s + r.cost, 0) * 100) / 100;
  const margin = Math.round((fee - cost) * 100) / 100;
  return {
    fee,
    cost,
    margin,
    hours: Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100,
    marginPct: fee > 0 ? Math.round((margin / fee) * 1000) / 10 : null,
    flagged: rows.filter((r) => r.status === "loss" || r.status === "thin" || r.status === "no_fee").length,
  };
}

// "12h30"
export function formatHours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

const csvCell = (value: string | number | null, decimalComma: boolean): string => {
  if (value === null) return "";
  if (typeof value === "number") {
    const text = value.toFixed(2);
    return decimalComma ? text.replace(".", ",") : text;
  }
  return /[";\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
};

// CSV para planilha: pt-BR usa ";" e vírgula decimal (abre direto no Excel
// brasileiro); en usa "," e ponto. Uma linha por cliente + total.
export function marginCsv(rows: ClientMargin[], month: string, lang: "pt" | "en" = "pt"): string {
  const pt = lang === "pt";
  const sep = pt ? ";" : ",";
  const header = pt
    ? ["Mês", "Cliente", "Fee mensal", "Horas", "Custo", "Margem", "Margem %", "Custo/hora efetivo", "Status"]
    : ["Month", "Client", "Monthly fee", "Hours", "Cost", "Margin", "Margin %", "Effective hourly rate", "Status"];
  const lines = [header.join(sep)];
  for (const r of rows) {
    lines.push(
      [month, csvCell(r.name, pt), csvCell(r.fee, pt), csvCell(r.hours, pt), csvCell(r.cost, pt), csvCell(r.margin, pt), r.marginPct === null ? "" : csvCell(r.marginPct, pt), r.effectiveHourlyRate === null ? "" : csvCell(r.effectiveHourlyRate, pt), r.status].join(sep)
    );
  }
  const t = marginTotals(rows);
  lines.push([month, pt ? "TOTAL" : "TOTAL", csvCell(t.fee, pt), csvCell(t.hours, pt), csvCell(t.cost, pt), csvCell(t.margin, pt), t.marginPct === null ? "" : csvCell(t.marginPct, pt), "", ""].join(sep));
  return lines.join("\n");
}
