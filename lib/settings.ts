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
  googleAiApiKey: string; // Google AI Studio (mockup fiel imagem+imagem)
  togetherApiKey: string; // Together AI (FLUX.1-schnell-Free, conceitos grátis)
  imageProvider: "pollinations" | "together"; // provedor de conceitos free
  logoMime: string; // mime do logo whitelabel (vazio = sem logo, usa inicial)
  houseStyle: string; // "estilo da casa": diretrizes injetadas em todos os prompts
};

const DEFAULTS: AgencySettings = {
  agencyName: "AgencyHub",
  tagline: "sua agência, centralizada e acelerada por IA",
  accentColor: "#c6f24e",
  landingPagesEnabled: false,
  aiMode: "balanced",
  anthropicApiKey: "",
  googleAiApiKey: "",
  togetherApiKey: "",
  imageProvider: "pollinations",
  logoMime: "",
  houseStyle: "",
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
    googleAiApiKey TEXT NOT NULL DEFAULT '',
    togetherApiKey TEXT NOT NULL DEFAULT '',
    imageProvider TEXT NOT NULL DEFAULT 'pollinations',
    logoMime TEXT NOT NULL DEFAULT '',
    houseStyle TEXT NOT NULL DEFAULT ''
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
if (!settingsColumns.includes("houseStyle")) {
  db.exec("ALTER TABLE settings ADD COLUMN houseStyle TEXT NOT NULL DEFAULT ''");
}
if (!settingsColumns.includes("togetherApiKey")) {
  db.exec("ALTER TABLE settings ADD COLUMN togetherApiKey TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE settings ADD COLUMN imageProvider TEXT NOT NULL DEFAULT 'pollinations'");
}
if (!settingsColumns.includes("logoMime")) {
  db.exec("ALTER TABLE settings ADD COLUMN logoMime TEXT NOT NULL DEFAULT ''");
}

type SettingsRow = {
  agencyName: string;
  tagline: string;
  accentColor: string;
  landingPagesEnabled: number;
  aiMode: string;
  anthropicApiKey: string;
  googleAiApiKey: string;
  togetherApiKey: string;
  imageProvider: string;
  logoMime: string;
  houseStyle: string;
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
    togetherApiKey: row.togetherApiKey ?? "",
    imageProvider: row.imageProvider === "together" ? "together" : "pollinations",
    logoMime: row.logoMime ?? "",
    houseStyle: row.houseStyle ?? "",
  };
}

export function saveSettings(settings: AgencySettings): AgencySettings {
  db.prepare(
    `INSERT INTO settings (id, agencyName, tagline, accentColor, landingPagesEnabled, aiMode, anthropicApiKey, googleAiApiKey, togetherApiKey, imageProvider, logoMime, houseStyle)
     VALUES (1, @agencyName, @tagline, @accentColor, @landingPagesEnabled, @aiMode, @anthropicApiKey, @googleAiApiKey, @togetherApiKey, @imageProvider, @logoMime, @houseStyle)
     ON CONFLICT(id) DO UPDATE SET agencyName=@agencyName, tagline=@tagline, accentColor=@accentColor,
       landingPagesEnabled=@landingPagesEnabled, aiMode=@aiMode, anthropicApiKey=@anthropicApiKey, googleAiApiKey=@googleAiApiKey, togetherApiKey=@togetherApiKey, imageProvider=@imageProvider, logoMime=@logoMime, houseStyle=@houseStyle`
  ).run({
    ...settings,
    landingPagesEnabled: settings.landingPagesEnabled ? 1 : 0,
  });
  return settings;
}
