import { randomUUID } from "crypto";
import { db, listClients } from "./db";
// approval_events / account_messages precisam existir para a última atividade
import { listApprovalEvents } from "./approvals-db";
import { listDeliverables, listProjects, logActivity } from "./marketplace-db";
import {
  assessRisk,
  duePrompts,
  isValidScore,
  monthKeyOf,
  monthlyTrend,
  type DuePrompts,
  type PulseKind,
  type PulseLike,
  type RiskAssessment,
  type TrendPoint,
} from "./pulse-rules";

// Pulso do cliente / NPS: uma resposta de 1 clique por aprovação, por mês e
// por trimestre, guardada por cliente. A agência lê tendência e risco.

export type PulseEntry = PulseLike & { id: string; clientId: string; userId: string; createdAt: string };

db.exec(`
  CREATE TABLE IF NOT EXISTS client_pulses (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    score INTEGER NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '',
    userId TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pulses_client ON client_pulses(clientId, createdAt);
`);

export function listPulses(clientId: string, limit = 200): PulseEntry[] {
  return db
    .prepare("SELECT * FROM client_pulses WHERE clientId = ? ORDER BY createdAt DESC LIMIT ?")
    .all(clientId, limit) as PulseEntry[];
}

// Entregas aprovadas (com data) do cliente — base dos prompts "como foi essa entrega?".
export function listApprovedDeliverables(clientId: string): { deliverableId: string; title: string; approvedAt: string }[] {
  const out: { deliverableId: string; title: string; approvedAt: string }[] = [];
  for (const project of listProjects({ clientId })) {
    for (const d of listDeliverables(project.id)) {
      if (d.kind === "delivery" && d.approvalStatus === "approved" && d.approvedAt) {
        out.push({ deliverableId: d.id, title: d.title, approvedAt: d.approvedAt });
      }
    }
  }
  return out;
}

// Última vez que o CLIENTE fez algo: mensagem no chat da conta, decisão de
// aprovação no portal ou resposta de pulso.
export function lastClientActivityAt(clientId: string): string | null {
  const message = db
    .prepare("SELECT MAX(createdAt) AS at FROM account_messages WHERE clientId = ? AND sender = 'client'")
    .get(clientId) as { at: string | null };
  const approval = listApprovalEvents({ clientId, limit: 1 }).find((e) => e.actor === "client")?.createdAt ?? null;
  const pulse = db.prepare("SELECT MAX(createdAt) AS at FROM client_pulses WHERE clientId = ?").get(clientId) as { at: string | null };
  const candidates = [message.at, approval, pulse.at].filter((x): x is string => Boolean(x));
  return candidates.length ? candidates.sort().at(-1)! : null;
}

export type RecordResult = { ok: true; pulse: PulseEntry } | { ok: false; reason: "invalid_score" | "duplicate" | "unknown_context" };

// Uma resposta por entrega, uma por mês, uma por trimestre (NPS).
export function recordPulse(input: {
  clientId: string;
  kind: PulseKind;
  score: number;
  comment?: string;
  context?: string;
  userId: string;
  at?: Date;
}): RecordResult {
  if (!isValidScore(input.kind, input.score)) return { ok: false, reason: "invalid_score" };
  const at = input.at ?? new Date();
  let context = (input.context ?? "").trim();
  if (input.kind === "monthly") context = monthKeyOf(at.toISOString());
  if (input.kind === "nps") context = "";
  if (input.kind === "approval") {
    if (!context || !listApprovedDeliverables(input.clientId).some((a) => a.deliverableId === context)) {
      return { ok: false, reason: "unknown_context" };
    }
  }
  const existing = listPulses(input.clientId);
  const due = duePrompts({ pulses: existing, approvals: listApprovedDeliverables(input.clientId), now: at });
  const duplicate =
    input.kind === "approval"
      ? !due.approvals.some((a) => a.deliverableId === context) && existing.some((p) => p.kind === "approval" && p.context === context)
      : input.kind === "monthly"
        ? !due.monthly
        : !due.nps;
  if (duplicate) return { ok: false, reason: "duplicate" };
  const pulse: PulseEntry = {
    id: randomUUID(),
    clientId: input.clientId,
    kind: input.kind,
    score: input.score,
    comment: (input.comment ?? "").trim().slice(0, 600),
    context,
    userId: input.userId,
    createdAt: at.toISOString(),
  };
  db.prepare(
    `INSERT INTO client_pulses (id, clientId, kind, score, comment, context, userId, createdAt)
     VALUES (@id, @clientId, @kind, @score, @comment, @context, @userId, @createdAt)`
  ).run(pulse);
  return { ok: true, pulse };
}

export type ClientPulseView = {
  due: DuePrompts;
  recent: PulseEntry[];
  trend: TrendPoint[];
  risk: RiskAssessment;
  lastActivityAt: string | null;
};

export function clientPulseView(clientId: string, clientSince: string, at: Date = new Date()): ClientPulseView {
  const pulses = listPulses(clientId);
  const lastActivityAt = lastClientActivityAt(clientId);
  return {
    due: duePrompts({ pulses, approvals: listApprovedDeliverables(clientId), now: at }),
    recent: pulses.slice(0, 12),
    trend: monthlyTrend(pulses, at),
    risk: assessRisk({ pulses, lastActivityAt, clientSince, now: at }),
    lastActivityAt,
  };
}

export type PulseOverviewRow = {
  id: string;
  name: string;
  industry: string;
  responses: number;
  latestScore: number | null;
  latestAt: string | null;
  latestNps: number | null;
  trend: TrendPoint[];
  risk: RiskAssessment;
  lastActivityAt: string | null;
};

// Visão da agência: cada cliente com tendência e risco; os em risco primeiro.
export function pulseOverview(at: Date = new Date()): { clients: PulseOverviewRow[]; atRisk: PulseOverviewRow[]; answered: number } {
  const order: Record<string, number> = { risk: 0, watch: 1, ok: 2 };
  const clients = listClients()
    .map((client) => {
      const pulses = listPulses(client.id);
      const lastActivityAt = lastClientActivityAt(client.id);
      const risk = assessRisk({ pulses, lastActivityAt, clientSince: client.createdAt, now: at });
      return {
        id: client.id,
        name: client.name,
        industry: client.industry,
        responses: pulses.length,
        latestScore: risk.latestScore,
        latestAt: risk.latestAt,
        latestNps: risk.latestNps,
        trend: monthlyTrend(pulses, at),
        risk,
        lastActivityAt,
      };
    })
    .sort((a, b) => order[a.risk.level] - order[b.risk.level] || a.name.localeCompare(b.name));
  return {
    clients,
    atRisk: clients.filter((c) => c.risk.level !== "ok"),
    answered: clients.reduce((sum, c) => sum + c.responses, 0),
  };
}

// Avisa a agência quando chega um 😞 ou um NPS detrator — é o momento de ligar.
export function notifyOnBadPulse(pulse: PulseEntry, clientName: string): void {
  const bad = (pulse.kind !== "nps" && pulse.score === 1) || (pulse.kind === "nps" && pulse.score <= 6);
  if (!bad) return;
  logActivity({
    audience: "agency",
    clientId: pulse.clientId,
    text: `⚠️ ${clientName} respondeu ${pulse.kind === "nps" ? `NPS ${pulse.score}` : "😞"}${pulse.comment ? `: "${pulse.comment.slice(0, 100)}"` : ""} — vale uma ligação`,
    href: `/clients/${pulse.clientId}`,
  });
}
