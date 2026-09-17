import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// Agendador x aprovação por link: post esperando o cliente não vai ao ar;
// falha de publicação para depois de algumas tentativas; carrossel publica
// com os endereços da versão atual dos slides.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-sched-"));
process.env.AUTH_SECRET = "unit-only-secret-for-signed-media-0123456789";
process.env.APP_URL = "https://marqa.test";
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { db, createClient, getClient, updateClient } = await import("../../lib/db");
const agencies = await import("../../lib/agencies");
const market = await import("../../lib/marketplace-db");
const links = await import("../../lib/approval-links-db");
const scheduler = await import("../../lib/scheduler");
const messaging = await import("../../lib/messaging-db");
const carousels = await import("../../lib/carousels-db");
const media = await import("../../lib/carousel-media");
const sign = await import("../../lib/media-sign");
const { mockCarousel } = await import("../../lib/carousel-rules");

const agencyId = agencies.createAgency({ name: "Agência Agenda", ownerUserId: null }).id;
const client = createClient(
  {
    name: "Café Agenda",
    industry: "",
    description: "",
    audience: "",
    tone: "",
    goals: "",
    budget: "",
    channels: [],
    differentials: "",
    competitors: "",
    brandColors: "",
    website: "",
    instagram: "",
    notes: "",
    capabilities: "",
    language: "pt-BR",
    source: "agency",
    country: "Brasil",
    selfServe: false,
  },
  agencyId
);
const past = () => new Date(Date.now() - 60_000).toISOString().slice(0, 16);
const post = (title: string, channel = "Blog") =>
  market.createScheduledPost({ clientId: client.id, title, channel, caption: "legenda", hashtags: [], scheduledFor: past(), status: "scheduled" });
const status = (id: string) => market.getScheduledPost(id)!;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scheduler and approval links", () => {
  it("never publishes a post that waits for the client, and publishes it once approved", async () => {
    const waiting = post("Esperando o cliente");
    const free = post("Sem link");
    const created = links.createApprovalLink({ clientId: client.id, createdBy: "agencia", items: [{ kind: "post", id: waiting.id }] });
    if (!created.ok) throw new Error(created.error);
    expect(status(waiting.id).clientApproval).toBe("pending");

    await scheduler.publishDuePosts();
    expect(status(free.id).status).toBe("published");
    expect(status(waiting.id).status).toBe("scheduled");
    expect(links.linkPageData(created.link.token)?.items[0]).toMatchObject({ id: waiting.id, decision: "pending" });

    const decided = links.decideViaLink(created.link.token, { kind: "post", id: waiting.id }, { decision: "approved", note: "", approver: "Ana" });
    expect(decided.ok).toBe(true);
    await scheduler.publishDuePosts();
    expect(status(waiting.id).status).toBe("published");

    // depois de publicado, o link não aceita mais "pedir ajuste"
    const late = links.decideViaLink(created.link.token, { kind: "post", id: waiting.id }, { decision: "changes_requested", note: "trocar a foto", approver: "" });
    expect(late).toMatchObject({ ok: false, status: 409 });
    expect(status(waiting.id).status).toBe("published");
  });

  it("holds a post with a change request even if the agency schedules it, until the agency releases it", async () => {
    const p = post("Com ajuste");
    const created = links.createApprovalLink({ clientId: client.id, createdBy: "agencia", items: [{ kind: "post", id: p.id }] });
    if (!created.ok) throw new Error(created.error);
    links.decideViaLink(created.link.token, { kind: "post", id: p.id }, { decision: "changes_requested", note: "outra legenda", approver: "" });
    expect(status(p.id)).toMatchObject({ status: "draft", clientApproval: "changes_requested" });
    market.updateScheduledPost(p.id, { status: "scheduled", caption: "legenda nova" });
    await scheduler.publishDuePosts();
    expect(status(p.id).status).toBe("scheduled");
    market.releasePostApproval(p.id);
    await scheduler.publishDuePosts();
    expect(status(p.id).status).toBe("published");
  });

  it("hides the items of a closed link", () => {
    const p = post("Link fechado");
    const created = links.createApprovalLink({ clientId: client.id, createdBy: "agencia", items: [{ kind: "post", id: p.id }] });
    if (!created.ok) throw new Error(created.error);
    links.closeApprovalLink(created.link.id);
    const data = links.linkPageData(created.link.token)!;
    expect(data.state).toBe("closed");
    expect(data.items).toEqual([]);
  });

  it("stops retrying a failing publish after the limit and starts over when the agency edits the post", async () => {
    messaging.saveConnection({ agencyId, channel: "instagram", mode: "api", apiToken: "tok", apiAccountId: "17840000" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid image URL" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = post("Falha no Instagram", "Instagram");
    market.setPostMedia(p.id, ["https://marqa.test/x.png"]);
    for (let i = 0; i < scheduler.MAX_PUBLISH_ATTEMPTS + 2; i++) await scheduler.publishDuePosts();
    const failed = status(p.id);
    expect(failed.status).toBe("scheduled");
    expect(failed.publishAttempts).toBe(scheduler.MAX_PUBLISH_ATTEMPTS);
    expect(failed.publishError).toContain("Invalid image URL");
    expect(fetchMock).toHaveBeenCalledTimes(scheduler.MAX_PUBLISH_ATTEMPTS);
    expect(scheduler.duePosts().some((d) => d.id === p.id)).toBe(false);
    const alert = db.prepare("SELECT text FROM activities WHERE agencyId = ? AND text LIKE 'Não conseguimos publicar%'").get(agencyId) as { text: string } | undefined;
    expect(alert?.text).toContain("Falha no Instagram");
    market.updateScheduledPost(p.id, { scheduledFor: past() });
    expect(status(p.id).publishAttempts).toBe(0);
    expect(scheduler.duePosts().some((d) => d.id === p.id)).toBe(true);
    db.prepare("DELETE FROM channel_connections WHERE agencyId = ?").run(agencyId);
    market.updateScheduledPost(p.id, { status: "canceled" });
  });

  it("re-signs carousel slide URLs at publish time after the brand changes", () => {
    const p = post("Carrossel", "Instagram");
    const carousel = carousels.createCarousel({ clientId: client.id, postId: p.id, topic: "cardápio", goal: "", template: "bold", content: mockCarousel("cardápio", "pt-BR", 4), source: "manual" });
    const slides = carousel.content.slides.length;
    const before = media.refreshPostCarouselMedia(p.id)!;
    expect(before.length).toBeGreaterThanOrEqual(2);
    expect(before).toHaveLength(slides);
    const current = getClient(client.id)!;
    updateClient(client.id, { ...current, name: "Café Agenda Novo" });
    const after = media.refreshPostCarouselMedia(p.id)!;
    expect(after).toHaveLength(slides);
    expect(after[0]).not.toBe(before[0]);
    expect(market.postMedia(status(p.id))).toEqual(after);
    // a assinatura nova confere com o hash da versão atual
    const url = new URL(after[0]);
    const [, , , id, file] = url.pathname.split("/");
    const [index, hash] = file.replace(/\.png$/, "").split("-");
    expect(id).toBe(carousel.id);
    expect(sign.verifyMedia(carousel.id, Number(index), hash, url.searchParams.get("sig"))).toBe(true);
    expect(media.refreshPostCarouselMedia(post("Sem carrossel").id)).toBeNull();
  });
});
