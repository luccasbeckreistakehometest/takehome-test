import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { createRateLimiter, clientIp } from "../../lib/rate-limit";
import { signSession, verifySession } from "../../lib/auth-shared";
import { isPublicApi, portalApiAllowed } from "../../middleware";
import { withQuery } from "../../lib/url";
import { estimateCostUsd } from "../../lib/ai-spend-cost";
import { mockFromSchema } from "../../lib/ai-schema-mock";

describe("rate limiter", () => {
  it("blocks after the limit within the window and frees after it", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check("ip", 0).ok).toBe(true);
    expect(limiter.check("ip", 1).ok).toBe(true);
    const blocked = limiter.check("ip", 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(limiter.check("ip", 60_001).ok).toBe(true);
  });

  it("uses the first X-Forwarded-For entry (set by Caddy)", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.9");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("session tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("expire and reject tampering", async () => {
    const now = Date.now();
    const token = await signSession({ userId: "u1", role: "client", refId: "c1", name: "A", sv: 3 }, now);
    const payload = await verifySession(token, now);
    expect(payload).toMatchObject({ userId: "u1", role: "client", sv: 3 });
    expect(await verifySession(token, now + 31 * 86_400_000)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, role: "admin" })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`, now)).toBeNull();
    expect(await verifySession(`${body}.${sig}x`, now)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("refuse to sign or verify in production without a strong AUTH_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "short");
    await expect(signSession({ userId: "u", role: "admin", refId: null, name: "x" })).rejects.toThrow(/AUTH_SECRET/);
    expect(await verifySession("a.b")).toBeNull();
  });
});

describe("middleware policy", () => {
  it("keeps only the documented public API routes open", () => {
    expect(isPublicApi("/api/health", "GET")).toBe(true);
    expect(isPublicApi("/api/contact", "POST")).toBe(true);
    expect(isPublicApi("/api/webhooks/meta", "POST")).toBe(true);
    expect(isPublicApi("/api/settings", "GET")).toBe(false);
    expect(isPublicApi("/api/invites", "GET")).toBe(false);
    expect(isPublicApi("/api/billing/checkout", "POST")).toBe(false);
  });

  it("denies clients and professionals outside their portal routes", () => {
    const client = { role: "client" as const, refId: "c1" };
    const pro = { role: "professional" as const, refId: "p1" };
    for (const path of ["/api/clients", "/api/invites", "/api/messaging/send", "/api/insights", "/api/prospects", "/api/assistant", "/api/billing/enforce", "/api/admin/overview"]) {
      expect(portalApiAllowed(client, path)).toBe(false);
      expect(portalApiAllowed(pro, path)).toBe(false);
    }
    expect(portalApiAllowed(client, "/api/clients/c1/report")).toBe(true);
    expect(portalApiAllowed(client, "/api/clients/c2/report")).toBe(false);
    expect(portalApiAllowed(client, "/api/generate")).toBe(true);
    expect(portalApiAllowed(pro, "/api/generate")).toBe(false);
    expect(portalApiAllowed(pro, "/api/professionals/p1/assets")).toBe(true);
    expect(portalApiAllowed(pro, "/api/professionals/p2")).toBe(false);
    expect(portalApiAllowed(pro, "/api/projects/x/applications")).toBe(true);
    expect(portalApiAllowed(pro, "/api/billing/checkout")).toBe(true);
    expect(portalApiAllowed({ role: "agency", refId: null }, "/api/clients")).toBe(true);
  });
});

describe("helpers", () => {
  it("joins query strings without a second '?'", () => {
    expect(withQuery("/portal/client/1?welcome=1&choose=1", { welcome: "1" })).toBe("/portal/client/1?welcome=1&choose=1");
    expect(withQuery("/", { welcome: "1" })).toBe("/?welcome=1");
    expect(withQuery("/plans", { plan: "client_pro", period: "annual" })).toBe("/plans?plan=client_pro&period=annual");
  });

  it("estimates Claude cost from usage", () => {
    const cost = estimateCostUsd("claude-sonnet-5", {
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      server_tool_use: { web_search_requests: 3 },
    });
    expect(cost).toBeCloseTo(2 + 1 + 0.03, 5);
    expect(estimateCostUsd("unknown-model", { output_tokens: 1_000_000 })).toBe(25);
  });

  it("builds schema-shaped fixtures for AI_MOCK", () => {
    const value = mockFromSchema({
      type: "object",
      properties: {
        title: { type: "string" },
        score: { type: "integer" },
        tags: { type: "array", items: { type: "string" } },
        tone: { type: "string", enum: ["warm", "formal"] },
      },
    }) as { title: string; score: number; tags: string[]; tone: string };
    expect(typeof value.title).toBe("string");
    expect(value.score).toBe(3);
    expect(value.tags).toHaveLength(2);
    expect(value.tone).toBe("warm");
  });

  it("verifies Meta webhook signatures", async () => {
    const { verifyMetaSignature, metaVerifyToken } = await import("../../lib/webhook-auth-pure");
    const body = JSON.stringify({ entry: [] });
    const sig = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, sig, "app-secret")).toBe(true);
    expect(verifyMetaSignature(body, sig, "other")).toBe(false);
    expect(verifyMetaSignature(body, null, "app-secret")).toBe(false);
    expect(verifyMetaSignature(body, sig, "")).toBe(false);
    vi.stubEnv("META_VERIFY_TOKEN", "agencyhub-verify");
    expect(metaVerifyToken()).toBeNull();
    vi.stubEnv("META_VERIFY_TOKEN", "a-long-random-token-123");
    expect(metaVerifyToken()).toBe("a-long-random-token-123");
    vi.unstubAllEnvs();
  });
});
