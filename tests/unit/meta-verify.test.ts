import { afterEach, describe, expect, it } from "vitest";
import { META_NOT_CONFIRMED, META_TOKEN_REQUIRED, META_UNREACHABLE, verifyMetaAccount } from "../../lib/messaging/meta-verify";

const reply = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

describe("Meta account ownership check", () => {
  afterEach(() => {
    delete process.env.META_GRAPH_VERIFY;
  });

  it("accepts only when the token sees exactly that id", async () => {
    let seen: { url: string; auth: string } | null = null;
    const spy = (async (url: string, init?: RequestInit) => {
      seen = { url, auth: String((init?.headers as Record<string, string>).Authorization) };
      return new Response(JSON.stringify({ id: "123456" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await verifyMetaAccount("123456", "tok-a", spy)).toEqual({ ok: true });
    // token vai no cabeçalho, nunca na URL
    expect(seen!.url).not.toContain("tok-a");
    expect(seen!.auth).toBe("Bearer tok-a");

    expect(await verifyMetaAccount("123456", "tok-a", reply(200, { id: "999" }))).toEqual({ ok: false, status: 400, error: META_NOT_CONFIRMED });
    expect(await verifyMetaAccount("123456", "tok-a", reply(400, { error: {} }))).toEqual({ ok: false, status: 400, error: META_NOT_CONFIRMED });
    expect(await verifyMetaAccount("123456", "tok-a", reply(503, {}))).toEqual({ ok: false, status: 502, error: META_UNREACHABLE });
    const boom = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await verifyMetaAccount("123456", "tok-a", boom)).toEqual({ ok: false, status: 502, error: META_UNREACHABLE });
  });

  it("needs a token, rejects odd ids and skips empty ids", async () => {
    expect(await verifyMetaAccount("123456", "", reply(200, { id: "123456" }))).toEqual({ ok: false, status: 400, error: META_TOKEN_REQUIRED });
    expect(await verifyMetaAccount("12/../me", "tok", reply(200, { id: "12/../me" }))).toMatchObject({ ok: false, status: 400 });
    expect(await verifyMetaAccount("", "", reply(500, {}))).toEqual({ ok: true });
    process.env.META_GRAPH_VERIFY = "off";
    expect(await verifyMetaAccount("PN-1", "", reply(500, {}))).toEqual({ ok: true });
  });
});
