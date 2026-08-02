import { db } from "./db";

export type AgencySettings = {
  agencyName: string;
  tagline: string;
  accentColor: string;
};

const DEFAULTS: AgencySettings = {
  agencyName: "AgencyHub",
  tagline: "sua agência, centralizada e acelerada por IA",
  accentColor: "#c6f24e",
};

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    agencyName TEXT NOT NULL,
    tagline TEXT NOT NULL,
    accentColor TEXT NOT NULL
  );
`);

export function getSettings(): AgencySettings {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as
    | (AgencySettings & { id: number })
    | undefined;
  return row ?? DEFAULTS;
}

export function saveSettings(settings: AgencySettings): AgencySettings {
  db.prepare(
    `INSERT INTO settings (id, agencyName, tagline, accentColor) VALUES (1, @agencyName, @tagline, @accentColor)
     ON CONFLICT(id) DO UPDATE SET agencyName=@agencyName, tagline=@tagline, accentColor=@accentColor`
  ).run(settings);
  return settings;
}
