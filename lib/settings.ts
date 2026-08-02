import { db } from "./db";

// Quanto gastar com IA:
// - economy: modelo mais barato (Sonnet) em tudo
// - balanced: Sonnet nos entregáveis táticos, Opus nas decisões críticas
// - premium: Opus em tudo
export type AiMode = "economy" | "balanced" | "premium";

export type AgencySettings = {
  agencyName: string;
  tagline: string;
  accentColor: string;
  landingPagesEnabled: boolean; // gerador de landing page (alto consumo de tokens)
  aiMode: AiMode;
  // Chaves de API gerenciadas pela UI (armazenadas no banco local)
  anthropicApiKey: string; // vazia = usa ANTHROPIC_API_KEY do .env.local
  googleAiApiKey: string; // Google AI Studio (geração de imagem/mockup)
};

const DEFAULTS: AgencySettings = {
  agencyName: "AgencyHub",
  tagline: "sua agência, centralizada e acelerada por IA",
  accentColor: "#c6f24e",
  landingPagesEnabled: false,
  aiMode: "balanced",
  anthropicApiKey: "",
  googleAiApiKey: "",
};

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    agencyName TEXT NOT NULL,
    tagline TEXT NOT NULL,
    accentColor TEXT NOT NULL,
    landingPagesEnabled INTEGER NOT NULL DEFAULT 0,
    economyMode INTEGER NOT NULL DEFAULT 1,
    aiMode TEXT NOT NULL DEFAULT 'balanced',
    anthropicApiKey TEXT NOT NULL DEFAULT '',
    googleAiApiKey TEXT NOT NULL DEFAULT ''
  );
`);

// Migração para bancos criados antes das flags
const settingsColumns = (
  db.prepare("PRAGMA table_info(settings)").all() as { name: string }[]
).map((column) => column.name);
if (!settingsColumns.includes("landingPagesEnabled")) {
  db.exec(
    "ALTER TABLE settings ADD COLUMN landingPagesEnabled INTEGER NOT NULL DEFAULT 0"
  );
}
if (!settingsColumns.includes("economyMode")) {
  db.exec("ALTER TABLE settings ADD COLUMN economyMode INTEGER NOT NULL DEFAULT 1");
}
if (!settingsColumns.includes("aiMode")) {
  db.exec("ALTER TABLE settings ADD COLUMN aiMode TEXT NOT NULL DEFAULT 'balanced'");
}
if (!settingsColumns.includes("anthropicApiKey")) {
  db.exec("ALTER TABLE settings ADD COLUMN anthropicApiKey TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE settings ADD COLUMN googleAiApiKey TEXT NOT NULL DEFAULT ''");
}

type SettingsRow = {
  agencyName: string;
  tagline: string;
  accentColor: string;
  landingPagesEnabled: number;
  aiMode: string;
  anthropicApiKey: string;
  googleAiApiKey: string;
};

export function getSettings(): AgencySettings {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as
    | SettingsRow
    | undefined;
  if (!row) return DEFAULTS;
  return {
    agencyName: row.agencyName,
    tagline: row.tagline,
    accentColor: row.accentColor,
    landingPagesEnabled: row.landingPagesEnabled === 1,
    aiMode: (["economy", "balanced", "premium"] as const).includes(row.aiMode as AiMode)
      ? (row.aiMode as AiMode)
      : "balanced",
    anthropicApiKey: row.anthropicApiKey ?? "",
    googleAiApiKey: row.googleAiApiKey ?? "",
  };
}

export function saveSettings(settings: AgencySettings): AgencySettings {
  db.prepare(
    `INSERT INTO settings (id, agencyName, tagline, accentColor, landingPagesEnabled, aiMode, anthropicApiKey, googleAiApiKey)
     VALUES (1, @agencyName, @tagline, @accentColor, @landingPagesEnabled, @aiMode, @anthropicApiKey, @googleAiApiKey)
     ON CONFLICT(id) DO UPDATE SET agencyName=@agencyName, tagline=@tagline, accentColor=@accentColor,
       landingPagesEnabled=@landingPagesEnabled, aiMode=@aiMode, anthropicApiKey=@anthropicApiKey, googleAiApiKey=@googleAiApiKey`
  ).run({
    ...settings,
    landingPagesEnabled: settings.landingPagesEnabled ? 1 : 0,
  });
  return settings;
}
