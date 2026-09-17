import { describe, expect, it } from "vitest";
import {
  aggregateMonth,
  currentMonth,
  describeMonth,
  isValidMonth,
  monthRange,
  shiftMonth,
  type ReportInput,
} from "@/lib/report-aggregate";

const base = (over: Partial<ReportInput> = {}): ReportInput => ({
  month: "2026-08",
  projects: [],
  deliverables: [],
  annotations: [],
  posts: [],
  snapshots: [],
  sales: [],
  generations: [],
  ...over,
});

describe("month helpers", () => {
  it("validates YYYY-MM", () => {
    expect(isValidMonth("2026-08")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("26-08")).toBe(false);
    expect(isValidMonth("2026-8")).toBe(false);
  });
  it("computes UTC boundaries and shifts across years", () => {
    expect(monthRange("2026-08")).toEqual({ start: "2026-08-01T00:00:00.000Z", end: "2026-09-01T00:00:00.000Z" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(currentMonth(new Date("2026-09-17T12:00:00Z"))).toBe("2026-09");
  });
});

describe("aggregateMonth", () => {
  it("counts only what happened in the month and reads approval fields", () => {
    const data = aggregateMonth(
      base({
        projects: [
          { id: "p1", title: "Feed de agosto", status: "approved", createdAt: "2026-08-03T10:00:00.000Z" },
          { id: "p2", title: "Antigo", status: "in_progress", createdAt: "2026-07-03T10:00:00.000Z" },
        ],
        deliverables: [
          { id: "d1", projectId: "p1", title: "Post 1", kind: "delivery", approvalStatus: "approved", approvedAt: "2026-08-05T10:00:00.000Z", createdAt: "2026-08-04T10:00:00.000Z" },
          { id: "d2", projectId: "p1", title: "Post 2", kind: "delivery", createdAt: "2026-08-20T10:00:00.000Z" },
          { id: "d3", projectId: "p2", title: "Ref", kind: "reference", createdAt: "2026-08-20T10:00:00.000Z" },
          { id: "d4", projectId: "p2", title: "Julho", kind: "delivery", createdAt: "2026-07-20T10:00:00.000Z" },
          // criada em julho, aprovada em agosto → conta em agosto
          { id: "d5", projectId: "p2", title: "Aprovada agora", kind: "delivery", approvalStatus: "approved", approvedAt: "2026-08-01T09:00:00.000Z", createdAt: "2026-07-28T10:00:00.000Z" },
        ],
        annotations: [
          { deliverableId: "d1", resolved: true, createdAt: "2026-08-04T11:00:00.000Z" },
          { deliverableId: "d1", resolved: false, createdAt: "2026-08-04T12:00:00.000Z" },
          { deliverableId: "d4", resolved: false, createdAt: "2026-07-21T12:00:00.000Z" },
        ],
      })
    );
    expect(data.shipped.total).toBe(3);
    expect(data.shipped.approved).toBe(2);
    expect(data.shipped.pending).toBe(1);
    expect(data.shipped.items.map((i) => i.id)).toEqual(["d5", "d1", "d2"]);
    expect(data.shipped.items[1]).toMatchObject({ projectTitle: "Feed de agosto", annotations: 2, openAnnotations: 1 });
    expect(data.projects).toEqual({ created: 1, completed: 1, active: 1 });
    expect(data.annotations).toEqual({ total: 2, resolved: 1 });
  });

  it("splits posts by status and channel, ignoring canceled in the channel mix", () => {
    const data = aggregateMonth(
      base({
        posts: [
          { id: "1", title: "a", channel: "Instagram", status: "published", scheduledFor: "2026-08-02T12:00", publishedAt: "2026-08-02T12:00:00.000Z" },
          { id: "2", title: "b", channel: "Instagram", status: "scheduled", scheduledFor: "2026-08-20T12:00", publishedAt: null },
          { id: "3", title: "c", channel: "TikTok", status: "canceled", scheduledFor: "2026-08-21T12:00", publishedAt: null },
          { id: "4", title: "d", channel: "TikTok", status: "draft", scheduledFor: "2026-08-25T12:00", publishedAt: null },
          { id: "5", title: "e", channel: "Instagram", status: "published", scheduledFor: "2026-09-01T12:00", publishedAt: null },
        ],
      })
    );
    expect(data.posts).toMatchObject({ scheduled: 1, published: 1, canceled: 1, drafts: 1 });
    expect(data.posts.byChannel).toEqual([
      { channel: "Instagram", count: 2 },
      { channel: "TikTok", count: 1 },
    ]);
  });

  it("uses the latest snapshot per platform and overlapping sales periods", () => {
    const data = aggregateMonth(
      base({
        snapshots: [
          { platform: "meta_ads", periodStart: "2026-07-20", periodEnd: "2026-08-19", spend: 100, impressions: 1000, clicks: 50, conversions: 5, revenue: 500, createdAt: "2026-08-19T00:00:00.000Z" },
          { platform: "meta_ads", periodStart: "2026-07-25", periodEnd: "2026-08-24", spend: 120, impressions: 1200, clicks: 60, conversions: 6, revenue: 600, createdAt: "2026-08-24T00:00:00.000Z" },
          { platform: "ga4", periodStart: "2026-06-01", periodEnd: "2026-06-30", spend: 0, impressions: 9, clicks: 9, conversions: 9, revenue: 9, createdAt: "2026-06-30T00:00:00.000Z" },
        ],
        sales: [
          { source: "Shopify", periodStart: "2026-08-10", periodEnd: "2026-08-10", revenue: 300, units: 3, currency: "BRL" },
          { source: "Shopify", periodStart: "2026-07-30", periodEnd: "2026-08-02", revenue: 100, units: 1, currency: "BRL" },
          { source: "Shopify", periodStart: "2026-09-01", periodEnd: "2026-09-01", revenue: 999, units: 9, currency: "BRL" },
        ],
      })
    );
    expect(data.metrics).toMatchObject({ hasData: true, spend: 120, impressions: 1200, conversions: 6, platforms: ["meta_ads"] });
    expect(data.sales).toMatchObject({ hasData: true, revenue: 400, units: 4, entries: 2, currency: "BRL" });
  });

  it("reports no data cleanly and describes the month for the prompt", () => {
    const data = aggregateMonth(base());
    expect(data.metrics.hasData).toBe(false);
    expect(data.sales.hasData).toBe(false);
    const text = describeMonth(data);
    expect(text).toContain("Mês: 2026-08");
    expect(text).toContain("sem métricas conectadas");
    expect(text).toContain("sem registros");
  });
});
