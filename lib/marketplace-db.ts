import { randomUUID } from "crypto";
import { addColumnIfMissing, db, tenantColumn } from "./db";
import { ALL_AGENCIES, HOUSE_AGENCY_ID, scopeWhere, type TenantScope } from "./tenancy-rules";
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
    employmentType TEXT NOT NULL DEFAULT 'freelancer',
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
    author TEXT NOT NULL DEFAULT 'agency',
    audience TEXT NOT NULL DEFAULT 'all',
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
addColumnIfMissing("projects", "sketch", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("deliverables", "kind", "TEXT NOT NULL DEFAULT 'delivery'");
addColumnIfMissing("deliverables", "meaning", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("projects", "mode", "TEXT NOT NULL DEFAULT 'marketplace'");
// Migração: aprovação por entrega (o que dispara as automações do portal)
addColumnIfMissing("deliverables", "approvalStatus", "TEXT NOT NULL DEFAULT 'pending'");
addColumnIfMissing("deliverables", "approvedAt", "TEXT");
addColumnIfMissing("deliverables", "approvalNote", "TEXT NOT NULL DEFAULT ''");
db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    professionalId TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prospect_searches (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    summary TEXT NOT NULL,
    resultCount INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    clientId TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    error TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    finishedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    audience TEXT NOT NULL DEFAULT 'agency',
    clientId TEXT,
    professionalId TEXT,
    projectId TEXT,
    text TEXT NOT NULL,
    href TEXT NOT NULL DEFAULT '',
    readAt TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account_messages (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS professional_assets (
    id TEXT PRIMARY KEY,
    professionalId TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    mime TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sketches (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    svg TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    neededReferences TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    channel TEXT NOT NULL,
    caption TEXT NOT NULL,
    hashtags TEXT NOT NULL DEFAULT '[]',
    scheduledFor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    publishedAt TEXT,
    deliverableId TEXT,
    campaignId TEXT,
    format TEXT NOT NULL DEFAULT '',
    hookType TEXT NOT NULL DEFAULT '',
    imageBrief TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS client_assets (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ext TEXT NOT NULL,
    mime TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'brand',
    createdAt TEXT NOT NULL
  );
`);
// Migração: post agendado pode nascer de uma entrega aprovada (rascunho)
addColumnIfMissing("scheduled_posts", "deliverableId", "TEXT");
// Migração: atributos do post (formato, tipo de gancho, brief da imagem) e a
// campanha de 30 dias que o gerou — base dos "aprendizados" por cliente.
addColumnIfMissing("scheduled_posts", "campaignId", "TEXT");
addColumnIfMissing("scheduled_posts", "format", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("scheduled_posts", "hookType", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("scheduled_posts", "imageBrief", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("professionals", "availability", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("professionals", "employmentType", "TEXT NOT NULL DEFAULT 'freelancer'");
addColumnIfMissing("annotations", "author", "TEXT NOT NULL DEFAULT 'agency'");
addColumnIfMissing("annotations", "audience", "TEXT NOT NULL DEFAULT 'all'");
for (const table of [
  "professionals",
  "projects",
  "project_messages",
  "deliverables",
  "annotations",
  "art_reviews",
  "prospects",
  "applications",
  "prospect_searches",
  "jobs",
  "activities",
  "account_messages",
  "professional_assets",
  "sketches",
  "scheduled_posts",
  "client_assets",
]) {
  tenantColumn(table);
}

// ---------- Profissionais ----------

type ProfessionalRow = Omit<Professional, "skills" | "portfolio"> & {
  skills: string;
  portfolio: string;
};

function toProfessional(row: ProfessionalRow): Professional {
  return {
    ...row,
    agencyId: row.agencyId ?? null,
    skills: JSON.parse(row.skills),
    portfolio: JSON.parse(row.portfolio),
  };
}

// Profissionais que uma agência enxerga: os dela, os do marketplace aberto
// (sem agência) e os que se candidataram ou foram escalados em demandas dela.
export function listProfessionals(scope: TenantScope): Professional[] {
  if (scope.agencyId === null) {
    return (db.prepare("SELECT * FROM professionals ORDER BY createdAt DESC").all() as ProfessionalRow[]).map(toProfessional);
  }
  return (
    db
      .prepare(
        `SELECT * FROM professionals pr
         WHERE pr.agencyId IS NULL OR pr.agencyId = @agency
            OR EXISTS (SELECT 1 FROM applications a WHERE a.professionalId = pr.id AND a.agencyId = @agency)
            OR EXISTS (SELECT 1 FROM projects p WHERE p.professionalId = pr.id AND p.agencyId = @agency)
         ORDER BY pr.createdAt DESC`
      )
      .all({ agency: scope.agencyId }) as ProfessionalRow[]
  ).map(toProfessional);
}

// Já se candidatou ou foi escalado em alguma demanda da agência?
export function professionalWorkedWith(professionalId: string, agencyId: string): boolean {
  if (!agencyId) return false;
  return Boolean(
    db
      .prepare(
        `SELECT 1 WHERE EXISTS (SELECT 1 FROM applications WHERE professionalId = @id AND agencyId = @agency)
            OR EXISTS (SELECT 1 FROM projects WHERE professionalId = @id AND agencyId = @agency)`
      )
      .get({ id: professionalId, agency: agencyId })
  );
}

export function getProfessional(id: string): Professional | null {
  const row = db.prepare("SELECT * FROM professionals WHERE id = ?").get(id) as
    | ProfessionalRow
    | undefined;
  return row ? toProfessional(row) : null;
}

// agencyId: agência que cadastrou (null = freelancer do marketplace aberto).
export function createProfessional(input: ProfessionalInput, agencyId: string | null): Professional {
  const professional: Professional = { ...input, agencyId, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO professionals (id, agencyId, name, role, email, phone, location, skills, specialties, marketFocus, bio, portfolio, priceRange, availability, employmentType, createdAt)
     VALUES (@id, @agencyId, @name, @role, @email, @phone, @location, @skills, @specialties, @marketFocus, @bio, @portfolio, @priceRange, @availability, @employmentType, @createdAt)`
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
    `UPDATE professionals SET name=@name, role=@role, email=@email, phone=@phone, location=@location, skills=@skills, specialties=@specialties, marketFocus=@marketFocus, bio=@bio, portfolio=@portfolio, priceRange=@priceRange, availability=@availability, employmentType=@employmentType WHERE id=@id`
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
    agencyId: row.agencyId ?? "",
    status: row.status as ProjectStatus,
    escrow: row.escrow as EscrowStatus,
    mode: row.mode === "internal" ? "internal" : "marketplace",
  };
}

// `scope` é obrigatório: agência vê só as dela. O marketplace aberto (demandas
// "open" de todas as agências, vistas por freelancers) usa ALL_AGENCIES com
// marketplaceOnly.
export function listProjects(filter: {
  scope: TenantScope;
  clientId?: string;
  professionalId?: string;
  openOnly?: boolean;
  marketplaceOnly?: boolean;
}): Project[] {
  const clauses: string[] = [];
  const params: Record<string, string> = {};
  if (filter.scope.agencyId !== null) {
    clauses.push("agencyId = @scopeAgency");
    params.scopeAgency = filter.scope.agencyId;
  }
  if (filter.marketplaceOnly) clauses.push("mode = 'marketplace'");
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

// Demandas de UMA marca (a rota já checou a posse da marca).
export function listClientProjects(clientId: string): Project[] {
  return listProjects({ scope: ALL_AGENCIES, clientId });
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
  mode?: "marketplace" | "internal";
}): Project {
  const client = db.prepare("SELECT agencyId FROM clients WHERE id = ?").get(input.clientId) as
    | { agencyId: string | null }
    | undefined;
  if (!client?.agencyId) throw new Error("createProject: cliente sem agência");
  const project: Project = {
    ...input,
    agencyId: client.agencyId,
    mode: input.mode ?? "marketplace",
    id: randomUUID(),
    professionalId: null,
    status: "open",
    escrow: "none",
    matchResult: "",
    sketch: "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO projects (id, agencyId, clientId, professionalId, title, brief, skillsNeeded, location, budget, deadline, status, escrow, matchResult, sketch, mode, createdAt)
     VALUES (@id, @agencyId, @clientId, @professionalId, @title, @brief, @skillsNeeded, @location, @budget, @deadline, @status, @escrow, @matchResult, @sketch, @mode, @createdAt)`
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

// ---------- Candidaturas ----------

import type { Application, ApplicationStatus } from "./marketplace-types";

export type ApplicationWithProfessional = Application & {
  professionalName: string;
  professionalRole: string;
  professionalLocation: string;
};

export function listApplications(projectId: string): ApplicationWithProfessional[] {
  return db
    .prepare(
      `SELECT a.*, p.name AS professionalName, p.role AS professionalRole, p.location AS professionalLocation
       FROM applications a JOIN professionals p ON p.id = a.professionalId
       WHERE a.projectId = ? ORDER BY a.createdAt ASC`
    )
    .all(projectId) as ApplicationWithProfessional[];
}

export function listApplicationsByProfessional(professionalId: string): Application[] {
  return db
    .prepare("SELECT * FROM applications WHERE professionalId = ? ORDER BY createdAt DESC")
    .all(professionalId) as Application[];
}

export function createApplication(input: {
  projectId: string;
  professionalId: string;
  message: string;
}): Application | null {
  const existing = db
    .prepare("SELECT id FROM applications WHERE projectId = ? AND professionalId = ?")
    .get(input.projectId, input.professionalId);
  if (existing) return null; // uma candidatura por profissional/demanda
  const application: Application = {
    ...input,
    id: randomUUID(),
    status: "pending",
    createdAt: now(),
  };
  // A candidatura carrega a agência da demanda (não a do profissional).
  db.prepare(
    `INSERT INTO applications (id, agencyId, projectId, professionalId, message, status, createdAt)
     VALUES (@id, (SELECT agencyId FROM projects WHERE id = @projectId), @projectId, @professionalId, @message, @status, @createdAt)`
  ).run(application);
  return application;
}

export function getApplication(id: string): Application | null {
  return (
    (db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as Application) ?? null
  );
}

export function setApplicationStatus(id: string, status: ApplicationStatus): boolean {
  return db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, id).changes > 0;
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
    `INSERT INTO project_messages (id, agencyId, projectId, sender, text, createdAt)
     VALUES (@id, (SELECT agencyId FROM projects WHERE id = @projectId), @projectId, @sender, @text, @createdAt)`
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
    approvalStatus: "pending",
    approvedAt: null,
    approvalNote: "",
    id: randomUUID(),
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO deliverables (id, agencyId, projectId, title, mime, kind, meaning, approvalStatus, approvedAt, approvalNote, createdAt)
     VALUES (@id, (SELECT agencyId FROM projects WHERE id = @projectId), @projectId, @title, @mime, @kind, @meaning, @approvalStatus, @approvedAt, @approvalNote, @createdAt)`
  ).run(deliverable);
  return deliverable;
}

export function setDeliverableApproval(
  id: string,
  patch: { approvalStatus: Deliverable["approvalStatus"]; approvedAt: string | null; approvalNote: string }
): boolean {
  return (
    db
      .prepare("UPDATE deliverables SET approvalStatus = ?, approvedAt = ?, approvalNote = ? WHERE id = ?")
      .run(patch.approvalStatus, patch.approvedAt, patch.approvalNote, id).changes > 0
  );
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
  author: Annotation["author"];
  audience: Annotation["audience"];
}): Annotation {
  const annotation = { ...input, id: randomUUID(), resolved: 0, createdAt: now() };
  db.prepare(
    `INSERT INTO annotations (id, agencyId, deliverableId, x, y, comment, resolved, author, audience, createdAt)
     VALUES (@id, (SELECT agencyId FROM deliverables WHERE id = @deliverableId), @deliverableId, @x, @y, @comment, @resolved, @author, @audience, @createdAt)`
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
    `INSERT INTO art_reviews (id, agencyId, deliverableId, score, content, createdAt)
     VALUES (@id, (SELECT agencyId FROM deliverables WHERE id = @deliverableId), @deliverableId, @score, @content, @createdAt)`
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
      agencyId TEXT,
      clientId TEXT,
      projectId TEXT,
      title TEXT NOT NULL,
      scheduledAt TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      reasoning TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );
    INSERT INTO meetings_new (id, agencyId, clientId, projectId, title, scheduledAt, link, notes, reasoning, createdAt)
      SELECT m.id, '${HOUSE_AGENCY_ID}', p.clientId, m.projectId, m.title, m.scheduledAt, m.link, m.notes, '', m.createdAt
      FROM meetings m LEFT JOIN projects p ON p.id = m.projectId;
    DROP TABLE meetings;
    ALTER TABLE meetings_new RENAME TO meetings;
  `);
}

export type Meeting = {
  id: string;
  agencyId: string;
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

export function listAllMeetings(scope: TenantScope): MeetingWithNames[] {
  const where = scopeWhere(scope, "m.agencyId");
  return db
    .prepare(
      `SELECT m.*, c.name AS clientName, p.title AS projectTitle
       FROM meetings m
       LEFT JOIN clients c ON c.id = m.clientId
       LEFT JOIN projects p ON p.id = m.projectId
       WHERE ${where.sql}
       ORDER BY m.scheduledAt ASC`
    )
    .all(...where.params) as MeetingWithNames[];
}

export function getMeeting(id: string): Meeting | null {
  return (db.prepare("SELECT * FROM meetings WHERE id = ?").get(id) as Meeting | undefined) ?? null;
}

// agencyId: a do cliente/demanda quando houver; senão a informada.
export function createMeeting(input: {
  agencyId: string;
  clientId?: string | null;
  projectId?: string | null;
  title: string;
  scheduledAt: string;
  link: string;
  notes: string;
  reasoning?: string;
}): Meeting {
  const owner = input.clientId
    ? (db.prepare("SELECT agencyId FROM clients WHERE id = ?").get(input.clientId) as { agencyId: string } | undefined)?.agencyId
    : input.projectId
      ? (db.prepare("SELECT agencyId FROM projects WHERE id = ?").get(input.projectId) as { agencyId: string } | undefined)?.agencyId
      : undefined;
  const meeting: Meeting = {
    id: randomUUID(),
    agencyId: owner ?? input.agencyId,
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
    "INSERT INTO meetings (id, agencyId, clientId, projectId, title, scheduledAt, link, notes, reasoning, createdAt) VALUES (@id, @agencyId, @clientId, @projectId, @title, @scheduledAt, @link, @notes, @reasoning, @createdAt)"
  ).run(meeting);
  return meeting;
}

export function updateMeeting(
  id: string,
  patch: Partial<Pick<Meeting, "title" | "scheduledAt" | "link" | "notes">>
): Meeting | null {
  const existing = db.prepare("SELECT * FROM meetings WHERE id = ?").get(id) as
    | Meeting
    | undefined;
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  db.prepare(
    "UPDATE meetings SET title = ?, scheduledAt = ?, link = ?, notes = ? WHERE id = ?"
  ).run(merged.title, merged.scheduledAt, merged.link, merged.notes, id);
  return merged;
}

export function deleteMeeting(id: string): boolean {
  return db.prepare("DELETE FROM meetings WHERE id = ?").run(id).changes > 0;
}

// ---------- Arquivos da conta (identidade visual, PSD/AI) ----------

import type { ClientAsset } from "./marketplace-types";

export function listClientAssets(clientId: string): ClientAsset[] {
  return db
    .prepare("SELECT * FROM client_assets WHERE clientId = ? ORDER BY createdAt DESC")
    .all(clientId) as ClientAsset[];
}

export function getClientAsset(id: string): ClientAsset | null {
  return (
    (db.prepare("SELECT * FROM client_assets WHERE id = ?").get(id) as ClientAsset) ?? null
  );
}

export function createClientAsset(input: {
  clientId: string;
  title: string;
  ext: string;
  mime: string;
  kind: ClientAsset["kind"];
}): ClientAsset {
  const asset: ClientAsset = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO client_assets (id, agencyId, clientId, title, ext, mime, kind, createdAt)
     VALUES (@id, (SELECT agencyId FROM clients WHERE id = @clientId), @clientId, @title, @ext, @mime, @kind, @createdAt)`
  ).run(asset);
  return asset;
}

export function deleteClientAsset(id: string): boolean {
  return db.prepare("DELETE FROM client_assets WHERE id = ?").run(id).changes > 0;
}

// ---------- Jobs de IA (sobrevivem a refresh da página) ----------

export type Job = {
  id: string;
  agencyId: string | null;
  kind: string;
  label: string;
  clientId: string | null;
  status: "running" | "done" | "error";
  error: string;
  createdAt: string;
  finishedAt: string | null;
};

export function createJob(input: {
  kind: string;
  label: string;
  clientId?: string | null;
  agencyId: string | null;
}): Job {
  const owner = input.clientId
    ? ((db.prepare("SELECT agencyId FROM clients WHERE id = ?").get(input.clientId) as { agencyId: string } | undefined)?.agencyId ?? null)
    : null;
  const job: Job = {
    id: randomUUID(),
    agencyId: owner ?? input.agencyId,
    kind: input.kind,
    label: input.label,
    clientId: input.clientId ?? null,
    status: "running",
    error: "",
    createdAt: now(),
    finishedAt: null,
  };
  db.prepare(
    "INSERT INTO jobs (id, agencyId, kind, label, clientId, status, error, createdAt, finishedAt) VALUES (@id, @agencyId, @kind, @label, @clientId, @status, @error, @createdAt, @finishedAt)"
  ).run(job);
  return job;
}

export function finishJob(id: string, status: "done" | "error", error = ""): void {
  db.prepare("UPDATE jobs SET status = ?, error = ?, finishedAt = ? WHERE id = ?").run(
    status,
    error,
    now(),
    id
  );
}

export function listJobs(scope: TenantScope, clientId?: string): Job[] {
  // Jobs rodando + os finalizados nos últimos 2 minutos (para a UI reagir)
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const where = scopeWhere(scope);
  const byClient = clientId ? "AND clientId = ?" : "";
  return db
    .prepare(
      `SELECT * FROM jobs WHERE (status = 'running' OR finishedAt > ?) AND ${where.sql} ${byClient} ORDER BY createdAt DESC LIMIT 20`
    )
    .all(cutoff, ...where.params, ...(clientId ? [clientId] : [])) as Job[];
}

// Jobs órfãos de sessões antigas do servidor (ficariam 'running' para sempre)
db.prepare(
  "UPDATE jobs SET status = 'error', error = 'Servidor reiniciou durante a geração', finishedAt = ? WHERE status = 'running' AND createdAt < ?"
).run(now(), new Date(Date.now() - 15 * 60 * 1000).toISOString());

// ---------- Central de atividade ----------

export type Activity = {
  id: string;
  agencyId: string | null;
  audience: "agency" | "client" | "professional" | "all";
  clientId: string | null;
  professionalId: string | null;
  projectId: string | null;
  text: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

// agencyId: explícito, ou herdado da marca/demanda. Aviso sem agência
// nenhuma (ex.: perfil de freelancer) fica só para o destinatário.
export function logActivity(input: {
  audience: Activity["audience"];
  text: string;
  href?: string;
  agencyId?: string | null;
  clientId?: string | null;
  professionalId?: string | null;
  projectId?: string | null;
}): void {
  db.prepare(
    `INSERT INTO activities (id, agencyId, audience, clientId, professionalId, projectId, text, href, readAt, createdAt)
     VALUES (?, COALESCE(?, (SELECT agencyId FROM clients WHERE id = ?), (SELECT agencyId FROM projects WHERE id = ?)), ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    randomUUID(),
    input.agencyId ?? null,
    input.clientId ?? null,
    input.projectId ?? null,
    input.audience,
    input.clientId ?? null,
    input.professionalId ?? null,
    input.projectId ?? null,
    input.text,
    input.href ?? "",
    now()
  );
}

export function listActivities(filter: {
  audience: Activity["audience"];
  scope: TenantScope;
  clientId?: string;
  professionalId?: string;
  limit?: number;
}): Activity[] {
  const clauses = ["(audience = @audience OR audience = 'all')"];
  const params: Record<string, unknown> = {
    audience: filter.audience,
    limit: filter.limit ?? 30,
  };
  if (filter.scope.agencyId !== null) {
    clauses.push("agencyId = @scopeAgency");
    params.scopeAgency = filter.scope.agencyId;
  }
  if (filter.clientId) {
    clauses.push("clientId = @clientId");
    params.clientId = filter.clientId;
  }
  if (filter.professionalId) {
    clauses.push("professionalId = @professionalId");
    params.professionalId = filter.professionalId;
  }
  return db
    .prepare(
      `SELECT * FROM activities WHERE ${clauses.join(" AND ")} ORDER BY createdAt DESC LIMIT @limit`
    )
    .all(params) as Activity[];
}

export function markActivitiesRead(
  audience: Activity["audience"],
  scope: { tenant: TenantScope; clientId?: string; professionalId?: string }
): void {
  const clauses = ["readAt IS NULL", "(audience = @audience OR audience = 'all')"];
  if (scope.tenant.agencyId !== null) clauses.push("agencyId = @scopeAgency");
  if (scope.clientId) clauses.push("clientId = @clientId");
  if (scope.professionalId) clauses.push("professionalId = @professionalId");
  db.prepare(`UPDATE activities SET readAt = @at WHERE ${clauses.join(" AND ")}`).run({
    at: now(),
    audience,
    scopeAgency: scope.tenant.agencyId,
    clientId: scope.clientId ?? null,
    professionalId: scope.professionalId ?? null,
  });
}

// ---------- Chat da conta (cliente ↔ agência) ----------

export type AccountMessage = {
  id: string;
  clientId: string;
  sender: "agency" | "client";
  text: string;
  createdAt: string;
};

export function listAccountMessages(clientId: string): AccountMessage[] {
  return db
    .prepare("SELECT * FROM account_messages WHERE clientId = ? ORDER BY createdAt ASC")
    .all(clientId) as AccountMessage[];
}

export function createAccountMessage(input: {
  clientId: string;
  sender: "agency" | "client";
  text: string;
}): AccountMessage {
  const message: AccountMessage = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO account_messages (id, agencyId, clientId, sender, text, createdAt)
     VALUES (@id, (SELECT agencyId FROM clients WHERE id = @clientId), @clientId, @sender, @text, @createdAt)`
  ).run(message);
  return message;
}

// ---------- Portfolio hospedado do profissional ----------

export type ProfessionalAsset = {
  id: string;
  professionalId: string;
  title: string;
  mime: string;
  createdAt: string;
};

export function listProfessionalAssets(professionalId: string): ProfessionalAsset[] {
  return db
    .prepare(
      "SELECT * FROM professional_assets WHERE professionalId = ? ORDER BY createdAt DESC"
    )
    .all(professionalId) as ProfessionalAsset[];
}

export function createProfessionalAsset(input: {
  professionalId: string;
  title: string;
  mime: string;
}): ProfessionalAsset {
  const asset: ProfessionalAsset = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO professional_assets (id, agencyId, professionalId, title, mime, createdAt)
     VALUES (@id, (SELECT agencyId FROM professionals WHERE id = @professionalId), @professionalId, @title, @mime, @createdAt)`
  ).run(asset);
  return asset;
}

export function deleteProfessionalAsset(id: string): boolean {
  return db.prepare("DELETE FROM professional_assets WHERE id = ?").run(id).changes > 0;
}

// ---------- Sketches (histórico versionado) ----------

export type Sketch = {
  id: string;
  projectId: string;
  svg: string;
  rationale: string;
  neededReferences: string[];
  createdAt: string;
};

type SketchRow = Omit<Sketch, "neededReferences"> & { neededReferences: string };

export function listSketches(projectId: string): Sketch[] {
  return (
    db
      .prepare("SELECT * FROM sketches WHERE projectId = ? ORDER BY createdAt DESC")
      .all(projectId) as SketchRow[]
  ).map((row) => {
    let needed: string[] = [];
    try {
      needed = JSON.parse(row.neededReferences);
    } catch {
      needed = [];
    }
    return { ...row, neededReferences: needed };
  });
}

export function createSketch(input: {
  projectId: string;
  svg: string;
  rationale: string;
  neededReferences: string[];
}): Sketch {
  const sketch: Sketch = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    `INSERT INTO sketches (id, agencyId, projectId, svg, rationale, neededReferences, createdAt)
     VALUES (@id, (SELECT agencyId FROM projects WHERE id = @projectId), @projectId, @svg, @rationale, @neededReferences, @createdAt)`
  ).run({ ...sketch, neededReferences: JSON.stringify(sketch.neededReferences) });
  return sketch;
}

export function deleteSketch(id: string): boolean {
  return db.prepare("DELETE FROM sketches WHERE id = ?").run(id).changes > 0;
}

// Migração: sketches antigos gravados na coluna projects.sketch viram a
// primeira versão do histórico
for (const row of db
  .prepare("SELECT id, sketch, createdAt FROM projects WHERE sketch != ''")
  .all() as { id: string; sketch: string; createdAt: string }[]) {
  const existing = db
    .prepare("SELECT COUNT(*) as c FROM sketches WHERE projectId = ?")
    .get(row.id) as { c: number };
  if (existing.c > 0) continue;
  try {
    const parsed = JSON.parse(row.sketch) as {
      svg?: string;
      rationale?: string;
      neededReferences?: string[];
    };
    if (parsed.svg) {
      db.prepare(
        "INSERT INTO sketches (id, agencyId, projectId, svg, rationale, neededReferences, createdAt) VALUES (?, (SELECT agencyId FROM projects WHERE id = ?), ?, ?, ?, ?, ?)"
      ).run(
        randomUUID(),
        row.id,
        row.id,
        parsed.svg,
        parsed.rationale ?? "",
        JSON.stringify(parsed.neededReferences ?? []),
        row.createdAt
      );
    }
  } catch {
    // sketch antigo ilegível: ignora
  }
}

// ---------- Publicações agendadas ----------

export type ScheduledPost = {
  id: string;
  agencyId: string;
  clientId: string;
  title: string;
  channel: string;
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  // draft = rascunho (nasceu de uma aprovação, ainda sem data confirmada);
  // scheduled = na fila; published = publicado (auto via integração ou
  // confirmação manual); canceled = cancelado
  status: "draft" | "scheduled" | "published" | "canceled";
  publishedAt: string | null;
  // entrega aprovada que originou o post (arquivo em /api/files/{id})
  deliverableId: string | null;
  // campanha de 30 dias que gerou o post (null = criado à mão / aprovação)
  campaignId: string | null;
  format: string; // Feed, Reels, Carrossel, Stories, Texto...
  hookType: string; // dor, prova social, bastidores, dado, pergunta, tutorial, oferta
  imageBrief: string; // direção de arte para a peça
  createdAt: string;
};

export type ScheduledPostWithClient = ScheduledPost & { clientName: string };

type ScheduledPostRow = Omit<ScheduledPost, "hashtags"> & { hashtags: string };

export function listScheduledPosts(scope: TenantScope, clientId?: string): ScheduledPostWithClient[] {
  const tenant = scopeWhere(scope, "sp.agencyId");
  const byClient = clientId ? "AND sp.clientId = ?" : "";
  const rows = db
    .prepare(
      `SELECT sp.*, c.name AS clientName FROM scheduled_posts sp
       JOIN clients c ON c.id = sp.clientId
       WHERE ${tenant.sql} ${byClient}
       ORDER BY sp.scheduledFor ASC`
    )
    .all(...tenant.params, ...(clientId ? [clientId] : [])) as (ScheduledPostRow & { clientName: string })[];
  return rows.map((row) => ({ ...row, hashtags: JSON.parse(row.hashtags) }));
}

// Posts de UMA marca (a rota já checou a posse da marca).
export function listClientScheduledPosts(clientId: string): ScheduledPostWithClient[] {
  return listScheduledPosts(ALL_AGENCIES, clientId);
}

export function createScheduledPost(input: {
  clientId: string;
  title: string;
  channel: string;
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  status?: "draft" | "scheduled";
  deliverableId?: string | null;
  campaignId?: string | null;
  format?: string;
  hookType?: string;
  imageBrief?: string;
}): ScheduledPost {
  const owner = db.prepare("SELECT agencyId FROM clients WHERE id = ?").get(input.clientId) as
    | { agencyId: string | null }
    | undefined;
  if (!owner?.agencyId) throw new Error("createScheduledPost: cliente sem agência");
  const post: ScheduledPost = {
    agencyId: owner.agencyId,
    clientId: input.clientId,
    title: input.title,
    channel: input.channel,
    caption: input.caption,
    hashtags: input.hashtags,
    scheduledFor: input.scheduledFor,
    id: randomUUID(),
    status: input.status ?? "scheduled",
    publishedAt: null,
    deliverableId: input.deliverableId ?? null,
    campaignId: input.campaignId ?? null,
    format: input.format ?? "",
    hookType: input.hookType ?? "",
    imageBrief: input.imageBrief ?? "",
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO scheduled_posts (id, agencyId, clientId, title, channel, caption, hashtags, scheduledFor, status, publishedAt, deliverableId, campaignId, format, hookType, imageBrief, createdAt)
     VALUES (@id, @agencyId, @clientId, @title, @channel, @caption, @hashtags, @scheduledFor, @status, @publishedAt, @deliverableId, @campaignId, @format, @hookType, @imageBrief, @createdAt)`
  ).run({ ...post, hashtags: JSON.stringify(post.hashtags) });
  return post;
}

export function getScheduledPost(id: string): ScheduledPost | null {
  const row = db.prepare("SELECT * FROM scheduled_posts WHERE id = ?").get(id) as
    | ScheduledPostRow
    | undefined;
  return row ? { ...row, hashtags: JSON.parse(row.hashtags) } : null;
}

export function updateScheduledPost(
  id: string,
  patch: Partial<Pick<ScheduledPost, "scheduledFor" | "status" | "caption" | "title" | "channel" | "format" | "hookType">>
): boolean {
  const existing = db.prepare("SELECT * FROM scheduled_posts WHERE id = ?").get(id) as
    | ScheduledPostRow
    | undefined;
  if (!existing) return false;
  const merged = { ...existing, ...patch };
  const publishedAt =
    patch.status === "published" ? now() : merged.publishedAt ?? null;
  db.prepare(
    "UPDATE scheduled_posts SET scheduledFor = ?, status = ?, caption = ?, title = ?, channel = ?, format = ?, hookType = ?, publishedAt = ? WHERE id = ?"
  ).run(merged.scheduledFor, merged.status, merged.caption, merged.title, merged.channel, merged.format ?? "", merged.hookType ?? "", publishedAt, id);
  return true;
}

export function deleteScheduledPost(id: string): boolean {
  return db.prepare("DELETE FROM scheduled_posts WHERE id = ?").run(id).changes > 0;
}

// ---------- Prospecção ----------

export type ProspectSearch = {
  id: string;
  query: string;
  summary: string;
  resultCount: number;
  createdAt: string;
};

export function createProspectSearch(input: {
  agencyId: string;
  query: string;
  summary: string;
  resultCount: number;
}): void {
  db.prepare(
    "INSERT INTO prospect_searches (id, agencyId, query, summary, resultCount, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), input.agencyId, input.query, input.summary, input.resultCount, now());
}

export function latestProspectSearch(scope: TenantScope): ProspectSearch | null {
  const where = scopeWhere(scope);
  return (
    (db
      .prepare(`SELECT * FROM prospect_searches WHERE ${where.sql} ORDER BY createdAt DESC LIMIT 1`)
      .get(...where.params) as ProspectSearch) ?? null
  );
}

export function listProspects(scope: TenantScope): Prospect[] {
  const where = scopeWhere(scope);
  return db
    .prepare(`SELECT * FROM prospects WHERE ${where.sql} ORDER BY createdAt DESC`)
    .all(...where.params) as Prospect[];
}

export function getProspect(id: string): Prospect | null {
  return ((db.prepare("SELECT * FROM prospects WHERE id = ?").get(id) as Prospect) ?? null);
}

export function createProspect(
  input: Omit<Prospect, "id" | "status" | "clientId" | "createdAt" | "agencyId">,
  agencyId: string
): Prospect {
  if (!agencyId) throw new Error("createProspect: agência obrigatória");
  const prospect: Prospect = {
    ...input,
    agencyId,
    id: randomUUID(),
    status: "new",
    clientId: null,
    createdAt: now(),
  };
  db.prepare(
    `INSERT INTO prospects (id, agencyId, searchQuery, name, segment, location, website, instagram, whyFit, marketingMaturity, suggestedApproach, status, clientId, createdAt)
     VALUES (@id, @agencyId, @searchQuery, @name, @segment, @location, @website, @instagram, @whyFit, @marketingMaturity, @suggestedApproach, @status, @clientId, @createdAt)`
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
  agencyId: string | null;
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
tenantColumn("idea_batches");

export function listIdeaBatches(
  audience: IdeaBatch["audience"],
  targetId: string | null,
  scope: TenantScope
): IdeaBatch[] {
  const where = scopeWhere(scope);
  return db
    .prepare(
      `SELECT * FROM idea_batches WHERE audience = ? AND (targetId IS ? OR targetId = ?) AND ${where.sql} ORDER BY createdAt DESC LIMIT 10`
    )
    .all(audience, targetId, targetId, ...where.params) as IdeaBatch[];
}

export function createIdeaBatch(input: {
  agencyId: string | null;
  audience: IdeaBatch["audience"];
  targetId: string | null;
  content: string;
}): IdeaBatch {
  const batch: IdeaBatch = { ...input, id: randomUUID(), createdAt: now() };
  db.prepare(
    "INSERT INTO idea_batches (id, agencyId, audience, targetId, content, createdAt) VALUES (@id, @agencyId, @audience, @targetId, @content, @createdAt)"
  ).run(batch);
  return batch;
}

// ---------- Snapshot para relatórios automatizados ----------

// Resumo textual de tudo que aconteceu na conta, usado como fonte de dados
// real para o relatório executivo gerado por IA.
export function getPlatformSnapshot(clientId: string): string {
  const projects = listClientProjects(clientId);
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

// ---------- Estatísticas da agência (gamification) ----------

import type { AgencyStats } from "./ranking";

export function getAgencyStats(scope: TenantScope): AgencyStats {
  const where = scopeWhere(scope);
  const count = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params, ...where.params) as { c: number }).c;
  const review = db.prepare(`SELECT AVG(score) as avg FROM art_reviews WHERE ${where.sql}`).get(...where.params) as {
    avg: number | null;
  };
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    activeClients: count(`SELECT COUNT(*) as c FROM clients WHERE ${where.sql}`),
    paidProjects: count(`SELECT COUNT(*) as c FROM projects WHERE status = 'paid' AND ${where.sql}`),
    generations: count(`SELECT COUNT(*) as c FROM generations WHERE ${where.sql}`),
    avgScore: review.avg !== null ? Math.round(review.avg) : null,
    professionals: count(`SELECT COUNT(*) as c FROM professionals WHERE ${where.sql}`),
    meetingsHeld: count(`SELECT COUNT(*) as c FROM meetings WHERE scheduledAt < ? AND ${where.sql}`, new Date().toISOString()),
    weeklyActions: count(`SELECT COUNT(*) as c FROM activities WHERE createdAt >= ? AND ${where.sql}`, weekAgo),
  };
}
