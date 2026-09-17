import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTENDANT_CONFIG,
  canAutoReply,
  containsPriceOrPromise,
  defaultHandoffMessage,
  evaluateDraft,
  isWithinBusinessHours,
  localClock,
  sanitizeAttendantConfig,
  wantsHuman,
  type AiDraft,
} from "@/lib/attendant-rules";

const okDraft: AiDraft = {
  reply: "Oi! A gente atende de segunda a sexta, das 8h às 18h.",
  intent: "hours",
  confidence: 0.9,
  needsHuman: false,
  mentionsPriceOrCommitment: false,
  summary: "horário",
};

describe("wantsHuman", () => {
  it("catches explicit requests in pt and en, accent-insensitive", () => {
    expect(wantsHuman("quero falar com um atendente")).toBe(true);
    expect(wantsHuman("Posso falar com alguém?")).toBe(true);
    expect(wantsHuman("é um robô? quero uma pessoa de verdade")).toBe(true);
    expect(wantsHuman("Can I talk to a real person?")).toBe(true);
    expect(wantsHuman("I need an agent")).toBe(true);
  });
  it("does not trigger on ordinary questions", () => {
    expect(wantsHuman("vocês abrem no sábado?")).toBe(false);
    expect(wantsHuman("qual o endereço?")).toBe(false);
  });
});

describe("containsPriceOrPromise", () => {
  it("flags prices, discounts and guarantees in the reply", () => {
    expect(containsPriceOrPromise("Fica R$ 120 o corte")).toBe(true);
    expect(containsPriceOrPromise("Temos 20% de desconto hoje")).toBe(true);
    expect(containsPriceOrPromise("Garanto que chega amanhã")).toBe(true);
    expect(containsPriceOrPromise("It's $40 and we guarantee delivery")).toBe(true);
    expect(containsPriceOrPromise("Entrega grátis")).toBe(true);
  });
  it("lets neutral replies through", () => {
    expect(containsPriceOrPromise("Atendemos de segunda a sexta, das 8h às 18h")).toBe(false);
    expect(containsPriceOrPromise("Fica na Rua das Flores, 120")).toBe(false);
  });
});

describe("business hours", () => {
  const cfg = { hoursStart: 8, hoursEnd: 18, days: [1, 2, 3, 4, 5], timezone: "America/Sao_Paulo" };
  it("converts to the client's timezone", () => {
    // 2026-09-16 é quarta; 13:00Z = 10:00 em São Paulo (UTC-3)
    expect(localClock(new Date("2026-09-16T13:00:00Z"), "America/Sao_Paulo")).toEqual({ hour: 10, weekday: 3 });
    expect(isWithinBusinessHours(new Date("2026-09-16T13:00:00Z"), cfg)).toBe(true);
  });
  it("is closed before opening, after closing and on weekends", () => {
    expect(isWithinBusinessHours(new Date("2026-09-16T10:30:00Z"), cfg)).toBe(false); // 07:30 local
    expect(isWithinBusinessHours(new Date("2026-09-16T21:00:00Z"), cfg)).toBe(false); // 18:00 local (exclusive)
    expect(isWithinBusinessHours(new Date("2026-09-19T15:00:00Z"), cfg)).toBe(false); // sábado
  });
  it("falls back to São Paulo on an invalid timezone", () => {
    expect(isWithinBusinessHours(new Date("2026-09-16T13:00:00Z"), { ...cfg, timezone: "Not/AZone" })).toBe(true);
  });
});

describe("canAutoReply", () => {
  it("gates by mode, hours and the per-contact daily limit", () => {
    expect(canAutoReply({ mode: "off", withinHours: true, autoRepliesToday: 0, max: 5 })).toEqual({ ok: false, reason: "mode_off" });
    expect(canAutoReply({ mode: "draft", withinHours: true, autoRepliesToday: 0, max: 5 })).toEqual({ ok: false, reason: "mode_draft" });
    expect(canAutoReply({ mode: "auto", withinHours: false, autoRepliesToday: 0, max: 5 })).toEqual({ ok: false, reason: "outside_hours" });
    expect(canAutoReply({ mode: "auto", withinHours: true, autoRepliesToday: 5, max: 5 })).toEqual({ ok: false, reason: "rate_limit" });
    expect(canAutoReply({ mode: "auto", withinHours: true, autoRepliesToday: 4, max: 5 })).toEqual({ ok: true });
  });
});

describe("evaluateDraft", () => {
  const cfg = { minConfidence: 0.7 };
  it("sends a confident, safe reply", () => {
    expect(evaluateDraft(okDraft, cfg)).toEqual({ outcome: "send" });
  });
  it("hands off when the AI asks for a human or talks prices/promises", () => {
    expect(evaluateDraft({ ...okDraft, needsHuman: true }, cfg)).toEqual({ outcome: "handoff", reason: "needs_human" });
    expect(evaluateDraft({ ...okDraft, mentionsPriceOrCommitment: true }, cfg)).toEqual({ outcome: "handoff", reason: "price_or_promise" });
    expect(evaluateDraft({ ...okDraft, reply: "Custa R$ 50" }, cfg)).toEqual({ outcome: "handoff", reason: "price_or_promise" });
  });
  it("keeps low-confidence or empty replies as drafts", () => {
    expect(evaluateDraft({ ...okDraft, confidence: 0.5 }, cfg)).toEqual({ outcome: "draft", reason: "low_confidence" });
    expect(evaluateDraft({ ...okDraft, reply: "  " }, cfg)).toEqual({ outcome: "draft", reason: "empty" });
  });
});

describe("config", () => {
  it("has a handoff message per language", () => {
    expect(defaultHandoffMessage("pt-BR", "Café Aurora")).toContain("Café Aurora");
    expect(defaultHandoffMessage("en", "Café Aurora")).toMatch(/team/);
  });
  it("sanitises and clamps", () => {
    const cfg = sanitizeAttendantConfig({ mode: "auto", hoursStart: 22, hoursEnd: 9, days: [7, 1, 1, 5], maxAutoPerContactPerDay: 500, minConfidence: 3 });
    expect(cfg.mode).toBe("auto");
    expect(cfg.hoursStart).toBe(22);
    expect(cfg.hoursEnd).toBe(23);
    expect(cfg.days).toEqual([1, 5]);
    expect(cfg.maxAutoPerContactPerDay).toBe(50);
    expect(cfg.minConfidence).toBe(1);
    expect(sanitizeAttendantConfig({ mode: "weird" as never }).mode).toBe(DEFAULT_ATTENDANT_CONFIG.mode);
  });
});
