import { db } from "./db";

export type AgencySettings = {
  agencyName: string;
  tagline: string;
  accentColor: string;
  // Feature flags / custo
  landingPagesEnabled: boolean; // gerador de landing page (alto consumo de tokens)
  economyMode: boolean; // usa modelo mais barato nos entregáveis táticos
};

const DEFAULTS: AgencySettings = {
  agencyName: "AgencyHub",
  tagline: "sua agência, centralizada e acelerada por IA",
  accentColor: "#c6f24e",
  landingPagesEnabled: false,
  economyMode: true,
};

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    agencyName TEXT NOT NULL,
    tagline TEXT NOT NULL,
    accentColor TEXT NOT NULL,
    landingPagesEnabled INTEGER NOT NULL DEFAULT 0,
    economyMode INTEGER NOT NULL DEFAULT 1
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

type SettingsRow = {
  agencyName: string;
  tagline: string;
  accentColor: string;
  landingPagesEnabled: number;
  economyMode: number;
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
    economyMode: row.economyMode === 1,
  };
}

export function saveSettings(settings: AgencySettings): AgencySettings {
  db.prepare(
    `INSERT INTO settings (id, agencyName, tagline, accentColor, landingPagesEnabled, economyMode)
     VALUES (1, @agencyName, @tagline, @accentColor, @landingPagesEnabled, @economyMode)
     ON CONFLICT(id) DO UPDATE SET agencyName=@agencyName, tagline=@tagline, accentColor=@accentColor,
       landingPagesEnabled=@landingPagesEnabled, economyMode=@economyMode`
  ).run({
    ...settings,
    landingPagesEnabled: settings.landingPagesEnabled ? 1 : 0,
    economyMode: settings.economyMode ? 1 : 0,
  });
  return settings;
}
