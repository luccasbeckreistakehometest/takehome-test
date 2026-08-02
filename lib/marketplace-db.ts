import { randomUUID } from "crypto";
import { db } from "./db";
import type {
  Annotation,
  ArtReview,
  Deliverable,
  EscrowStatus,
  Professional,
  ProfessionalInput,
  Project,
  ProjectMessage,
  ProjectStatus,
  Prospect,
  ProspectStatus,
} from "./marketplace-types";

db.exec(`
  CREATE TABLE IF NOT EXISTS professionals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    skills TEXT NOT NULL DEFAULT '[]',
    specialties TEXT NOT NULL DEFAULT '',
    marketFocus TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    portfolio TEXT NOT NULL DEFAULT '[]',
    priceRange TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    professionalId TEXT REFERENCES professionals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    brief TEXT NOT NULL DEFAULT '',
    skillsNeeded TEXT NOT NULL DEFAULT '[]',
    location TEXT NOT NULL DEFAULT '',
    budget TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    escrow TEXT NOT NULL DEFAULT 'none',
    matchResult TEXT NOT NULL DEFAULT '',
    sketch TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS project_messages (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    mime TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'delivery',
    meaning TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    deliverableId TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
    x REAL NOT NULL,
    y REAL NOT NULL,
    comment TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS art_reviews (
    id TEXT PRIMARY KEY,
    deliverableId TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    clientId TEXT,
    projectId TEXT,
    title TEXT NOT NULL,
    scheduledAt TEXT NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    reasoning TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY,
    searchQuery TEXT NOT NULL,
    name TEXT NOT NULL,
    segment TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    instagram TEXT NOT NULL DEFAULT '',
    whyFit TEXT NOT NULL DEFAULT '',
    marketingMaturity TEXT NOT NULL DEFAULT '',
    suggestedApproach TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    clientId TEXT REFERENCES clients(id) ON DELETE SET NULL,
    createdAt TEXT NOT NULL
  );
`);

const now = () => new Date().toISOString();

// Migração: coluna do sketch de referência da IA
const projectColumns = (
  db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]
).map((column) => column.name);
if (projectColumns.length > 0 && !projectColumns.includes("sketch")) {
  db.exec("ALTER TABLE projects ADD COLUMN sketch TEXT NOT NULL DEFAULT ''");
}
const deliverableColumns = (
  db.prepare("PRAGMA table_info(deliverables)").all() as { name: string }[]
).map((column) => column.name);
if (deliverableColumns.length > 0 && !deliverableColumns.includes("kind")) {
  db.exec(`
    ALTER TABLE deliverables ADD COLUMN kind TEXT NOT NULL DEFAULT 'delivery';
    ALTER TABLE deliverables ADD COLUMN meaning TEXT NOT NULL DEFAULT '';
  `);
}

// ---------- Profissionais ----------

type ProfessionalRow = Omit<Professional, "skills" | "portfolio"> & {
  skills: string;
  portfolio: string;
};

function toProfessional(row: ProfessionalRow): Professional {
  return {
    ...row,
    skills: JSON.parse(row.skills),
    portfolio: JSON.parse(row.portfolio),
  };
}

export function listProfessionals(): Professional[] {
  return (
    db.prepare("SELECT * FROM professionals ORDER BY createdAt DESC").all() as ProfessionalRow[]
  ).map(toProfessional);
}

export function getProfessional(id: string): Professional | null {
  const row = db.prepare("SELECT * FROM professionals WHERE id = ?").get(id) as
    | ProfessionalRow
    | undefined;
  return row ? toProfessional(row) : null;
}

export function createProfessional(input: ProfessionalInput): Professional {
  const professional: Professional = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO professionals (id, name, role, email, phone, location, skills, specialties, marketFocus, bio, portfolio, priceRange, createdAt)
     VALUES (@id, @name, @role, @email, @phone, @location, @skills, @specialties, @marketFocus, @bio, @portfolio, @priceRange, @createdAt)`
  ).run({
    ...professional,
    skills: JSON.stringify(professional.skills),
    portfolio: JSON.stringify(professional.portfolio),
  });
  return professional;
}

export function updateProfessional(
  id: string,
  input: ProfessionalInput
): Professional | null {
  if (!getProfessional(id)) return null;
  db.prepare(
    `UPDATE professionals SET name=@name, role=@role, email=@email, phone=@phone, location=@location, skills=@skills, specialties=@specialties, marketFocus=@marketFocus, bio=@bio, portfolio=@portfolio, priceRange=@priceRange WHERE id=@id`
  ).run({
    ...input,
    id,
    skills: JSON.stringify(input.skills),
    portfolio: JSON.stringify(input.portfolio),
  });
  return getProfessional(id);
}

export function deleteProfessional(id: string): boolean {
  return db.prepare("DELETE FROM professionals WHERE id = ?").run(id).changes > 0;
}

export type ProfessionalStats = {
  completed: number;
  active: number;
  avgScore: number | null;
  reviewCount: number;
};

export function getProfessionalStats(professionalId: string): ProfessionalStats {
  const completed = db
    .prepare(
      "SELECT COUNT(*) as c FROM projects WHERE professionalId = ? AND status IN ('approved','paid')"
    )
    .get(professionalId) as { c: number };
  const active = db
    .prepare(
      "SELECT COUNT(*) as c FROM projects WHERE professionalId = ? AND status IN ('matched','in_progress','in_review')"
    )
    .get(professionalId) as { c: number };
  const review = db
    .prepare(
      `SELECT AVG(r.score) as avg, COUNT(r.id) as c FROM art_reviews r
       JOIN deliverables d ON d.id = r.deliverableId
       JOIN projects p ON p.id = d.projectId
       WHERE p.professionalId = ?`
    )
    .get(professionalId) as { avg: number | null; c: number };
  return {
    completed: completed.c,
    active: active.c,
    avgScore: review.avg !== null ? Math.round(review.avg) : null,
    reviewCount: review.c,
  };
}

// ---------- Projetos (demandas) ----------

type ProjectRow = Omit<Project, "skillsNeeded"> & { skillsNeeded: string };

function toProject(row: ProjectRow): Project {
  return {
    ...row,
    skillsNeeded: JSON.parse(row.skillsNeeded),
    status: row.status as ProjectStatus,
    escrow: row.escrow as EscrowStatus,
  };
}

export function listProjects(filter: {
  clientId?: string;
  professionalId?: string;
  openOnly?: boolean;
}): Project[] {
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (filter.clientId) {
    clauses.push("clientId = @clientId");
    params.clientId = filter.clientId;
  }
  if (filter.professionalId) {
    clauses.push("professionalId = @professionalId");
    params.professionalId = filter.professionalId;
  }
  if (filter.openOnly) clauses.push("status = 'open'");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (
    db
      .prepare(`SELECT * FROM projects ${where} ORDER BY createdAt DESC`)
      .all(params) as ProjectRow[]
  ).map(toProject);
}

export function getProject(id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | ProjectRow
    | undefined;
  return row ? toProject(row) : null;
}

export function createProject(input: {
  clientId: string;
  title: string;
  brief: string;
  skillsNeeded: string[];
  location: string;
  budget: string;
  deadline: string;
}): Project {
  const project: Project = {
    ...input,
    id: randomUUID(),
    professionalId: null,
    status: "open",
    escrow: "none",
    matchResult: "",
    sketch: "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO projects (id, clientId, professionalId, title, brief, skillsNeeded, location, budget, deadline, status, escrow, matchResult, sketch, createdAt)
     VALUES (@id, @clientId, @professionalId, @title, @brief, @skillsNeeded, @location, @budget, @deadline, @status, @escrow, @matchResult, @sketch, @createdAt)`
  ).run({ ...project, skillsNeeded: JSON.stringify(project.skillsNeeded) });
  return project;
}

export function updateProject(
  id: string,
  patch: Partial<
    Pick<Project, "professionalId" | "status" | "escrow" | "matchResult" | "sketch" | "title" | "brief" | "budget" | "deadline">
  >
): Project | null {
  const existing = getProject(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  db.prepare(
    `UPDATE projects SET professionalId=@professionalId, status=@status, escrow=@escrow, matchResult=@matchResult, sketch=@sketch, title=@title, brief=@brief, budget=@budget, deadline=@deadline WHERE id=@id`
  ).run({
    id,
    professionalId: merged.professionalId,
    status: merged.status,
    escrow: merged.escrow,
    matchResult: merged.matchResult,
    sketch: merged.sketch,
    title: merged.title,
    brief: merged.brief,
    budget: merged.budget,
    deadline: merged.deadline,
  });
  return getProject(id);
}

export function deleteProject(id: string): boolean {
  return db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
}

// ---------- Mensagens ----------

export function listMessages(projectId: string): ProjectMessage[] {
  return db
    .prepare("SELECT * FROM project_messages WHERE projectId = ? ORDER BY createdAt ASC")
    .all(projectId) as ProjectMessage[];
}

export function createMessage(input: {
  projectId: string;
  sender: "agency" | "professional";
  text: string;
}): ProjectMessage {
  const message: ProjectMessage = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    "INSERT INTO project_messages (id, projectId, sender, text, createdAt) VALUES (@id, @projectId, @sender, @text, @createdAt)"
  ).run(message);
  return message;
}

// ---------- Entregas, anotações e análises ----------

export function listDeliverables(projectId: string): Deliverable[] {
  return db
    .prepare("SELECT * FROM deliverables WHERE projectId = ? ORDER BY createdAt DESC")
    .all(projectId) as Deliverable[];
}

export function getDeliverable(id: string): Deliverable | null {
  return (
    (db.prepare("SELECT * FROM deliverables WHERE id = ?").get(id) as Deliverable) ?? null
  );
}

export function createDeliverable(input: {
  projectId: string;
  title: string;
  mime: string;
  kind?: "delivery" | "reference";
  meaning?: string;
}): Deliverable {
  const deliverable: Deliverable = {
    ...input,
    kind: input.kind ?? "delivery",
    meaning: input.meaning ?? "",
    id: randomUUID(),
    createdAt: now(),
  };
  db.prepare(
    "INSERT INTO deliverables (id, projectId, title, mime, kind, meaning, createdAt) VALUES (@id, @projectId, @title, @mime, @kind, @meaning, @createdAt)"
  ).run(deliverable);
  return deliverable;
}

export function deleteDeliverable(id: string): boolean {
  return db.prepare("DELETE FROM deliverables WHERE id = ?").run(id).changes > 0;
}

type AnnotationRow = Omit<Annotation, "resolved"> & { resolved: number };

export function listAnnotations(deliverableId: string): Annotation[] {
  return (
    db
      .prepare("SELECT * FROM annotations WHERE deliverableId = ? ORDER BY createdAt ASC")
      .all(deliverableId) as AnnotationRow[]
  ).map((row) => ({ ...row, resolved: row.resolved === 1 }));
}

export function createAnnotation(input: {
  deliverableId: string;
  x: number;
  y: number;
  comment: string;
}): Annotation {
  const annotation = { ...input, id: randomUUID(), resolved: 0, createdAt: now() };
  db.prepare(
    "INSERT INTO annotations (id, deliverableId, x, y, comment, resolved, createdAt) VALUES (@id, @deliverableId, @x, @y, @comment, @resolved, @createdAt)"
  ).run(annotation);
  return { ...annotation, resolved: false };
}

export function setAnnotationResolved(id: string, resolved: boolean): boolean {
  return (
    db
      .prepare("UPDATE annotations SET resolved = ? WHERE id = ?")
      .run(resolved ? 1 : 0, id).changes > 0
  );
}

export function deleteAnnotation(id: string): boolean {
  return db.prepare("DELETE FROM annotations WHERE id = ?").run(id).changes > 0;
}

export function listArtReviews(deliverableId: string): ArtReview[] {
  return db
    .prepare("SELECT * FROM art_reviews WHERE deliverableId = ? ORDER BY createdAt DESC")
    .all(deliverableId) as ArtReview[];
}

export function createArtReview(input: {
  deliverableId: string;
  score: number;
  content: string;
}): ArtReview {
  const review: ArtReview = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    "INSERT INTO art_reviews (id, deliverableId, score, content, createdAt) VALUES (@id, @deliverableId, @score, @content, @createdAt)"
  ).run(review);
  return review;
}

// ---------- Reuniões ----------

// Migração: reuniões passam a poder ser de conta (clientId) além de demanda
// (projectId), e ganham "reasoning" (motivo, quando recomendadas pela IA).
const meetingColumns = (
  db.prepare("PRAGMA table_info(meetings)").all() as { name: string }[]
).map((column) => column.name);
if (meetingColumns.length > 0 && !meetingColumns.includes("clientId")) {
  db.exec(`
    CREATE TABLE meetings_new (
      id TEXT PRIMARY KEY,
      clientId TEXT,
      projectId TEXT,
      title TEXT NOT NULL,
      scheduledAt TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      reasoning TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
    INSERT INTO meetings_new (id, clientId, projectId, title, scheduledAt, link, notes, reasoning, createdAt)
      SELECT m.id, p.clientId, m.projectId, m.title, m.scheduledAt, m.link, m.notes, '', m.createdAt
      FROM meetings m LEFT JOIN projects p ON p.id = m.projectId;
    DROP TABLE meetings;
    ALTER TABLE meetings_new RENAME TO meetings;
  `);
}

export type Meeting = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  title: string;
  scheduledAt: string;
  link: string;
  notes: string;
  reasoning: string;
  createdAt: string;
};

export type MeetingWithNames = Meeting & {
  clientName: string | null;
  projectTitle: string | null;
};

export function listMeetings(projectId: string): Meeting[] {
  return db
    .prepare("SELECT * FROM meetings WHERE projectId = ? ORDER BY scheduledAt ASC")
    .all(projectId) as Meeting[];
}

export function listClientMeetings(clientId: string): Meeting[] {
  return db
    .prepare("SELECT * FROM meetings WHERE clientId = ? ORDER BY scheduledAt ASC")
    .all(clientId) as Meeting[];
}

export function listAllMeetings(): MeetingWithNames[] {
  return db
    .prepare(
      `SELECT m.*, c.name AS clientName, p.title AS projectTitle
       FROM meetings m
       LEFT JOIN clients c ON c.id = m.clientId
       LEFT JOIN projects p ON p.id = m.projectId
       ORDER BY m.scheduledAt ASC`
    )
    .all() as MeetingWithNames[];
}

export function createMeeting(input: {
  clientId?: string | null;
  projectId?: string | null;
  title: string;
  scheduledAt: string;
  link: string;
  notes: string;
  reasoning?: string;
}): Meeting {
  const meeting: Meeting = {
    id: randomUUID(),
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    title: input.title,
    scheduledAt: input.scheduledAt,
    link: input.link,
    notes: input.notes,
    reasoning: input.reasoning ?? "",
    createdAt: now(),
  };
  db.prepare(
    "INSERT INTO meetings (id, clientId, projectId, title, scheduledAt, link, notes, reasoning, createdAt) VALUES (@id, @clientId, @projectId, @title, @scheduledAt, @link, @notes, @reasoning, @createdAt)"
  ).run(meeting);
  return meeting;
}

export function deleteMeeting(id: string): boolean {
  return db.prepare("DELETE FROM meetings WHERE id = ?").run(id).changes > 0;
}

// ---------- Prospecção ----------

export function listProspects(): Prospect[] {
  return db
    .prepare("SELECT * FROM prospects ORDER BY createdAt DESC")
    .all() as Prospect[];
}

export function getProspect(id: string): Prospect | null {
  return ((db.prepare("SELECT * FROM prospects WHERE id = ?").get(id) as Prospect) ?? null);
}

export function createProspect(
  input: Omit<Prospect, "id" | "status" | "clientId" | "createdAt">
): Prospect {
  const prospect: Prospect = {
    ...input,
    id: randomUUID(),
    status: "new",
    clientId: null,
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO prospects (id, searchQuery, name, segment, location, website, instagram, whyFit, marketingMaturity, suggestedApproach, status, clientId, createdAt)
     VALUES (@id, @searchQuery, @name, @segment, @location, @website, @instagram, @whyFit, @marketingMaturity, @suggestedApproach, @status, @clientId, @createdAt)`
  ).run(prospect);
  return prospect;
}

export function updateProspect(
  id: string,
  patch: { status?: ProspectStatus; clientId?: string | null }
): Prospect | null {
  const existing = getProspect(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  db.prepare("UPDATE prospects SET status = ?, clientId = ? WHERE id = ?").run(
    merged.status,
    merged.clientId,
    id
  );
  return getProspect(id);
}

export function deleteProspect(id: string): boolean {
  return db.prepare("DELETE FROM prospects WHERE id = ?").run(id).changes > 0;
}

// ---------- Ideias proativas ----------

export type IdeaBatch = {
  id: string;
  audience: "agency" | "client" | "professional";
  targetId: string | null;
  content: string;
  createdAt: string;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS idea_batches (
    id TEXT PRIMARY KEY,
    audience TEXT NOT NULL,
    targetId TEXT,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

export function listIdeaBatches(
  audience: IdeaBatch["audience"],
  targetId: string | null
): IdeaBatch[] {
  return db
    .prepare(
      "SELECT * FROM idea_batches WHERE audience = ? AND (targetId IS ? OR targetId = ?) ORDER BY createdAt DESC LIMIT 10"
    )
    .all(audience, targetId, targetId) as IdeaBatch[];
}

export function createIdeaBatch(input: {
  audience: IdeaBatch["audience"];
  targetId: string | null;
  content: string;
}): IdeaBatch {
  const batch: IdeaBatch = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    "INSERT INTO idea_batches (id, audience, targetId, content, createdAt) VALUES (@id, @audience, @targetId, @content, @createdAt)"
  ).run(batch);
  return batch;
}

// ---------- Snapshot para relatórios automatizados ----------

// Resumo textual de tudo que aconteceu na conta, usado como fonte de dados
// real para o relatório executivo gerado por IA.
export function getPlatformSnapshot(clientId: string): string {
  const projects = listProjects({ clientId });
  const generations = db
    .prepare(
      "SELECT type, title, createdAt FROM generations WHERE clientId = ? ORDER BY createdAt DESC LIMIT 30"
    )
    .all(clientId) as { type: string; title: string; createdAt: string }[];

  const lines: string[] = [];

  lines.push(`Entregáveis gerados pela IA (${generations.length} mais recentes):`);
  for (const g of generations) {
    lines.push(`- [${g.createdAt.slice(0, 10)}] ${g.type}: ${g.title}`);
  }

  lines.push(`\nDemandas com profissionais terceirizados (${projects.length}):`);
  for (const project of projects) {
    const professional = project.professionalId
      ? getProfessional(project.professionalId)
      : null;
    lines.push(
      `- "${project.title}" | status: ${project.status} | pagamento: ${project.escrow} | profissional: ${professional?.name ?? "não vinculado"} | verba: ${project.budget || "n/d"} | prazo: ${project.deadline || "n/d"}`
    );
    for (const deliverable of listDeliverables(project.id)) {
      const reviews = listArtReviews(deliverable.id);
      const annotations = listAnnotations(deliverable.id);
      const open = annotations.filter((a) => !a.resolved).length;
      lines.push(
        `  · entrega "${deliverable.title}": ${reviews.length ? `nota IA ${reviews[0].score}/100` : "sem análise de IA"}, ${annotations.length} anotações de revisão (${open} abertas)`
      );
    }
    const meetings = listMeetings(project.id);
    for (const meeting of meetings) {
      lines.push(`  · reunião "${meeting.title}" em ${meeting.scheduledAt}`);
    }
  }

  return lines.join("\n");
}

// ---------- Estatísticas do cliente (para elo da empresa) ----------

export function getClientStats(clientId: string): {
  paidProjects: number;
  totalProjects: number;
  generations: number;
} {
  const paid = db
    .prepare("SELECT COUNT(*) as c FROM projects WHERE clientId = ? AND status = 'paid'")
    .get(clientId) as { c: number };
  const total = db
    .prepare("SELECT COUNT(*) as c FROM projects WHERE clientId = ?")
    .get(clientId) as { c: number };
  const generations = db
    .prepare("SELECT COUNT(*) as c FROM generations WHERE clientId = ?")
    .get(clientId) as { c: number };
  return { paidProjects: paid.c, totalProjects: total.c, generations: generations.c };
}
