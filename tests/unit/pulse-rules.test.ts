import { describe, expect, it } from "vitest";
import {
  assessRisk,
  duePrompts,
  isValidScore,
  monthlyTrend,
  npsFrom,
  satisfactionForMonth,
  type PulseLike,
} from "@/lib/pulse-rules";

const now = new Date("2026-09-17T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
const pulse = (over: Partial<PulseLike>): PulseLike => ({ kind: "monthly", score: 3, comment: "", context: "", createdAt: daysAgo(1), ...over });

describe("scores", () => {
  it("validates per kind", () => {
    expect(isValidScore("approval", 3)).toBe(true);
    expect(isValidScore("approval", 0)).toBe(false);
    expect(isValidScore("nps", 10)).toBe(true);
    expect(isValidScore("nps", 11)).toBe(false);
    expect(isValidScore("nps", 7.5)).toBe(false);
  });
  it("computes NPS from promoters and detractors", () => {
    expect(npsFrom([10, 9, 7, 3])).toEqual({ score: 25, promoters: 2, passives: 1, detractors: 1, responses: 4 });
    expect(npsFrom([]).score).toBeNull();
    expect(npsFrom([0, 0]).score).toBe(-100);
  });
});

describe("duePrompts", () => {
  const approvals = [
    { deliverableId: "d1", title: "Post A", approvedAt: daysAgo(2) },
    { deliverableId: "d2", title: "Post B", approvedAt: daysAgo(20) },
  ];
  it("asks about recent approvals not yet rated, the current month and the quarter NPS", () => {
    const due = duePrompts({ pulses: [], approvals, now });
    expect(due.approvals.map((a) => a.deliverableId)).toEqual(["d1"]);
    expect(due.monthly).toBe(true);
    expect(due.nps).toBe(true);
  });
  it("stops asking once answered", () => {
    const pulses = [
      pulse({ kind: "approval", context: "d1", createdAt: daysAgo(1) }),
      pulse({ kind: "monthly", context: "2026-09" }),
      pulse({ kind: "nps", score: 9, createdAt: daysAgo(30) }),
    ];
    const due = duePrompts({ pulses, approvals, now });
    expect(due.approvals).toEqual([]);
    expect(due.monthly).toBe(false);
    expect(due.nps).toBe(false);
  });
  it("asks the NPS again after 90 days and the monthly on a new month", () => {
    const pulses = [pulse({ kind: "monthly", context: "2026-08", createdAt: daysAgo(40) }), pulse({ kind: "nps", score: 9, createdAt: daysAgo(91) })];
    const due = duePrompts({ pulses, approvals: [], now });
    expect(due.monthly).toBe(true);
    expect(due.nps).toBe(true);
  });
});

describe("trend", () => {
  it("averages approval + monthly scores per month, oldest first", () => {
    const pulses = [
      pulse({ kind: "approval", score: 3, createdAt: "2026-08-03T10:00:00Z" }),
      pulse({ kind: "monthly", score: 2, createdAt: "2026-08-20T10:00:00Z" }),
      pulse({ kind: "nps", score: 9, createdAt: "2026-08-21T10:00:00Z" }),
      pulse({ kind: "monthly", score: 1, createdAt: "2026-09-02T10:00:00Z" }),
    ];
    const trend = monthlyTrend(pulses, now, 3);
    expect(trend.map((t) => t.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(trend[0]).toEqual({ month: "2026-07", avg: null, count: 0 });
    expect(trend[1]).toEqual({ month: "2026-08", avg: 2.5, count: 2 });
    expect(trend[2]).toEqual({ month: "2026-09", avg: 1, count: 1 });
  });
});

describe("assessRisk", () => {
  const since = daysAgo(120);
  it("is ok for a happy, active client", () => {
    const r = assessRisk({ pulses: [pulse({ score: 3 })], lastActivityAt: daysAgo(3), clientSince: since, now });
    expect(r.level).toBe("ok");
    expect(r.flags).toEqual([]);
    expect(r.latestScore).toBe(3);
  });
  it("flags a recent sad face", () => {
    const r = assessRisk({ pulses: [pulse({ score: 1, comment: "atrasou tudo" })], lastActivityAt: daysAgo(1), clientSince: since, now });
    expect(r.level).toBe("risk");
    expect(r.flags[0]).toMatchObject({ reason: "unhappy_recent", level: "risk", detail: "atrasou tudo" });
  });
  it("flags a falling average (last 2 vs previous 3)", () => {
    const pulses = [3, 3, 3, 1, 2].map((score, i) => pulse({ score, createdAt: daysAgo(50 - i * 10) }));
    const r = assessRisk({ pulses, lastActivityAt: daysAgo(1), clientSince: since, now });
    expect(r.flags.some((f) => f.reason === "falling")).toBe(true);
    expect(r.level).toBe("risk");
  });
  it("does not flag a mild dip", () => {
    const pulses = [3, 3, 3, 3, 2].map((score, i) => pulse({ score, createdAt: daysAgo(50 - i * 10) }));
    expect(assessRisk({ pulses, lastActivityAt: daysAgo(1), clientSince: since, now }).level).toBe("ok");
  });
  it("flags a detractor NPS and silence", () => {
    const r = assessRisk({ pulses: [pulse({ kind: "nps", score: 4, createdAt: daysAgo(10) })], lastActivityAt: daysAgo(35), clientSince: since, now });
    expect(r.flags.map((f) => f.reason)).toEqual(["detractor", "silent"]);
    expect(r.flags.find((f) => f.reason === "silent")?.level).toBe("watch");
    expect(r.daysSilent).toBe(35);
    const long = assessRisk({ pulses: [], lastActivityAt: daysAgo(61), clientSince: since, now });
    expect(long.flags.map((f) => `${f.reason}:${f.level}`)).toEqual(["silent:risk", "no_feedback:watch"]);
  });
  it("new clients are not silent or feedback-less yet", () => {
    const r = assessRisk({ pulses: [], lastActivityAt: null, clientSince: daysAgo(10), now });
    expect(r.level).toBe("ok");
  });
});

describe("satisfactionForMonth", () => {
  it("summarises the month and the quarter NPS", () => {
    const pulses = [
      pulse({ kind: "approval", score: 3, comment: "ótimo", createdAt: "2026-09-03T10:00:00Z" }),
      pulse({ kind: "monthly", score: 1, comment: " ", createdAt: "2026-09-10T10:00:00Z" }),
      pulse({ kind: "nps", score: 10, createdAt: "2026-07-10T10:00:00Z" }),
      pulse({ kind: "nps", score: 2, createdAt: "2026-04-10T10:00:00Z" }), // fora do trimestre
      pulse({ kind: "monthly", score: 2, createdAt: "2026-08-10T10:00:00Z" }), // outro mês
    ];
    const s = satisfactionForMonth(pulses, "2026-09");
    expect(s).toMatchObject({ hasData: true, responses: 2, avg: 2, happy: 1, neutral: 0, sad: 1, comments: ["ótimo"] });
    expect(s.nps).toMatchObject({ score: 100, responses: 1 });
    expect(satisfactionForMonth([], "2026-09").hasData).toBe(false);
  });
});
