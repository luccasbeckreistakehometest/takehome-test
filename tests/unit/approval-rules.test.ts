import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPROVAL_RULES,
  guessChannel,
  isSocialPiece,
  nextPostSlot,
  planApprovalActions,
  sanitizeApprovalRules,
} from "@/lib/approval-rules";

const socialProject = { title: "Posts do feed de setembro", brief: "3 posts para o Instagram", skillsNeeded: [] as string[] };
const photoProject = { title: "Fotos do cardápio", brief: "Ensaio de produto para o site", skillsNeeded: ["Fotografia de produto"] };
const image = { title: "Peça 1", mime: "image/png" };
const client = { name: "Café Aurora", channels: ["Instagram", "Google Ads"] };

describe("isSocialPiece", () => {
  it("recognises social work by title, brief or skill", () => {
    expect(isSocialPiece(image, socialProject)).toBe(true);
    expect(isSocialPiece({ title: "Reels da promoção", mime: "video/mp4" }, photoProject)).toBe(true);
    expect(isSocialPiece(image, { ...photoProject, skillsNeeded: ["Social media design"] })).toBe(true);
  });
  it("ignores non-social projects and non-media files", () => {
    expect(isSocialPiece(image, photoProject)).toBe(false);
    expect(isSocialPiece({ title: "Post", mime: "application/pdf" }, socialProject)).toBe(false);
  });
  it("matches whole words only (no false positive on 'postal')", () => {
    expect(isSocialPiece(image, { title: "Cartão postal", brief: "", skillsNeeded: [] })).toBe(false);
  });
});

describe("guessChannel", () => {
  it("prefers the channel named in the text, then the briefing, then Instagram", () => {
    expect(guessChannel(["vídeo para o TikTok"], ["Instagram"])).toBe("TikTok");
    expect(guessChannel(["carrossel de dicas"], ["Facebook"])).toBe("Instagram");
    expect(guessChannel(["peça"], ["Google Ads", "LinkedIn"])).toBe("LinkedIn");
    expect(guessChannel(["peça"], ["E-mail"])).toBe("Instagram");
  });
});

describe("nextPostSlot", () => {
  it("returns a datetime-local string N days later at the given hour", () => {
    const slot = nextPostSlot(new Date(2026, 8, 17, 15, 42), 2, 10);
    expect(slot).toBe("2026-09-19T10:00");
  });
  it("clamps odd inputs", () => {
    expect(nextPostSlot(new Date(2026, 8, 30, 8, 0), 1, 27)).toBe("2026-10-01T23:00");
  });
});

describe("planApprovalActions", () => {
  const base = {
    deliverable: image,
    project: socialProject,
    client,
    rules: { ...DEFAULT_APPROVAL_RULES, notifyPhone: "5511999999999" },
    link: "https://app.test/clients/1?project=2",
    now: new Date(2026, 8, 17, 9, 0),
  };
  it("client approval of a social piece → post draft + WhatsApp when connected", () => {
    const actions = planApprovalActions({ ...base, actor: "client", whatsappConnected: true });
    expect(actions.map((a) => a.type)).toEqual(["post_draft", "whatsapp"]);
    const draft = actions[0];
    if (draft.type !== "post_draft") throw new Error("expected draft");
    expect(draft.channel).toBe("Instagram");
    expect(draft.scheduledFor).toBe("2026-09-19T10:00");
    const wa = actions[1];
    if (wa.type !== "whatsapp") throw new Error("expected whatsapp");
    expect(wa.to).toBe("5511999999999");
    expect(wa.body).toContain("Café Aurora aprovou");
    expect(wa.body).toContain("rascunho de post");
    expect(wa.body).toContain(base.link);
  });
  it("falls back to an in-app notice with the reason", () => {
    expect(planApprovalActions({ ...base, actor: "client", whatsappConnected: false })).toContainEqual({ type: "activity", reason: "not_connected" });
    expect(planApprovalActions({ ...base, actor: "client", whatsappConnected: true, rules: { ...base.rules, notifyPhone: "" } })).toContainEqual({ type: "activity", reason: "no_phone" });
    expect(planApprovalActions({ ...base, actor: "client", whatsappConnected: true, rules: { ...base.rules, notifyWhatsapp: false } })).toContainEqual({ type: "activity", reason: "whatsapp_off" });
  });
  it("agency approving on behalf never pings the agency's own WhatsApp", () => {
    const actions = planApprovalActions({ ...base, actor: "agency", whatsappConnected: true });
    expect(actions.map((a) => a.type)).toEqual(["post_draft", "activity"]);
  });
  it("respects the auto-post toggle and non-social pieces", () => {
    expect(planApprovalActions({ ...base, actor: "client", whatsappConnected: false, rules: { ...base.rules, autoPostDraft: false } }).map((a) => a.type)).toEqual(["activity"]);
    expect(planApprovalActions({ ...base, actor: "client", whatsappConnected: false, project: photoProject }).map((a) => a.type)).toEqual(["activity"]);
  });
});

describe("sanitizeApprovalRules", () => {
  it("normalises phone digits and clamps numbers", () => {
    expect(sanitizeApprovalRules({ notifyPhone: "+55 (11) 99999-9999", postDelayDays: 99, postHour: -3 })).toEqual({
      autoPostDraft: true,
      notifyWhatsapp: true,
      notifyPhone: "5511999999999",
      postDelayDays: 30,
      postHour: 0,
    });
    expect(sanitizeApprovalRules({ postDelayDays: Number.NaN }).postDelayDays).toBe(DEFAULT_APPROVAL_RULES.postDelayDays);
  });
});
