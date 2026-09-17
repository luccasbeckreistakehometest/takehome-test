import { describe, expect, it } from "vitest";
import {
  canRun,
  competitorList,
  countryCode,
  disclaimer,
  foldName,
  mockResults,
  nextRunAt,
  sameBrand,
  sanitizeQuestions,
  summarizeRun,
  whyNotYou,
  type QuestionResult,
} from "@/lib/ai-visibility-rules";

const result = (brands: string[], types: QuestionResult["citedSources"][number]["type"][] = []): QuestionResult => ({
  question: "q",
  answerSummary: "",
  brandsMentioned: brands.map((name, i) => ({ name, position: i + 1, sentiment: "neutro" })),
  clientMentioned: false,
  clientPosition: null,
  citedSources: types.map((type) => ({ url: "https://x", type })),
});

describe("AI radar rules", () => {
  it("treats spelling variants as the same brand, not look-alikes", () => {
    expect(foldName("Pet Shop Au-Au")).toBe("petshopauau");
    expect(sameBrand("Pet Shop Au-Au", "pet shop au au")).toBe(true);
    expect(sameBrand("Pet Shop Au-Au", "PetShop AuAu")).toBe(true);
    expect(sameBrand("Pet Shop Au-Au", "Au Pet")).toBe(false);
    expect(sameBrand("Café Aurora", "Cafe Aurora Vila Mariana")).toBe(true);
    expect(sameBrand("Sol", "Solar Energia")).toBe(false);
    expect(sameBrand("", "x")).toBe(false);
  });

  it("computes share of voice exactly (2 of 8 = 25%)", () => {
    const results = [
      result(["Pet Shop Au-Au", "Cão Feliz", "Mundo Pet"], ["review", "lista"]),
      result(["Cão Feliz", "petshop auau", "Bicho Chic"], ["review"]),
      result(["Mundo Pet", "Bicho Chic"], ["diretório"]),
    ];
    const s = summarizeRun(results, "Pet Shop Au-Au", "Cão Feliz, Mundo Pet e Bicho Chic");
    expect(s.totalMentions).toBe(8);
    expect(s.clientMentions).toBe(2);
    expect(s.shareOfVoice).toBe(25);
    expect(s.answersWithClient).toBe(2);
    expect(s.bestPosition).toBe(1);
    expect(s.competitors).toEqual([
      { name: "Cão Feliz", mentions: 2 },
      { name: "Mundo Pet", mentions: 2 },
      { name: "Bicho Chic", mentions: 2 },
    ]);
    expect(s.sources[0]).toEqual({ type: "review", answers: 2 });
    expect(whyNotYou(s)[0]).toBe("2 de 3 respostas citam avaliações");
    expect(s.actions[0]).toContain("avaliações no Google");
    expect(summarizeRun([], "X", "").shareOfVoice).toBe(0);
  });

  it("allows one run per client per 7 days", () => {
    const last = "2026-09-10T12:00:00.000Z";
    expect(nextRunAt(last)).toBe("2026-09-17T12:00:00.000Z");
    expect(canRun(last, new Date("2026-09-17T11:59:59Z"))).toBe(false);
    expect(canRun(last, new Date("2026-09-17T12:00:00Z"))).toBe(true);
    expect(canRun(null)).toBe(true);
  });

  it("cleans questions, competitors and country codes", () => {
    expect(sanitizeQuestions(["  Qual o melhor pet shop na Vila Mariana? ", "qual o melhor pet shop na vila mariana?", "curta", ...Array.from({ length: 12 }, (_, i) => `Pergunta número ${i}`)])).toHaveLength(10);
    expect(competitorList("Cão Feliz (Moema), Mundo Pet; Bicho Chic e Zoo")).toEqual(["Cão Feliz", "Mundo Pet", "Bicho Chic", "Zoo"]);
    expect(countryCode("Brasil")).toBe("BR");
    expect(countryCode("Marte")).toBeUndefined();
  });

  it("always carries the honest simulation label", () => {
    expect(disclaimer("2026-09-17T10:00:00Z")).toBe("Simulação feita por IA com busca na web em 17/09/2026. Assistentes como ChatGPT e Gemini podem responder diferente.");
    expect(disclaimer("2026-09-17T10:00:00Z", "en")).toContain("may answer differently");
  });

  it("produces a stable example run", () => {
    const results = mockResults(["a pergunta um", "a pergunta dois", "a pergunta três"], "Loja Sol", "Loja Lua, Loja Mar");
    expect(results).toHaveLength(3);
    const s = summarizeRun(results, "Loja Sol", "Loja Lua, Loja Mar");
    expect(s.clientMentions).toBe(1);
    expect(s.totalMentions).toBe(7);
  });
});
