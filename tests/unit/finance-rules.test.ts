import { describe, expect, it } from "vitest";
import {
  clientMargin,
  entryCost,
  entryMinutes,
  formatHours,
  marginCsv,
  marginTotals,
  monthEntries,
  sanitizeFinanceSettings,
  type TimeEntryLike,
} from "@/lib/finance-rules";

const now = new Date("2026-09-17T12:00:00Z");
const entry = (over: Partial<TimeEntryLike>): TimeEntryLike => ({
  id: "e",
  clientId: "c",
  projectId: null,
  deliverableId: null,
  userId: "u",
  userName: "Agência",
  professionalId: null,
  note: "",
  startedAt: "2026-09-10T10:00:00Z",
  endedAt: "2026-09-10T11:30:00Z",
  minutes: 90,
  manual: false,
  ...over,
});
const rates = { defaultHourlyCost: 80, professional: { p1: 200 } };

describe("entries", () => {
  it("counts running timers from their start and closed ones from the stored minutes", () => {
    expect(entryMinutes(entry({}), now)).toBe(90);
    expect(entryMinutes(entry({ endedAt: null, minutes: 0, startedAt: "2026-09-17T11:15:00Z" }), now)).toBe(45);
    expect(entryMinutes(entry({ endedAt: null, minutes: 0, startedAt: "2026-09-01T00:00:00Z" }), now)).toBe(24 * 60);
    expect(entryMinutes(entry({ endedAt: null, minutes: 0, startedAt: "2026-09-17T13:00:00Z" }), now)).toBe(0);
  });
  it("costs with the professional rate when there is one, else the agency rate", () => {
    expect(entryCost(entry({}), rates, now)).toBe(120);
    expect(entryCost(entry({ professionalId: "p1" }), rates, now)).toBe(300);
    expect(entryCost(entry({ professionalId: "unknown" }), rates, now)).toBe(120);
  });
  it("filters by month", () => {
    const list = [entry({ id: "a" }), entry({ id: "b", startedAt: "2026-08-31T23:00:00Z" })];
    expect(monthEntries(list, "2026-09").map((e) => e.id)).toEqual(["a"]);
  });
  it("formats hours", () => {
    expect(formatHours(90)).toBe("1h30");
    expect(formatHours(5)).toBe("0h05");
  });
});

describe("clientMargin", () => {
  const base = { clientId: "c", name: "Café", rates, targetMarginPct: 30, now };
  it("ok when the fee covers hours with room", () => {
    const m = clientMargin({ ...base, fee: 1000, entries: [entry({}), entry({ id: "2", minutes: 60 })] });
    expect(m).toMatchObject({ fee: 1000, minutes: 150, hours: 2.5, cost: 200, margin: 800, marginPct: 80, effectiveHourlyRate: 400, status: "ok", entries: 2 });
  });
  it("thin below the target margin, loss when hours cost more than the fee", () => {
    expect(clientMargin({ ...base, fee: 300, entries: [entry({ minutes: 180 })] }).status).toBe("thin");
    expect(clientMargin({ ...base, fee: 100, entries: [entry({ minutes: 180 })] })).toMatchObject({ margin: -140, marginPct: -140, status: "loss" });
  });
  it("no_fee when hours exist without a fee, idle when nothing happened", () => {
    expect(clientMargin({ ...base, fee: 0, entries: [entry({})] })).toMatchObject({ status: "no_fee", marginPct: null, effectiveHourlyRate: null });
    expect(clientMargin({ ...base, fee: 0, entries: [] }).status).toBe("idle");
  });
  it("totals and flags", () => {
    const rows = [
      clientMargin({ ...base, fee: 1000, entries: [entry({})] }),
      clientMargin({ ...base, clientId: "d", name: "Loja", fee: 100, entries: [entry({ minutes: 180 })] }),
    ];
    expect(marginTotals(rows)).toEqual({ fee: 1100, cost: 360, margin: 740, hours: 4.5, marginPct: 67.3, flagged: 1 });
  });
});

describe("csv + settings", () => {
  it("writes pt-BR with ; and decimal comma, en with , and dot", () => {
    const rows = [clientMargin({ clientId: "c", name: "Café; Sol", fee: 1000, entries: [entry({})], rates, targetMarginPct: 30, now })];
    const pt = marginCsv(rows, "2026-09", "pt").split("\n");
    expect(pt[0]).toBe("Mês;Cliente;Fee mensal;Horas;Custo;Margem;Margem %;Custo/hora efetivo;Status");
    expect(pt[1]).toBe('2026-09;"Café; Sol";1000,00;1,50;120,00;880,00;88,00;666,67;ok');
    expect(pt[2]).toContain("TOTAL;1000,00");
    const en = marginCsv(rows, "2026-09", "en").split("\n");
    expect(en[1]).toBe('2026-09,"Café; Sol",1000.00,1.50,120.00,880.00,88.00,666.67,ok');
  });
  it("sanitises settings", () => {
    expect(sanitizeFinanceSettings({ defaultHourlyCost: "85.5" as unknown as number, targetMarginPct: 120, currency: "usd" })).toEqual({ defaultHourlyCost: 85.5, targetMarginPct: 95, currency: "BRL" });
    expect(sanitizeFinanceSettings({ defaultHourlyCost: -3 }).defaultHourlyCost).toBe(0);
    expect(sanitizeFinanceSettings({ currency: "USD" }).currency).toBe("USD");
  });
});
