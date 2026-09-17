// Agregação PURA do relatório mensal do cliente: recebe listas já carregadas
// e devolve os números do mês. Sem banco, sem IA — testável em isolamento.

import { satisfactionForMonth, type MonthSatisfaction, type PulseLike } from "./pulse-rules";
import { computeLearnings, describeLearnings, type Learnings, type LearningsReading } from "./learnings-rules";

export type ReportMonth = string; // "YYYY-MM"

export type ReportDeliverableInput = {
  id: string;
  projectId: string;
  title: string;
  kind: "delivery" | "reference";
  approvalStatus?: "pending" | "approved" | "changes_requested";
  approvedAt?: string | null;
  createdAt: string;
};

export type ReportProjectInput = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export type ReportAnnotationInput = {
  deliverableId: string;
  resolved: boolean;
  createdAt: string;
};

export type ReportPostInput = {
  id: string;
  title: string;
  channel: string;
  status: "draft" | "scheduled" | "published" | "canceled";
  scheduledFor: string;
  publishedAt: string | null;
  format?: string; // atributos usados nos "aprendizados" do mês
  hookType?: string;
};

export type ReportSnapshotInput = {
  platform: string;
  periodStart: string;
  periodEnd: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  createdAt: string;
};

export type ReportSaleInput = {
  source: string;
  periodStart: string;
  periodEnd: string;
  revenue: number;
  units: number;
  currency: string;
};

export type ReportGenerationInput = { type: string; title: string; createdAt: string };

export type ReportPulseInput = PulseLike;

export type ReportInput = {
  month: ReportMonth;
  projects: ReportProjectInput[];
  deliverables: ReportDeliverableInput[];
  annotations: ReportAnnotationInput[];
  posts: ReportPostInput[];
  snapshots: ReportSnapshotInput[];
  sales: ReportSaleInput[];
  generations: ReportGenerationInput[];
  pulses?: ReportPulseInput[]; // pulso do cliente (😞😐😀 + NPS); ausente em relatórios antigos
};

export type MonthlyReportData = {
  month: ReportMonth;
  range: { start: string; end: string };
  shipped: {
    total: number;
    approved: number;
    pending: number;
    changesRequested: number;
    items: {
      id: string;
      title: string;
      projectTitle: string;
      approvalStatus: "pending" | "approved" | "changes_requested";
      approvedAt: string | null;
      createdAt: string;
      annotations: number;
      openAnnotations: number;
    }[];
  };
  projects: { created: number; completed: number; active: number };
  annotations: { total: number; resolved: number };
  posts: {
    scheduled: number;
    published: number;
    canceled: number;
    drafts: number;
    byChannel: { channel: string; count: number }[];
  };
  metrics: {
    hasData: boolean;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    platforms: string[];
  };
  sales: { hasData: boolean; revenue: number; units: number; entries: number; currency: string };
  generations: { count: number; items: { type: string; title: string; createdAt: string }[] };
  satisfaction?: MonthSatisfaction;
  // o que funcionou no mês (determinístico) + leitura da IA, quando existir
  learnings?: Learnings;
  learningsReading?: LearningsReading | null;
  // links rastreáveis mais clicados no mês
  topLinks?: { label: string; clicks: number }[];
  // radar de IA do mês (simulação, com aviso)
  aiRadar?: { ranAt: string; shareOfVoice: number; answersWithClient: number; questions: number; actions: string[]; disclaimer: string; demo: boolean } | null;
};

export function isValidMonth(month: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const year = Number(month.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

// Mês corrente em "YYYY-MM" (UTC).
export function currentMonth(now: Date = new Date()): ReportMonth {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: ReportMonth, delta: number): ReportMonth {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const date = new Date(Date.UTC(year, index, 1));
  return currentMonth(date);
}

// Limites do mês em ISO (UTC): [start, end)
export function monthRange(month: ReportMonth): { start: string; end: string } {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1;
  return {
    start: new Date(Date.UTC(year, index, 1)).toISOString(),
    end: new Date(Date.UTC(year, index + 1, 1)).toISOString(),
  };
}

function inMonth(iso: string | null | undefined, range: { start: string; end: string }): boolean {
  if (!iso) return false;
  // Datas só com dia (YYYY-MM-DD) e datas com hora local (sem Z) são
  // comparadas pelo prefixo do mês — evita deslocar o mês por fuso.
  if (iso.length <= 16) return iso.slice(0, 7) === range.start.slice(0, 7);
  return iso >= range.start && iso < range.end;
}

// Períodos (vendas/snapshots) contam quando se sobrepõem ao mês.
function overlapsMonth(start: string, end: string, range: { start: string; end: string }): boolean {
  const s = (start || end).slice(0, 10);
  const e = (end || start).slice(0, 10);
  if (!s && !e) return false;
  const monthStart = range.start.slice(0, 10);
  const monthEndExclusive = range.end.slice(0, 10);
  return s < monthEndExclusive && e >= monthStart;
}

export function aggregateMonth(input: ReportInput): MonthlyReportData {
  const range = monthRange(input.month);
  const projectTitle = new Map(input.projects.map((p) => [p.id, p.title]));
  const annotationsByDeliverable = new Map<string, ReportAnnotationInput[]>();
  for (const a of input.annotations) {
    const list = annotationsByDeliverable.get(a.deliverableId) ?? [];
    list.push(a);
    annotationsByDeliverable.set(a.deliverableId, list);
  }

  // "O que foi entregue": entregas do mês (criadas OU aprovadas no mês)
  const shippedItems = input.deliverables
    .filter((d) => d.kind !== "reference")
    .filter((d) => inMonth(d.createdAt, range) || inMonth(d.approvedAt ?? null, range))
    .map((d) => {
      const annotations = annotationsByDeliverable.get(d.id) ?? [];
      return {
        id: d.id,
        title: d.title,
        projectTitle: projectTitle.get(d.projectId) ?? "",
        approvalStatus: d.approvalStatus ?? "pending",
        approvedAt: d.approvedAt ?? null,
        createdAt: d.createdAt,
        annotations: annotations.length,
        openAnnotations: annotations.filter((a) => !a.resolved).length,
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const monthAnnotations = input.annotations.filter((a) => inMonth(a.createdAt, range));

  const monthPosts = input.posts.filter((p) => inMonth(p.scheduledFor, range));
  const byChannelMap = new Map<string, number>();
  for (const post of monthPosts) {
    if (post.status === "canceled") continue;
    byChannelMap.set(post.channel, (byChannelMap.get(post.channel) ?? 0) + 1);
  }

  const monthSnapshots = input.snapshots.filter((s) =>
    overlapsMonth(s.periodStart, s.periodEnd, range)
  );
  // Um snapshot por plataforma (o mais recente), para não somar duplicado
  const latestByPlatform = new Map<string, ReportSnapshotInput>();
  for (const snap of monthSnapshots) {
    const current = latestByPlatform.get(snap.platform);
    if (!current || snap.createdAt > current.createdAt) latestByPlatform.set(snap.platform, snap);
  }
  const metricRows = Array.from(latestByPlatform.values());
  const sum = (key: keyof Pick<ReportSnapshotInput, "spend" | "impressions" | "clicks" | "conversions" | "revenue">) =>
    metricRows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);

  const monthSales = input.sales.filter((s) => overlapsMonth(s.periodStart, s.periodEnd, range));
  const monthGenerations = input.generations.filter((g) => inMonth(g.createdAt, range));

  return {
    month: input.month,
    range,
    shipped: {
      total: shippedItems.length,
      approved: shippedItems.filter((i) => i.approvalStatus === "approved").length,
      pending: shippedItems.filter((i) => i.approvalStatus === "pending").length,
      changesRequested: shippedItems.filter((i) => i.approvalStatus === "changes_requested").length,
      items: shippedItems,
    },
    projects: {
      created: input.projects.filter((p) => inMonth(p.createdAt, range)).length,
      completed: input.projects.filter(
        (p) => ["approved", "paid"].includes(p.status) && inMonth(p.createdAt, range)
      ).length,
      active: input.projects.filter((p) => !["approved", "paid"].includes(p.status)).length,
    },
    annotations: {
      total: monthAnnotations.length,
      resolved: monthAnnotations.filter((a) => a.resolved).length,
    },
    posts: {
      scheduled: monthPosts.filter((p) => p.status === "scheduled").length,
      published: monthPosts.filter((p) => p.status === "published").length,
      canceled: monthPosts.filter((p) => p.status === "canceled").length,
      drafts: monthPosts.filter((p) => p.status === "draft").length,
      byChannel: Array.from(byChannelMap.entries())
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count),
    },
    metrics: {
      hasData: metricRows.length > 0,
      spend: sum("spend"),
      impressions: sum("impressions"),
      clicks: sum("clicks"),
      conversions: sum("conversions"),
      revenue: sum("revenue"),
      platforms: metricRows.map((r) => r.platform),
    },
    sales: {
      hasData: monthSales.length > 0,
      revenue: monthSales.reduce((acc, s) => acc + s.revenue, 0),
      units: monthSales.reduce((acc, s) => acc + s.units, 0),
      entries: monthSales.length,
      currency: monthSales[0]?.currency || "BRL",
    },
    generations: {
      count: monthGenerations.length,
      items: monthGenerations.map((g) => ({ type: g.type, title: g.title, createdAt: g.createdAt })),
    },
    satisfaction: satisfactionForMonth(input.pulses ?? [], input.month),
    learnings: computeLearnings({
      month: input.month,
      posts: input.posts.map((p) => ({ id: p.id, channel: p.channel, status: p.status, scheduledFor: p.scheduledFor, format: p.format, hookType: p.hookType })),
      snapshots: input.snapshots,
      sales: input.sales,
    }),
  };
}

// Texto compacto do mês para o prompt da IA (e para o fixture).
export function describeMonth(data: MonthlyReportData): string {
  const lines: string[] = [];
  lines.push(`Mês: ${data.month}`);
  lines.push(
    `Entregas: ${data.shipped.total} (aprovadas ${data.shipped.approved}, pendentes ${data.shipped.pending}, com ajustes pedidos ${data.shipped.changesRequested})`
  );
  for (const item of data.shipped.items.slice(0, 20)) {
    lines.push(
      `- "${item.title}" (${item.projectTitle || "sem demanda"}) · ${item.approvalStatus} · ${item.annotations} anotações (${item.openAnnotations} abertas)`
    );
  }
  lines.push(
    `Demandas: ${data.projects.created} abertas no mês, ${data.projects.completed} concluídas, ${data.projects.active} em andamento`
  );
  lines.push(
    `Posts: ${data.posts.scheduled} agendados, ${data.posts.published} publicados, ${data.posts.drafts} rascunhos, ${data.posts.canceled} cancelados` +
      (data.posts.byChannel.length
        ? ` · por canal: ${data.posts.byChannel.map((c) => `${c.channel} ${c.count}`).join(", ")}`
        : "")
  );
  lines.push(
    data.metrics.hasData
      ? `Mídia (${data.metrics.platforms.join(", ")}): investimento ${data.metrics.spend}, impressões ${data.metrics.impressions}, cliques ${data.metrics.clicks}, conversões ${data.metrics.conversions}, receita atribuída ${data.metrics.revenue}`
      : "Mídia: sem métricas conectadas neste mês"
  );
  lines.push(
    data.sales.hasData
      ? `Vendas: ${data.sales.currency} ${data.sales.revenue} em ${data.sales.units} unidades/negócios (${data.sales.entries} registros)`
      : "Vendas: sem registros neste mês"
  );
  lines.push(`Entregáveis de IA gerados: ${data.generations.count}`);
  for (const g of data.generations.items.slice(0, 10)) lines.push(`- ${g.type}: ${g.title}`);
  lines.push(`Revisões: ${data.annotations.total} anotações (${data.annotations.resolved} resolvidas)`);
  const sat = data.satisfaction;
  if (sat?.hasData) {
    lines.push(
      `Satisfação do cliente: ${sat.responses} resposta(s) no mês (😀 ${sat.happy}, 😐 ${sat.neutral}, 😞 ${sat.sad}${sat.avg !== null ? `, média ${sat.avg}/3` : ""})` +
        (sat.nps.score !== null ? ` · NPS do trimestre ${sat.nps.score} (${sat.nps.responses} resposta(s))` : "")
    );
    for (const c of sat.comments) lines.push(`- comentário do cliente: "${c}"`);
  } else {
    lines.push("Satisfação do cliente: sem respostas neste mês");
  }
  if (data.learnings) lines.push(...describeLearnings(data.learnings));
  return lines.join("\n");
}
