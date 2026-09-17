import { addColumnIfMissing, db } from "./db";

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
  togetherApiKey: string; // Together AI (FLUX.1-schnell-Free)
  hfApiKey: string; // Hugging Face (FLUX.1-dev, melhor qualidade free)
  imageProvider: "huggingface" | "together" | "pollinations"; // provedor de conceitos free
  logoMime: string; // mime do logo whitelabel (vazio = sem logo, usa inicial)
  houseStyle: string; // "estilo da casa": diretrizes injetadas em todos os prompts
};

const DEFAULTS: AgencySettings = {
  agencyName: "Marqa",
  tagline: "sua marca, acelerada por IA",
  accentColor: "#f76b15",
  landingPagesEnabled: false,
  aiMode: "balanced",
  anthropicApiKey: "",
  googleAiApiKey: "",
  togetherApiKey: "",
  hfApiKey: "",
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
    hfApiKey TEXT NOT NULL DEFAULT '',
    imageProvider TEXT NOT NULL DEFAULT 'pollinations',
    logoMime TEXT NOT NULL DEFAULT '',
    houseStyle TEXT NOT NULL DEFAULT ''
  );
`);

// Migração para bancos criados antes das flags
addColumnIfMissing("settings", "landingPagesEnabled", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("settings", "economyMode", "INTEGER NOT NULL DEFAULT 1");
addColumnIfMissing("settings", "aiMode", "TEXT NOT NULL DEFAULT 'balanced'");
addColumnIfMissing("settings", "anthropicApiKey", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("settings", "googleAiApiKey", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("settings", "houseStyle", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("settings", "togetherApiKey", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("settings", "imageProvider", "TEXT NOT NULL DEFAULT 'pollinations'");
addColumnIfMissing("settings", "hfApiKey", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("settings", "logoMime", "TEXT NOT NULL DEFAULT ''");

type SettingsRow = {
  agencyName: string;
  tagline: string;
  accentColor: string;
  landingPagesEnabled: number;
  aiMode: string;
  anthropicApiKey: string;
  googleAiApiKey: string;
  togetherApiKey: string;
  hfApiKey: string;
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
    hfApiKey: row.hfApiKey ?? "",
    imageProvider: (["huggingface", "together", "pollinations"] as const).includes(
      row.imageProvider as "huggingface" | "together" | "pollinations"
    )
      ? (row.imageProvider as "huggingface" | "together" | "pollinations")
      : "pollinations",
    logoMime: row.logoMime ?? "",
    houseStyle: row.houseStyle ?? "",
  };
}

export function saveSettings(settings: AgencySettings): AgencySettings {
  db.prepare(
    `INSERT INTO settings (id, agencyName, tagline, accentColor, landingPagesEnabled, aiMode, anthropicApiKey, googleAiApiKey, togetherApiKey, hfApiKey, imageProvider, logoMime, houseStyle)
     VALUES (1, @agencyName, @tagline, @accentColor, @landingPagesEnabled, @aiMode, @anthropicApiKey, @googleAiApiKey, @togetherApiKey, @hfApiKey, @imageProvider, @logoMime, @houseStyle)
     ON CONFLICT(id) DO UPDATE SET agencyName=@agencyName, tagline=@tagline, accentColor=@accentColor,
       landingPagesEnabled=@landingPagesEnabled, aiMode=@aiMode, anthropicApiKey=@anthropicApiKey, googleAiApiKey=@googleAiApiKey, togetherApiKey=@togetherApiKey, hfApiKey=@hfApiKey, imageProvider=@imageProvider, logoMime=@logoMime, houseStyle=@houseStyle`
  ).run({
    ...settings,
    landingPagesEnabled: settings.landingPagesEnabled ? 1 : 0,
  });
  return settings;
}
