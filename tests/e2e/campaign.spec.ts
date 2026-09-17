import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("30-day campaign: plan + every post drafted into calendar gaps, review accepts/skips, calendar shows the drafts", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (
    await page.request.post("/api/clients", {
      data: { name: "Café Trinta", industry: "cafeteria", goals: "dobrar o delivery", channels: ["Instagram", "WhatsApp"], country: "Brasil" },
    })
  ).json();
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const startKey = localKey(start);
  // já existe um post de Instagram no primeiro dia: a campanha não pode colidir
  await page.request.post("/api/scheduled-posts", {
    data: { clientId: client.id, title: "Post que já existia", channel: "Instagram", caption: "oi", hashtags: [], scheduledFor: `${startKey}T15:00`, status: "scheduled" },
  });

  await page.goto(`/clients/${client.id}?tab=campaign30`);
  await expect(page.getByTestId("campaign-tab")).toBeVisible();
  await expect(page.getByTestId("campaign-goal")).toHaveValue("dobrar o delivery");
  await expect(page.getByTestId("campaign-channel").filter({ hasText: "Instagram" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("campaign-start").fill(startKey);
  await page.getByTestId("campaign-cadence").selectOption("3");
  await page.getByTestId("campaign-generate").click();
  const review = page.getByTestId("campaign-review");
  await expect(review).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("campaign-theme")).toContainText("Café Trinta");
  await expect(page.getByTestId("campaign-post")).toHaveCount(13);
  await expect(page.getByTestId("campaign-drafts")).toHaveText("13");

  // todos entraram como rascunho, nos canais pedidos, dentro da janela e sem colidir
  const posts = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  const drafts = posts.filter((p: { campaignId: string | null }) => p.campaignId);
  expect(drafts).toHaveLength(13);
  expect(drafts.every((p: { status: string }) => p.status === "draft")).toBe(true);
  expect(new Set(drafts.map((p: { channel: string }) => p.channel))).toEqual(new Set(["Instagram", "WhatsApp"]));
  expect(drafts.every((p: { format: string; hookType: string; imageBrief: string; caption: string }) => p.format && p.hookType && p.imageBrief && p.caption.length > 20)).toBe(true);
  const end = new Date(start.getTime() + 29 * 86400000);
  expect(drafts.every((p: { scheduledFor: string }) => p.scheduledFor.slice(0, 10) >= startKey && p.scheduledFor.slice(0, 10) <= localKey(end))).toBe(true);
  expect(drafts.some((p: { channel: string; scheduledFor: string }) => p.channel === "Instagram" && p.scheduledFor.startsWith(startKey))).toBe(false);
  const perChannelDay = new Set(drafts.map((p: { channel: string; scheduledFor: string }) => `${p.scheduledFor.slice(0, 10)}|${p.channel}`));
  expect(perChannelDay.size).toBe(13);

  // aceitar um, pular um, aceitar o resto
  const first = page.getByTestId("campaign-post").first();
  await first.getByTestId("campaign-accept").click();
  await expect(page.getByTestId("campaign-post").first()).toHaveAttribute("data-status", "scheduled");
  await page.getByTestId("campaign-post").nth(1).getByTestId("campaign-skip").click();
  await expect(page.getByTestId("campaign-post")).toHaveCount(12);
  await expect(page.getByTestId("campaign-drafts")).toHaveText("11");
  await page.getByTestId("campaign-accept-all").click();
  await expect(page.getByTestId("campaign-drafts")).toHaveText("0");
  await expect(review).toHaveAttribute("data-status", "done");
  const after = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  expect(after.filter((p: { campaignId: string | null }) => p.campaignId)).toHaveLength(12);
  expect(after.filter((p: { campaignId: string | null; status: string }) => p.campaignId && p.status === "scheduled")).toHaveLength(12);
  const list = await (await page.request.get(`/api/clients/${client.id}/campaigns`)).json();
  expect(list.campaigns[0]).toMatchObject({ status: "done", total: 12, drafts: 0, scheduled: 12 });

  // o calendário mostra os posts da campanha com os atributos
  await page.goto("/calendar");
  await page.getByTestId("calendar-client").selectOption(client.id);
  await page.getByTestId("view-week").click();
  const chips = page.getByTestId("calendar-post");
  await expect(chips.first()).toBeVisible();
  await chips.filter({ hasText: "Por que existimos" }).first().click();
  await expect(page.getByTestId("post-panel")).toContainText("campanha de 30 dias");
  await expect(page.getByTestId("post-image-brief")).toBeVisible();

  // marca gerenciada não gera sozinha; outro cliente não abre a campanha
  await login(page, client.login.username, client.login.password);
  expect((await page.request.post(`/api/clients/${client.id}/campaigns`, { data: { goal: "x" } })).status()).toBe(403);
  const other = await (await page.request.get(`/api/campaigns/${list.campaigns[0].id}`)).json();
  expect(other.campaign.id).toBe(list.campaigns[0].id);
});
