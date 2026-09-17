import { describe, expect, it } from "vitest";
import {
  computeLearnings,
  dailySeries,
  describeLearnings,
  hourBucket,
  mockLearningsReading,
  periodDays,
  pickMetric,
  postClock,
  type LearningPost,
  type LearningSale,
} from "@/lib/learnings-rules";

// Setembro/2026: dia 1 é terça (2), dia 4 é sexta (5)
const post = (day: number, format: string, hour: string, over: Partial<LearningPost> = {}): LearningPost => ({
  id: `p${day}`,
  channel: "Instagram",
  status: "published",
  scheduledFor: `2026-09-${String(day).padStart(2, "0")}T${hour}`,
  format,
  hookType: format === "Reels" ? "bastidores" : "oferta",
  ...over,
});
const dailySale = (day: number, revenue: number): LearningSale => {
  const key = `2026-09-${String(day).padStart(2, "0")}`;
  return { periodStart: key, periodEnd: key, revenue, units: 1, currency: "BRL" };
};
const salesAfter = (days: number[], revenue: number) => days.flatMap((d) => [0, 1, 2].map((i) => dailySale(d + i, revenue)));

const reelsDays = [1, 8, 15, 22];
const feedDays = [4, 11, 18, 25];
const posts = [...reelsDays.map((d) => post(d, "Reels", "19:00")), ...feedDays.map((d) => post(d, "Feed", "09:00"))];
const sales = [...salesAfter(reelsDays, 1000), ...salesAfter(feedDays, 100)];

describe("helpers", () => {
  it("buckets hours and reads the local clock of a post", () => {
    expect([6, 12, 15, 20, 2].map(hourBucket)).toEqual(["morning", "lunch", "afternoon", "evening", "night"]);
    expect(postClock("2026-09-01T19:30")).toEqual({ day: "2026-09-01", hour: 19, weekday: 2 });
  });
  it("expands short periods and refuses long ones", () => {
    expect(periodDays("2026-09-01", "2026-09-03")).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(periodDays("2026-09-05", "")).toEqual(["2026-09-05"]);
    expect(periodDays("2026-08-18", "2026-09-16")).toBeNull();
    expect(periodDays("2026-09-05", "2026-09-01")).toBeNull();
  });
  it("prorates sales over their period and takes the latest snapshot per platform/day", () => {
    const range = { from: "2026-09-01", to: "2026-09-30" };
    const s = dailySeries("revenue", [], [{ periodStart: "2026-09-01", periodEnd: "2026-09-02", revenue: 100, units: 1 }, dailySale(2, 10)], range);
    expect(s.get("2026-09-01")).toBe(50);
    expect(s.get("2026-09-02")).toBe(60);
    const snaps = dailySeries(
      "conversions",
      [
        { platform: "ga4", periodStart: "2026-09-01", periodEnd: "2026-09-01", clicks: 0, conversions: 4, revenue: 0, createdAt: "2026-09-02T00:00:00Z" },
        { platform: "ga4", periodStart: "2026-09-01", periodEnd: "2026-09-01", clicks: 0, conversions: 6, revenue: 0, createdAt: "2026-09-03T00:00:00Z" },
        { platform: "meta_ads", periodStart: "2026-09-01", periodEnd: "2026-09-01", clicks: 0, conversions: 1, revenue: 0, createdAt: "2026-09-02T00:00:00Z" },
      ],
      [],
      range
    );
    expect(snaps.get("2026-09-01")).toBe(7);
  });
  it("prefers sales, then conversions, then clicks — ignoring 30-day syncs", () => {
    const range = { from: "2026-09-01", to: "2026-09-30" };
    const monthly = { platform: "ga4", periodStart: "2026-08-18", periodEnd: "2026-09-16", clicks: 900, conversions: 30, revenue: 0, createdAt: "2026-09-16T00:00:00Z" };
    expect(pickMetric([monthly], [], range)).toBeNull();
    expect(pickMetric([{ ...monthly, periodStart: "2026-09-03", periodEnd: "2026-09-03", conversions: 0 }], [], range)).toBe("clicks");
    expect(pickMetric([], sales, range)).toBe("revenue");
  });
});

describe("computeLearnings", () => {
  it("finds the best format, day and hour and the worst group", () => {
    const l = computeLearnings({ month: "2026-09", posts, snapshots: [], sales });
    expect(l).toMatchObject({ hasEnoughData: true, reason: null, metric: "revenue", postsPublished: 8, postsAnalyzed: 8, baseline: 550, windowDays: 3 });
    expect(l.best.format).toMatchObject({ key: "Reels", posts: 4, avg: 1000, liftPct: 82 });
    expect(l.best.weekday).toMatchObject({ key: "2", liftPct: 82 }); // terça
    expect(l.best.hour).toMatchObject({ key: "evening" });
    expect(l.best.hookType).toMatchObject({ key: "bastidores" });
    expect(l.best.channel).toBeNull(); // um canal só: nada a comparar
    expect(l.worst).toMatchObject({ dimension: "format", key: "Feed", liftPct: -82 });
    expect(l.dimensions.format.map((g) => g.key)).toEqual(["Reels", "Feed"]);
  });
  it("skips gracefully when data is thin, saying why", () => {
    expect(computeLearnings({ month: "2026-09", posts: posts.slice(0, 3), snapshots: [], sales }).reason).toBe("few_posts");
    expect(computeLearnings({ month: "2026-09", posts, snapshots: [], sales: [] }).reason).toBe("no_outcomes");
    const flat = computeLearnings({ month: "2026-09", posts, snapshots: [], sales: [...salesAfter(reelsDays, 100), ...salesAfter(feedDays, 100)] });
    expect(flat.reason).toBe("no_variation");
    expect(flat.hasEnoughData).toBe(false);
    // cada formato/gancho/dia/horário uma vez só: nenhum grupo com 2 posts para comparar
    const days = [1, 5, 9, 13]; // terça, sábado, quarta, domingo
    const hours = ["06:00", "12:00", "15:00", "20:00"];
    const single = days.map((d, i) => post(d, `F${i}`, hours[i], { hookType: `H${i}` }));
    const oneEach = computeLearnings({ month: "2026-09", posts: single, snapshots: [], sales: days.flatMap((d, i) => [0, 1, 2].map((k) => dailySale(d + k, 100 * (i + 1)))) });
    expect(oneEach.reason).toBe("no_comparison");
    expect(oneEach.hasEnoughData).toBe(false);
    expect(oneEach.dimensions.format).toHaveLength(4);
  });
  it("only counts published posts of the month, and posts inside the data coverage", () => {
    const extra = [post(2, "Reels", "19:00", { status: "scheduled" }), post(30, "Reels", "19:00", { scheduledFor: "2026-10-02T19:00" })];
    expect(computeLearnings({ month: "2026-09", posts: [...posts, ...extra], snapshots: [], sales }).postsPublished).toBe(8);
    // vendas só até o dia 10: posts depois da cobertura ficam de fora
    const partial = computeLearnings({ month: "2026-09", posts, snapshots: [], sales: sales.filter((s) => s.periodStart <= "2026-09-10") });
    expect(partial.postsAnalyzed).toBe(3);
    expect(partial.reason).toBe("few_posts_with_outcomes");
  });
  it("describes the result for the report and writes a 3-line demo reading", () => {
    const l = computeLearnings({ month: "2026-09", posts, snapshots: [], sales });
    const text = describeLearnings(l).join("\n");
    expect(text).toContain("melhor formato: Reels (1000, +82% vs média, 4 posts)");
    expect(text).toContain("melhor dia: terça");
    expect(text).toContain("pior formato: Feed");
    expect(describeLearnings(l, "en").join("\n")).toContain("best time of day: evening");
    const reading = mockLearningsReading(l, "pt-BR");
    expect(reading.lines).toHaveLength(3);
    expect(reading.lines[0]).toContain("Reels");
    expect(reading.lines[2]).toContain("Feed");
    expect(describeLearnings(computeLearnings({ month: "2026-09", posts: [], snapshots: [], sales }))[0]).toContain("dados insuficientes");
  });
});
