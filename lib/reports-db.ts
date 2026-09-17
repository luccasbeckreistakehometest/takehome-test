import { randomBytes, randomUUID } from "crypto";
import { db } from "./db";
// Os módulos abaixo criam as tabelas que o relatório lê (projects,
// deliverables, annotations, scheduled_posts, metric_snapshots, sales_entries)
// — importar por eles garante que existem mesmo num banco recém-criado.
import { listProjects, listScheduledPosts } from "./marketplace-db";
import { listSales } from "./integrations-db";
import { listPulses } from "./pulse-db";
import {
  aggregateMonth,
  type MonthlyReportData,
  type ReportAnnotationInput,
  type ReportDeliverableInput,
  type ReportGenerationInput,
  type ReportMonth,
  type ReportPostInput,
  type ReportProjectInput,
  type ReportSaleInput,
  type ReportSnapshotInput,
} from "./report-aggregate";

// Relatório mensal do cliente em 1 clique: os números do mês são calculados
// ao vivo (aggregateMonth); o resumo executivo da IA é salvo por (cliente,
// mês) com um token público para o link imprimível/compartilhável.

export type MonthlyReportSummary = {
  executiveSummary: string;
  highlights: string[];
  recommendations: string[];
  demo?: boolean; // gerado por fixture (sem chave / AI_MOCK)
};

export type MonthlyReport = {
  id: string;
  clientId: string;
  month: ReportMonth;
  token: string;
  lang: "pt-BR" | "en";
  data: MonthlyReportData;
  summary: MonthlyReportSummary;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS monthly_reports (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    lang TEXT NOT NULL DEFAULT 'pt-BR',
    data TEXT NOT NULL,
    summary TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE (clientId, month)
  );
`);

type Row = Omit<MonthlyReport, "data" | "summary"> & { data: string; summary: string };

function toReport(row: Row): MonthlyReport {
  return {
    ...row,
    lang: row.lang === "en" ? "en" : "pt-BR",
    data: JSON.parse(row.data) as MonthlyReportData,
    summary: JSON.parse(row.summary) as MonthlyReportSummary,
  };
}

// Carrega tudo que o mês precisa direto do banco e agrega.
export function buildMonthData(clientId: string, month: ReportMonth): MonthlyReportData {
  const projects: ReportProjectInput[] = listProjects({ clientId }).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    createdAt: p.createdAt,
  }));
  const projectIds = projects.map((p) => p.id);
  const placeholders = projectIds.map(() => "?").join(",") || "''";
  const deliverables = (
    projectIds.length
      ? (db
          .prepare(`SELECT * FROM deliverables WHERE projectId IN (${placeholders})`)
          .all(...projectIds) as Record<string, unknown>[])
      : []
  ).map((d) => ({
    id: String(d.id),
    projectId: String(d.projectId),
    title: String(d.title),
    kind: d.kind === "reference" ? "reference" : "delivery",
    approvalStatus:
      d.approvalStatus === "approved" || d.approvalStatus === "changes_requested"
        ? d.approvalStatus
        : "pending",
    approvedAt: (d.approvedAt as string | null | undefined) ?? null,
    createdAt: String(d.createdAt),
  })) as ReportDeliverableInput[];
  const deliverableIds = deliverables.map((d) => d.id);
  const annotations = (
    deliverableIds.length
      ? (db
          .prepare(
            `SELECT deliverableId, resolved, createdAt FROM annotations WHERE deliverableId IN (${deliverableIds.map(() => "?").join(",")})`
          )
          .all(...deliverableIds) as { deliverableId: string; resolved: number; createdAt: string }[])
      : []
  ).map((a) => ({ ...a, resolved: a.resolved === 1 })) as ReportAnnotationInput[];
  const posts: ReportPostInput[] = listScheduledPosts(clientId).map((p) => ({
    id: p.id,
    title: p.title,
    channel: p.channel,
    status: p.status as ReportPostInput["status"],
    scheduledFor: p.scheduledFor,
    publishedAt: p.publishedAt,
  }));
  const snapshots = db
    .prepare("SELECT * FROM metric_snapshots WHERE clientId = ?")
    .all(clientId) as ReportSnapshotInput[];
  const sales: ReportSaleInput[] = listSales(clientId);
  const generations = db
    .prepare("SELECT type, title, createdAt FROM generations WHERE clientId = ?")
    .all(clientId) as ReportGenerationInput[];
  const pulses = listPulses(clientId, 1000);
  return aggregateMonth({ month, projects, deliverables, annotations, posts, snapshots, sales, generations, pulses });
}

export function getMonthlyReport(clientId: string, month: ReportMonth): MonthlyReport | null {
  const row = db
    .prepare("SELECT * FROM monthly_reports WHERE clientId = ? AND month = ?")
    .get(clientId, month) as Row | undefined;
  return row ? toReport(row) : null;
}

export function getMonthlyReportByToken(token: string): MonthlyReport | null {
  const row = db.prepare("SELECT * FROM monthly_reports WHERE token = ?").get(token) as Row | undefined;
  return row ? toReport(row) : null;
}

export function listMonthlyReports(clientId: string): Pick<MonthlyReport, "id" | "month" | "token" | "createdAt">[] {
  return db
    .prepare("SELECT id, month, token, createdAt FROM monthly_reports WHERE clientId = ? ORDER BY month DESC")
    .all(clientId) as Pick<MonthlyReport, "id" | "month" | "token" | "createdAt">[];
}

// Regerar substitui o resumo mas preserva o token (links já compartilhados
// continuam abrindo a versão mais recente).
export function saveMonthlyReport(input: {
  clientId: string;
  month: ReportMonth;
  lang: "pt-BR" | "en";
  data: MonthlyReportData;
  summary: MonthlyReportSummary;
}): MonthlyReport {
  const existing = getMonthlyReport(input.clientId, input.month);
  const report: MonthlyReport = {
    id: existing?.id ?? randomUUID(),
    clientId: input.clientId,
    month: input.month,
    token: existing?.token ?? randomBytes(12).toString("hex"),
    lang: input.lang,
    data: input.data,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO monthly_reports (id, clientId, month, token, lang, data, summary, createdAt)
     VALUES (@id, @clientId, @month, @token, @lang, @data, @summary, @createdAt)
     ON CONFLICT(clientId, month) DO UPDATE SET lang=@lang, data=@data, summary=@summary, createdAt=@createdAt`
  ).run({ ...report, data: JSON.stringify(report.data), summary: JSON.stringify(report.summary) });
  return report;
}
