import { randomUUID } from "crypto";
import { db, getClient, tenantColumn } from "./db";
import { kvKeyFor } from "./tenancy-rules";
import {
  createScheduledPost,
  getDeliverable,
  getProject,
  listDeliverables,
  logActivity,
  setDeliverableApproval,
  updateProject,
} from "./marketplace-db";
import { enqueueDirect, getConnection } from "./messaging-db";
import { getKv, setKv } from "./kv-settings";
import {
  DEFAULT_APPROVAL_RULES,
  planApprovalActions,
  sanitizeApprovalRules,
  type ApprovalActor,
  type ApprovalDecision,
  type ApprovalRules,
} from "./approval-rules";
import type { Deliverable, Project } from "./marketplace-types";

// "Aprovação que dispara ação": quando o cliente aprova uma entrega no portal,
// o plano (approval-rules) vira rascunho de post, aviso por WhatsApp e/ou
// notificação no painel — e tudo fica registrado como linha do tempo.

export type ApprovalEventAction =
  | { type: "post_draft"; postId: string; channel: string; scheduledFor: string }
  | { type: "whatsapp"; to: string; outboxId: string }
  | { type: "activity"; reason: string }
  | { type: "project_approved" }
  | { type: "changes_requested" };

export type ApprovalEvent = {
  id: string;
  deliverableId: string;
  projectId: string;
  clientId: string;
  actor: ApprovalActor;
  decision: ApprovalDecision;
  note: string;
  actions: ApprovalEventAction[];
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS approval_events (
    id TEXT PRIMARY KEY,
    deliverableId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    clientId TEXT NOT NULL,
    actor TEXT NOT NULL,
    decision TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    actions TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_approval_events_project ON approval_events(projectId, createdAt);
`);
tenantColumn("approval_events");

const RULES_KEY = "approval_rules";

// Regras de automação: por agência.
export function getApprovalRules(agencyId: string): ApprovalRules {
  return sanitizeApprovalRules(getKv<ApprovalRules>(kvKeyFor(RULES_KEY, agencyId), DEFAULT_APPROVAL_RULES));
}

export function saveApprovalRules(agencyId: string, input: Partial<ApprovalRules>): ApprovalRules {
  return setKv(kvKeyFor(RULES_KEY, agencyId), sanitizeApprovalRules({ ...getApprovalRules(agencyId), ...input }));
}

// Canal de WhatsApp da agência pronto para enviar: API com credenciais ou
// sessão logada no worker.
export function whatsappConnected(agencyId: string): boolean {
  const conn = getConnection(agencyId, "whatsapp");
  if (!conn) return false;
  if (conn.mode === "api") return Boolean(conn.apiToken && conn.apiAccountId);
  return conn.sessionReady;
}

// Enfileira um aviso para o WhatsApp da agência (regras + canal permitindo).
export function queueAgencyWhatsapp(agencyId: string, body: string): { outboxId: string; to: string } | null {
  const rules = getApprovalRules(agencyId);
  const to = rules.notifyPhone.replace(/\D/g, "");
  if (!rules.notifyWhatsapp || !to || !whatsappConnected(agencyId)) return null;
  const conn = getConnection(agencyId, "whatsapp")!;
  const msg = enqueueDirect({ agencyId, channel: "whatsapp", mode: conn.mode, toAddress: to, body });
  return { outboxId: msg.id, to };
}

type Row = Omit<ApprovalEvent, "actions"> & { actions: string };
const toEvent = (row: Row): ApprovalEvent => ({ ...row, actions: JSON.parse(row.actions) });

export function listApprovalEvents(filter: {
  deliverableId?: string;
  projectId?: string;
  clientId?: string;
  limit?: number;
}): ApprovalEvent[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = { limit: filter.limit ?? 50 };
  if (filter.deliverableId) {
    clauses.push("deliverableId = @deliverableId");
    params.deliverableId = filter.deliverableId;
  }
  if (filter.projectId) {
    clauses.push("projectId = @projectId");
    params.projectId = filter.projectId;
  }
  if (filter.clientId) {
    clauses.push("clientId = @clientId");
    params.clientId = filter.clientId;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (
    db
      .prepare(`SELECT * FROM approval_events ${where} ORDER BY createdAt DESC LIMIT @limit`)
      .all(params) as Row[]
  ).map(toEvent);
}

function recordEvent(input: Omit<ApprovalEvent, "id" | "createdAt">): ApprovalEvent {
  const event: ApprovalEvent = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  db.prepare(
    `INSERT INTO approval_events (id, agencyId, deliverableId, projectId, clientId, actor, decision, note, actions, createdAt)
     VALUES (@id, (SELECT agencyId FROM clients WHERE id = @clientId), @deliverableId, @projectId, @clientId, @actor, @decision, @note, @actions, @createdAt)`
  ).run({ ...event, actions: JSON.stringify(event.actions) });
  return event;
}

function appLink(path: string): string {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return `${base}${path}`;
}

export type DecisionResult = {
  event: ApprovalEvent;
  deliverable: Deliverable;
  project: Project;
  alreadyDecided: boolean;
};

// Decide uma entrega (aprovar / pedir ajustes) e executa o que a regra manda.
// Idempotente: aprovar de novo devolve o evento original sem repetir ações.
export function decideDeliverable(input: {
  deliverableId: string;
  actor: ApprovalActor;
  decision: ApprovalDecision;
  note?: string;
}): DecisionResult | null {
  const deliverable = getDeliverable(input.deliverableId);
  if (!deliverable || deliverable.kind === "reference") return null;
  const project = getProject(deliverable.projectId);
  const client = project ? getClient(project.clientId) : null;
  if (!project || !client) return null;
  const note = (input.note ?? "").trim().slice(0, 1000);
  const link = appLink(`/clients/${client.id}?project=${project.id}`);
  const projectHref = `/clients/${client.id}?project=${project.id}`;

  if (input.decision === "changes_requested") {
    setDeliverableApproval(deliverable.id, { approvalStatus: "changes_requested", approvedAt: null, approvalNote: note });
    const actions: ApprovalEventAction[] = [{ type: "changes_requested" }];
    logActivity({
      audience: "agency",
      clientId: client.id,
      projectId: project.id,
      text: `↩ ${client.name} pediu ajustes em "${deliverable.title}"${note ? `: ${note.slice(0, 120)}` : ""}`,
      href: projectHref,
    });
    actions.push({ type: "activity", reason: "changes" });
    if (input.actor === "client" && project.status === "client_approval") {
      updateProject(project.id, { status: "in_progress" });
      logActivity({
        audience: "professional",
        clientId: client.id,
        professionalId: project.professionalId,
        projectId: project.id,
        text: `↩ A entrega de "${project.title}" voltou para ajustes`,
        href: projectHref,
      });
    }
    const event = recordEvent({
      deliverableId: deliverable.id,
      projectId: project.id,
      clientId: client.id,
      actor: input.actor,
      decision: "changes_requested",
      note,
      actions,
    });
    return { event, deliverable: getDeliverable(deliverable.id)!, project: getProject(project.id)!, alreadyDecided: false };
  }

  if (deliverable.approvalStatus === "approved") {
    const existing = listApprovalEvents({ deliverableId: deliverable.id, limit: 1 })[0];
    if (existing) return { event: existing, deliverable, project, alreadyDecided: true };
  }

  const now = new Date().toISOString();
  setDeliverableApproval(deliverable.id, { approvalStatus: "approved", approvedAt: now, approvalNote: note });
  const planned = planApprovalActions({
    deliverable,
    project,
    client,
    rules: getApprovalRules(client.agencyId),
    actor: input.actor,
    whatsappConnected: whatsappConnected(client.agencyId),
    link,
  });

  const actions: ApprovalEventAction[] = [];
  for (const action of planned) {
    if (action.type === "post_draft") {
      const post = createScheduledPost({
        clientId: client.id,
        title: action.title,
        channel: action.channel,
        caption: action.caption,
        hashtags: [],
        scheduledFor: action.scheduledFor,
        status: "draft",
        deliverableId: deliverable.id,
      });
      actions.push({ type: "post_draft", postId: post.id, channel: post.channel, scheduledFor: post.scheduledFor });
    } else if (action.type === "whatsapp") {
      const conn = getConnection(client.agencyId, "whatsapp")!;
      const msg = enqueueDirect({
        agencyId: client.agencyId,
        channel: "whatsapp",
        mode: conn.mode,
        toAddress: action.to,
        body: action.body,
      });
      actions.push({ type: "whatsapp", to: action.to, outboxId: msg.id });
    } else {
      actions.push({ type: "activity", reason: action.reason });
    }
  }
  // O painel da agência sempre registra a aprovação (com ou sem WhatsApp)
  const postDraft = actions.find((a) => a.type === "post_draft");
  logActivity({
    audience: "agency",
    clientId: client.id,
    projectId: project.id,
    text:
      `✅ ${input.actor === "client" ? client.name : "Agência"} aprovou "${deliverable.title}"` +
      (postDraft ? " · rascunho de post criado" : ""),
    href: postDraft ? "/calendar" : projectHref,
  });

  // Todas as entregas aprovadas → a demanda avança sozinha
  const pending = listDeliverables(project.id).filter(
    (d) => d.kind !== "reference" && d.approvalStatus !== "approved"
  );
  if (pending.length === 0 && project.status === "client_approval") {
    updateProject(project.id, { status: "approved" });
    logActivity({
      audience: "professional",
      clientId: client.id,
      professionalId: project.professionalId,
      projectId: project.id,
      text: `✅ Sua entrega em "${project.title}" foi aprovada`,
      href: projectHref,
    });
    actions.push({ type: "project_approved" });
  }

  const event = recordEvent({
    deliverableId: deliverable.id,
    projectId: project.id,
    clientId: client.id,
    actor: input.actor,
    decision: "approved",
    note,
    actions,
  });
  return { event, deliverable: getDeliverable(deliverable.id)!, project: getProject(project.id)!, alreadyDecided: false };
}
