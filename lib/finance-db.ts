import { randomUUID } from "crypto";
import { db, listClients } from "./db";
import { getKv, setKv } from "./kv-settings";
// garante clients/professionals/projects/deliverables antes das migrações
import { listProfessionals } from "./marketplace-db";
import {
  clientMargin,
  entryMinutes,
  marginTotals,
  monthEntries,
  sanitizeFinanceSettings,
  sanitizeMoney,
  DEFAULT_FINANCE_SETTINGS,
  type ClientMargin,
  type FinanceSettings,
  type MarginTotals,
  type Rates,
  type TimeEntryLike,
} from "./finance-rules";

// Horas e margem: apontamentos de tempo por cliente/demanda/entrega
// (cronômetro ou manual), custo/hora (padrão da agência ou do profissional),
// fee mensal por cliente e a margem do mês.

const SETTINGS_KEY = "finance_settings";

{
  const clientCols = (db.prepare("PRAGMA table_info(clients)").all() as { name: string }[]).map((c) => c.name);
  if (clientCols.length > 0 && !clientCols.includes("monthlyFee")) {
    db.exec("ALTER TABLE clients ADD COLUMN monthlyFee REAL NOT NULL DEFAULT 0");
  }
  const proCols = (db.prepare("PRAGMA table_info(professionals)").all() as { name: string }[]).map((c) => c.name);
  if (proCols.length > 0 && !proCols.includes("hourlyCost")) {
    db.exec("ALTER TABLE professionals ADD COLUMN hourlyCost REAL NOT NULL DEFAULT 0");
  }
}
db.exec(`
  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    projectId TEXT,
    deliverableId TEXT,
    userId TEXT NOT NULL DEFAULT '',
    userName TEXT NOT NULL DEFAULT '',
    professionalId TEXT,
    note TEXT NOT NULL DEFAULT '',
    startedAt TEXT NOT NULL,
    endedAt TEXT,
    minutes INTEGER NOT NULL DEFAULT 0,
    manual INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_time_client ON time_entries(clientId, startedAt);
  CREATE INDEX IF NOT EXISTS idx_time_user_running ON time_entries(userId, endedAt);
`);

export type TimeEntry = TimeEntryLike & { createdAt: string };
type Row = Omit<TimeEntry, "manual"> & { manual: number };
const toEntry = (row: Row): TimeEntry => ({ ...row, manual: row.manual === 1 });
const now = () => new Date().toISOString();

export function getFinanceSettings(): FinanceSettings {
  return sanitizeFinanceSettings(getKv<FinanceSettings>(SETTINGS_KEY, DEFAULT_FINANCE_SETTINGS));
}

export function saveFinanceSettings(input: Partial<FinanceSettings>): FinanceSettings {
  return setKv(SETTINGS_KEY, sanitizeFinanceSettings(input, getFinanceSettings()));
}

export function getClientFee(clientId: string): number {
  const row = db.prepare("SELECT monthlyFee FROM clients WHERE id = ?").get(clientId) as { monthlyFee: number } | undefined;
  return row ? Number(row.monthlyFee) : 0;
}

export function setClientFee(clientId: string, fee: number): boolean {
  return db.prepare("UPDATE clients SET monthlyFee = ? WHERE id = ?").run(sanitizeMoney(fee), clientId).changes > 0;
}

export function setProfessionalRate(professionalId: string, hourlyCost: number): boolean {
  return db.prepare("UPDATE professionals SET hourlyCost = ? WHERE id = ?").run(sanitizeMoney(hourlyCost), professionalId).changes > 0;
}

export function listProfessionalRates(): { id: string; name: string; role: string; hourlyCost: number }[] {
  return db.prepare("SELECT id, name, role, hourlyCost FROM professionals ORDER BY name ASC").all() as {
    id: string;
    name: string;
    role: string;
    hourlyCost: number;
  }[];
}

export function currentRates(): Rates {
  const settings = getFinanceSettings();
  const professional: Record<string, number> = {};
  for (const p of listProfessionalRates()) professional[p.id] = Number(p.hourlyCost);
  return { defaultHourlyCost: settings.defaultHourlyCost, professional };
}

// ---------- Apontamentos ----------

export function listEntries(filter: { clientId?: string; month?: string; userId?: string; limit?: number }): TimeEntry[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = { limit: filter.limit ?? 500 };
  if (filter.clientId) {
    clauses.push("clientId = @clientId");
    params.clientId = filter.clientId;
  }
  if (filter.month) {
    clauses.push("substr(startedAt, 1, 7) = @month");
    params.month = filter.month;
  }
  if (filter.userId) {
    clauses.push("userId = @userId");
    params.userId = filter.userId;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (db.prepare(`SELECT * FROM time_entries ${where} ORDER BY startedAt DESC LIMIT @limit`).all(params) as Row[]).map(toEntry);
}

export function getEntry(id: string): TimeEntry | null {
  const row = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as Row | undefined;
  return row ? toEntry(row) : null;
}

export function runningTimer(userId: string): TimeEntry | null {
  const row = db.prepare("SELECT * FROM time_entries WHERE userId = ? AND endedAt IS NULL ORDER BY startedAt DESC LIMIT 1").get(userId) as Row | undefined;
  return row ? toEntry(row) : null;
}

// Um cronômetro por pessoa: iniciar outro fecha o anterior.
export function startTimer(input: {
  clientId: string;
  projectId?: string | null;
  deliverableId?: string | null;
  professionalId?: string | null;
  userId: string;
  userName: string;
  note?: string;
}): TimeEntry {
  const running = runningTimer(input.userId);
  if (running) stopTimer(running.id);
  const entry: TimeEntry = {
    id: randomUUID(),
    clientId: input.clientId,
    projectId: input.projectId ?? null,
    deliverableId: input.deliverableId ?? null,
    userId: input.userId,
    userName: input.userName,
    professionalId: input.professionalId ?? null,
    note: (input.note ?? "").trim().slice(0, 300),
    startedAt: now(),
    endedAt: null,
    minutes: 0,
    manual: false,
    createdAt: now(),
  };
  insert(entry);
  return entry;
}

export function stopTimer(id: string, at: Date = new Date()): TimeEntry | null {
  const entry = getEntry(id);
  if (!entry || entry.endedAt) return entry;
  const minutes = entryMinutes(entry, at);
  db.prepare("UPDATE time_entries SET endedAt = ?, minutes = ? WHERE id = ?").run(at.toISOString(), minutes, id);
  return getEntry(id);
}

export function addManualEntry(input: {
  clientId: string;
  projectId?: string | null;
  deliverableId?: string | null;
  professionalId?: string | null;
  userId: string;
  userName: string;
  note?: string;
  minutes: number;
  startedAt?: string; // ISO ou "YYYY-MM-DD"
}): TimeEntry {
  const minutes = Math.min(24 * 60, Math.max(1, Math.round(input.minutes)));
  let started = input.startedAt ? new Date(input.startedAt.length === 10 ? `${input.startedAt}T12:00:00` : input.startedAt) : new Date();
  if (Number.isNaN(started.getTime())) started = new Date();
  const entry: TimeEntry = {
    id: randomUUID(),
    clientId: input.clientId,
    projectId: input.projectId ?? null,
    deliverableId: input.deliverableId ?? null,
    userId: input.userId,
    userName: input.userName,
    professionalId: input.professionalId ?? null,
    note: (input.note ?? "").trim().slice(0, 300),
    startedAt: started.toISOString(),
    endedAt: new Date(started.getTime() + minutes * 60_000).toISOString(),
    minutes,
    manual: true,
    createdAt: now(),
  };
  insert(entry);
  return entry;
}

function insert(entry: TimeEntry): void {
  db.prepare(
    `INSERT INTO time_entries (id, clientId, projectId, deliverableId, userId, userName, professionalId, note, startedAt, endedAt, minutes, manual, createdAt)
     VALUES (@id, @clientId, @projectId, @deliverableId, @userId, @userName, @professionalId, @note, @startedAt, @endedAt, @minutes, @manual, @createdAt)`
  ).run({ ...entry, manual: entry.manual ? 1 : 0 });
}

export function updateEntry(id: string, patch: { note?: string; minutes?: number; professionalId?: string | null }): TimeEntry | null {
  const entry = getEntry(id);
  if (!entry) return null;
  const note = patch.note !== undefined ? patch.note.trim().slice(0, 300) : entry.note;
  const minutes = patch.minutes !== undefined && entry.endedAt ? Math.min(24 * 60, Math.max(1, Math.round(patch.minutes))) : entry.minutes;
  const professionalId = patch.professionalId !== undefined ? patch.professionalId : entry.professionalId;
  db.prepare("UPDATE time_entries SET note = ?, minutes = ?, professionalId = ? WHERE id = ?").run(note, minutes, professionalId, id);
  return getEntry(id);
}

export function deleteEntry(id: string): boolean {
  return db.prepare("DELETE FROM time_entries WHERE id = ?").run(id).changes > 0;
}

// ---------- Margem ----------

export type MarginReport = {
  month: string;
  rows: ClientMargin[];
  totals: MarginTotals;
  settings: FinanceSettings;
  rates: { id: string; name: string; role: string; hourlyCost: number }[];
};

export function marginReport(month: string, at: Date = new Date()): MarginReport {
  const settings = getFinanceSettings();
  const rates = currentRates();
  const entries = monthEntries(listEntries({ month, limit: 5000 }), month);
  const rows = listClients()
    .map((client) =>
      clientMargin({
        clientId: client.id,
        name: client.name,
        fee: getClientFee(client.id),
        entries: entries.filter((e) => e.clientId === client.id),
        rates,
        targetMarginPct: settings.targetMarginPct,
        now: at,
      })
    )
    .filter((r) => r.status !== "idle")
    .sort((a, b) => a.margin - b.margin);
  return { month, rows, totals: marginTotals(rows), settings, rates: listProfessionalRates() };
}

export function clientMonthMargin(clientId: string, name: string, month: string, at: Date = new Date()): ClientMargin {
  const settings = getFinanceSettings();
  return clientMargin({
    clientId,
    name,
    fee: getClientFee(clientId),
    entries: monthEntries(listEntries({ clientId, month, limit: 5000 }), month),
    rates: currentRates(),
    targetMarginPct: settings.targetMarginPct,
    now: at,
  });
}

// mantém a referência para o import lateral acima ser usado (tabelas criadas)
void listProfessionals;
