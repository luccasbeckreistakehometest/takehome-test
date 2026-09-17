import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// A rodada do radar demora minutos: a vez da semana é reservada ANTES de
// começar, senão dois cliques juntos passariam os dois.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-radar-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { createClient } = await import("../../lib/db");
const agencies = await import("../../lib/agencies");
const radar = await import("../../lib/ai-visibility-db");

const agencyId = agencies.createAgency({ name: "Agência Radar", ownerUserId: null }).id;
const client = createClient(
  {
    name: "Marca Radar",
    industry: "",
    description: "",
    audience: "",
    tone: "",
    goals: "",
    budget: "",
    channels: [],
    differentials: "",
    competitors: "",
    brandColors: "",
    website: "",
    instagram: "",
    notes: "",
    capabilities: "",
    language: "pt-BR",
    source: "agency",
    country: "Brasil",
    selfServe: false,
  },
  agencyId
);

describe("AI radar weekly slot", () => {
  it("lets one run start at a time and only once a week", () => {
    expect(radar.claimRun(client.id)).toEqual({ ok: true });
    const second = radar.claimRun(client.id);
    expect(second).toMatchObject({ ok: false, running: true });
    // reserva presa vence sozinha
    const later = new Date(Date.now() + radar.CLAIM_STALE_MS + 1000);
    expect(radar.claimRun(client.id, later)).toEqual({ ok: true });
    radar.releaseRun(client.id);

    const ranAt = new Date().toISOString();
    radar.saveRun({
      clientId: client.id,
      ranAt,
      results: [],
      summary: { shareOfVoice: 0, clientMentions: 0, questions: 0, brands: [], whyNot: [], actions: [], disclaimer: "", lang: "pt-BR" } as never,
      costUsd: 0,
      demo: true,
    });
    const blocked = radar.claimRun(client.id);
    expect(blocked).toMatchObject({ ok: false, running: false });
    expect((blocked as { nextRunAt: string }).nextRunAt > ranAt).toBe(true);
    // passada a semana, roda de novo
    expect(radar.claimRun(client.id, new Date(Date.now() + 8 * 86_400_000))).toEqual({ ok: true });
  });
});
