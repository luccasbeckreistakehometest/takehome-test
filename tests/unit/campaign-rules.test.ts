import { describe, expect, it } from "vitest";
import { bestHour, campaignWindow, mockCampaignPlan, sanitizeCampaignInput, scheduleCampaign, type CampaignPlan } from "@/lib/campaign-rules";

const plan = (offsets: [number, string][]): CampaignPlan => ({
  theme: "t",
  summary: "s",
  weeks: [],
  posts: offsets.map(([dayOffset, channel], i) => ({ dayOffset, channel, format: "Feed", title: `p${i}`, hookType: "dor", hook: "", caption: "", cta: "", imageBrief: "", hashtags: [] })),
});

describe("window and input", () => {
  it("builds the day window and channel hours", () => {
    expect(campaignWindow("2026-09-29", 3)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(bestHour("LinkedIn")).toBe(9);
    expect(bestHour("Instagram")).toBe(11);
    expect(bestHour("TikTok")).toBe(19);
  });
  it("sanitises input with client channels as fallback and tomorrow as start", () => {
    const s = sanitizeCampaignInput({ goal: " vender mais ", days: 200, postsPerWeek: 0, channels: [] }, ["Instagram", "WhatsApp"], "2026-09-17");
    expect(s).toEqual({ goal: "vender mais", channels: ["Instagram", "WhatsApp"], startDate: "2026-09-18", days: 60, postsPerWeek: 1 });
    expect(sanitizeCampaignInput({ startDate: "2026-10-01", channels: ["TikTok", "TikTok"] }, [], "2026-09-17").channels).toEqual(["TikTok"]);
    expect(sanitizeCampaignInput({}, [], "2026-09-17").channels).toEqual(["Instagram"]);
  });
});

describe("scheduleCampaign", () => {
  it("places posts on the requested day when free and moves them past collisions", () => {
    const slots = scheduleCampaign({
      plan: plan([
        [0, "Instagram"],
        [2, "Instagram"],
        [2, "LinkedIn"],
      ]),
      startDate: "2026-10-01",
      days: 30,
      existing: [{ id: "x", scheduledFor: "2026-10-03T10:00", status: "scheduled", channel: "Instagram" }],
    });
    expect(slots.map((s) => `${s.day} ${s.channel}`)).toEqual(["2026-10-01 Instagram", "2026-10-03 LinkedIn", "2026-10-04 Instagram"]);
    expect(slots[0].scheduledFor).toBe("2026-10-01T11:00");
    expect(slots[1].scheduledFor).toBe("2026-10-03T09:00");
  });
  it("never puts two posts of the same channel on one day and caps a day at two posts", () => {
    const slots = scheduleCampaign({
      plan: plan([
        [5, "Instagram"],
        [5, "Instagram"],
        [5, "Facebook"],
        [5, "TikTok"],
      ]),
      startDate: "2026-10-01",
      days: 30,
      existing: [],
    });
    const days = slots.map((s) => s.day);
    expect(new Set(days.filter((d) => d === "2026-10-06")).size).toBe(1);
    expect(days.filter((d) => d === "2026-10-06")).toHaveLength(2);
    expect(slots.filter((s) => s.channel === "Instagram").map((s) => s.day)).toEqual(["2026-10-06", "2026-10-07"]);
  });
  it("ignores canceled posts and wraps around inside the window", () => {
    const slots = scheduleCampaign({
      plan: plan([[6, "Instagram"]]),
      startDate: "2026-10-01",
      days: 7,
      existing: [
        { id: "a", scheduledFor: "2026-10-07T10:00", status: "scheduled", channel: "Instagram" },
        { id: "b", scheduledFor: "2026-10-01T10:00", status: "canceled", channel: "Instagram" },
      ],
    });
    expect(slots[0].day).toBe("2026-10-01");
  });
  it("clamps offsets outside the window", () => {
    const slots = scheduleCampaign({ plan: plan([[99, "Instagram"], [-4, "Instagram"]]), startDate: "2026-10-01", days: 10, existing: [] });
    expect(slots.map((s) => s.day)).toEqual(["2026-10-01", "2026-10-10"]);
  });
});

describe("mock plan", () => {
  it("produces the cadence and only the requested channels, inside the window", () => {
    const p = mockCampaignPlan({ goal: "dobrar o delivery", channels: ["Instagram", "WhatsApp"], startDate: "2026-10-01", days: 30, postsPerWeek: 3, clientName: "Café Aurora", lang: "pt-BR" });
    expect(p.posts).toHaveLength(13);
    expect(p.weeks).toHaveLength(5);
    expect(new Set(p.posts.map((x) => x.channel))).toEqual(new Set(["Instagram", "WhatsApp"]));
    expect(p.posts.every((x) => x.dayOffset >= 0 && x.dayOffset <= 29)).toBe(true);
    expect(p.posts.every((x) => x.caption && x.hook && x.cta && x.imageBrief && x.hashtags.length > 0)).toBe(true);
    expect(p.theme).toContain("Café Aurora");
    const scheduled = scheduleCampaign({ plan: p, startDate: "2026-10-01", days: 30, existing: [] });
    expect(new Set(scheduled.map((s) => `${s.day}|${s.channel}`)).size).toBe(13);
  });
});
