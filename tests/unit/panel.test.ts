import { describe, expect, it } from "vitest";
import { calibration, genericPersonas, mockPanel, normalizeResult, personasFromStrategy, validateVariants, variantScores } from "@/lib/panel-rules";

describe("synthetic panel rules", () => {
  it("accepts 2 or 3 different variants only", () => {
    expect(validateVariants(["a legenda A", "a legenda B"]).ok).toBe(true);
    expect(validateVariants(["só uma"]).ok).toBe(false);
    expect(validateVariants(["um", "dois", "tres", "quatro"]).ok).toBe(false);
    expect(validateVariants(["igual", "IGUAL"]).ok).toBe(false);
    expect(validateVariants(["ok texto", "x"]).ok).toBe(false);
    expect(validateVariants(["ok texto", "  ", "outro texto"])).toEqual({ ok: true, variants: ["ok texto", "outro texto"] });
  });

  it("reads personas from the strategy and falls back to generic ones", () => {
    const strategy = JSON.stringify({ targetBuyers: [{ persona: "Mãe que trabalha", profile: "35 anos", pains: ["tempo"], desires: ["praticidade"], buyingTriggers: "promoção" }, { persona: "Estudante", profile: "20 anos", pains: [], desires: [], buyingTriggers: "" }] });
    const personas = personasFromStrategy(strategy);
    expect(personas.map((p) => p.name)).toEqual(["Mãe que trabalha", "Estudante"]);
    expect(personas[0].description).toContain("praticidade");
    expect(personasFromStrategy("não é json")).toEqual([]);
    expect(genericPersonas("donos de pet", "pt-BR")).toHaveLength(4);
    expect(genericPersonas("", "en")[0].description).toContain("the brand's audience");
  });

  it("fills every persona × variant cell and keeps a valid winner", () => {
    const personas = genericPersonas("x", "pt-BR");
    const raw = { cells: [{ persona: personas[0].name, variant: 1, stopScroll: 14, clarity: -2, wouldClick: true, objection: "", quote: "" }], winner: 7, why: "", fix: "" };
    const result = normalizeResult(raw, personas, 2);
    expect(result.cells).toHaveLength(8);
    expect(result.cells.find((c) => c.variant === 1 && c.persona === personas[0].name)).toMatchObject({ stopScroll: 10, clarity: 0 });
    expect([0, 1]).toContain(result.winner);
    const mock = normalizeResult(mockPanel(personas, ["uma legenda bem longa para o feed", "curta"]), personas, 2);
    expect(mock.winner).toBe(1);
    const scores = variantScores(mock, 2);
    expect(scores[1].score).toBeGreaterThan(scores[0].score);
    expect(scores[1].clickRate).toBe(100);
  });

  it("calibrates only after 5 comparable tests", () => {
    const hit = { predictedWinner: 0, clicksByVariant: [10, 3] };
    const miss = { predictedWinner: 0, clicksByVariant: [2, 9] };
    const notLive = { predictedWinner: 0, clicksByVariant: [5, null] };
    const noClicks = { predictedWinner: 1, clicksByVariant: [0, 0] };
    expect(calibration([hit, hit, miss, notLive, noClicks])).toBeNull();
    expect(calibration([hit, hit, hit, miss, miss, notLive])).toEqual({ hits: 3, total: 5, pct: 60 });
  });
});
