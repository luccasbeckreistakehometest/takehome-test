import { addColumnIfMissing, db, tenantColumn } from "./db";

// Primeiro acesso, salvo no servidor: onde a pessoa parou no tour e o que fez
// na primeira sessão (linha do tempo). O localStorage do modal era só cache
// do navegador — trocando de máquina o tour voltava e nada ficava registrado.
db.exec(`
  CREATE TABLE IF NOT EXISTS onboarding (
    userId TEXT PRIMARY KEY,
    tourCompleted INTEGER NOT NULL DEFAULT 0,
    tourStep INTEGER NOT NULL DEFAULT 0,
    firstSeenAt TEXT NOT NULL,
    completedAt TEXT,
    events TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS voice_briefings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    lang TEXT NOT NULL,
    transcript TEXT NOT NULL,
    extracted TEXT NOT NULL,
    clientId TEXT,
    createdAt TEXT NOT NULL
  );
`);
tenantColumn("onboarding");
tenantColumn("voice_briefings");
addColumnIfMissing("voice_briefings", "turns", "INTEGER NOT NULL DEFAULT 1");
// primeiros passos: quais já foram registrados (evento único por passo) e se
// a pessoa fechou o card depois de concluir
addColumnIfMissing("onboarding", "activationLogged", "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing("onboarding", "activationDismissedAt", "TEXT");

export type OnboardingRow = { userId: string; tourCompleted: number; tourStep: number; firstSeenAt: string; completedAt: string | null; events: string };
export type OnboardingEvent = { at: string; type: string; meta?: Record<string, unknown> };

export function getOnboarding(userId: string): OnboardingRow {
  let row = db.prepare("SELECT * FROM onboarding WHERE userId = ?").get(userId) as OnboardingRow | undefined;
  if (!row) {
    db.prepare(
      "INSERT INTO onboarding (userId, agencyId, firstSeenAt) VALUES (?, (SELECT agencyId FROM users WHERE id = ?), ?)"
    ).run(userId, userId, new Date().toISOString());
    row = db.prepare("SELECT * FROM onboarding WHERE userId = ?").get(userId) as OnboardingRow;
  }
  return row;
}

// Leitura sem efeito colateral (GET não grava): sem linha ainda = tour não
// começado. A linha nasce no primeiro POST.
export function peekOnboarding(userId: string): Pick<OnboardingRow, "tourCompleted" | "tourStep"> & { firstSeenAt: string | null } {
  const row = db.prepare("SELECT * FROM onboarding WHERE userId = ?").get(userId) as OnboardingRow | undefined;
  return row ?? { tourCompleted: 0, tourStep: 0, firstSeenAt: null };
}

export function recordOnboardingEvent(userId: string, type: string, meta?: Record<string, unknown>): void {
  const row = getOnboarding(userId);
  const events = JSON.parse(row.events) as OnboardingEvent[];
  if (events.length >= 200) return;
  events.push({ at: new Date().toISOString(), type, meta });
  db.prepare("UPDATE onboarding SET events = ? WHERE userId = ?").run(JSON.stringify(events), userId);
}

export function setTourProgress(userId: string, step: number, completed: boolean): OnboardingRow {
  getOnboarding(userId);
  db.prepare("UPDATE onboarding SET tourStep = ?, tourCompleted = ?, completedAt = COALESCE(completedAt, ?) WHERE userId = ?")
    .run(step, completed ? 1 : 0, completed ? new Date().toISOString() : null, userId);
  return getOnboarding(userId);
}

export function saveVoiceBriefing(input: { id: string; userId: string; lang: string; transcript: string; extracted: unknown }): void {
  // Só continua um briefing da própria pessoa (id de outra conta é ignorado).
  const existing = db.prepare("SELECT transcript FROM voice_briefings WHERE id = ? AND userId = ?").get(input.id, input.userId) as { transcript: string } | undefined;
  if (!existing && db.prepare("SELECT 1 FROM voice_briefings WHERE id = ?").get(input.id)) return;
  const transcript = existing ? `${existing.transcript}\n${input.transcript}` : input.transcript;
  db.prepare(`INSERT INTO voice_briefings (id,userId,agencyId,lang,transcript,extracted,createdAt)
    VALUES (?,?,(SELECT agencyId FROM users WHERE id = ?),?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET transcript = excluded.transcript, extracted = excluded.extracted, turns = voice_briefings.turns + 1`)
    .run(input.id, input.userId, input.userId, input.lang, transcript, JSON.stringify(input.extracted), new Date().toISOString());
}

// Quantas falas já tem este briefing (da própria pessoa); 0 = novo.
export function voiceBriefingTurns(id: string, userId: string): number {
  const row = db.prepare("SELECT turns FROM voice_briefings WHERE id = ? AND userId = ?").get(id, userId) as { turns: number } | undefined;
  return row?.turns ?? 0;
}

export function activationState(userId: string): { logged: string[]; dismissed: boolean } {
  const row = db.prepare("SELECT activationLogged, activationDismissedAt FROM onboarding WHERE userId = ?").get(userId) as
    | { activationLogged: string; activationDismissedAt: string | null }
    | undefined;
  if (!row) return { logged: [], dismissed: false };
  let logged: string[] = [];
  try {
    const parsed = JSON.parse(row.activationLogged) as unknown;
    if (Array.isArray(parsed)) logged = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    /* lista vazia */
  }
  return { logged, dismissed: Boolean(row.activationDismissedAt) };
}

// Grava os passos novos numa transação (duas abas ao mesmo tempo não
// registram o mesmo passo duas vezes) e devolve só os novos.
export function markActivationLogged(userId: string, keys: string[]): string[] {
  if (keys.length === 0) return [];
  return db.transaction(() => {
    getOnboarding(userId);
    const { logged } = activationState(userId);
    const fresh = keys.filter((k) => !logged.includes(k));
    if (fresh.length) db.prepare("UPDATE onboarding SET activationLogged = ? WHERE userId = ?").run(JSON.stringify([...logged, ...fresh].slice(-50)), userId);
    return fresh;
  }).immediate();
}

export function dismissActivation(userId: string): void {
  getOnboarding(userId);
  db.prepare("UPDATE onboarding SET activationDismissedAt = COALESCE(activationDismissedAt, ?) WHERE userId = ?").run(new Date().toISOString(), userId);
}

export function onboardingStats() {
  const one = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  return {
    toursStarted: one("SELECT COUNT(*) c FROM onboarding"),
    toursCompleted: one("SELECT COUNT(*) c FROM onboarding WHERE tourCompleted = 1"),
    voiceBriefings: one("SELECT COUNT(*) c FROM voice_briefings"),
    recent: db.prepare("SELECT o.userId, u.username, u.role, o.tourCompleted, o.tourStep, o.firstSeenAt, o.events FROM onboarding o LEFT JOIN users u ON u.id = o.userId ORDER BY o.firstSeenAt DESC LIMIT 50").all() as (OnboardingRow & { username: string | null; role: string | null })[],
  };
}
