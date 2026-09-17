import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

test("brand voice guardian: rules per client, one-click check on a calendar post, rewrite in voice, cache, and the attendant reply", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (
    await page.request.post("/api/clients", {
      data: { name: "Café Aurora", industry: "cafeteria", tone: "acolhedor e bem-humorado", channels: ["Instagram", "WhatsApp"], country: "Brasil" },
    })
  ).json();

  // regras da voz na aba Briefing
  await page.goto(`/clients/${client.id}?tab=briefing`);
  const card = page.getByTestId("brand-voice-card");
  await expect(card).toBeVisible();
  await card.getByTestId("voice-banned").fill("barato, promoção relâmpago");
  await card.getByTestId("voice-required").fill("Café Aurora");
  await card.getByTestId("voice-max-hashtags").fill("3");
  await card.getByTestId("voice-max-emojis").fill("2");
  await card.getByTestId("voice-save").click();
  await expect(card.getByText("Aplicado ✓")).toBeVisible();
  const policy = await (await page.request.get(`/api/clients/${client.id}/brand-voice`)).json();
  expect(policy.policy.bannedTerms).toEqual(["barato", "promoção relâmpago"]);
  expect(policy.policy.maxHashtags).toBe(3);

  // post no calendário com problemas: termo proibido, gritaria, alegação, hashtags e emojis demais, sem CTA
  const bad = "Café mais BARATO da cidade!!! ☕🥐😀 #a #b #c #d";
  const post = await (
    await page.request.post("/api/scheduled-posts", {
      data: { clientId: client.id, title: "Promo do café", channel: "Instagram", caption: bad, hashtags: [], scheduledFor: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16), status: "draft" },
    })
  ).json();
  await page.goto("/calendar");
  await page.getByTestId("calendar-client").selectOption(client.id);
  await page.getByTestId("calendar-post").filter({ hasText: "Promo do café" }).click();
  const panel = page.getByTestId("post-panel");
  await expect(panel).toBeVisible();
  await panel.getByTestId("voice-check-run").click();
  const check = panel.getByTestId("voice-check");
  await expect(check).toHaveAttribute("data-verdict", "block", { timeout: 30_000 });
  const issues = panel.getByTestId("voice-issues");
  await expect(issues.locator('[data-code="banned_term"]')).toBeVisible();
  await expect(issues.locator('[data-code="too_many_hashtags"]')).toBeVisible();
  await expect(issues.locator('[data-code="too_many_emojis"]')).toBeVisible();
  await expect(issues.locator('[data-code="no_cta"]')).toBeVisible();
  await expect(issues.locator('[data-code="claim_needs_source"]')).toBeVisible();
  await expect(issues.locator('[data-code="missing_term"]')).toBeVisible();

  // reescrever no tom → a legenda muda e passa
  await panel.getByTestId("voice-rewrite").click();
  await expect(panel.getByTestId("post-caption")).not.toHaveValue(bad, { timeout: 30_000 });
  const rewritten = await panel.getByTestId("post-caption").inputValue();
  expect(rewritten).not.toMatch(/barato/i);
  expect(rewritten).toContain("Café Aurora");
  await panel.getByTestId("voice-check-run").click();
  await expect(check).toHaveAttribute("data-verdict", "ok", { timeout: 30_000 });
  await panel.getByTestId("post-caption-save").click();
  await expect(panel.getByTestId("post-caption-save")).toBeHidden();
  const saved = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  expect(saved.find((p: { id: string }) => p.id === post.id).caption).toBe(rewritten);

  // cache por conteúdo: a segunda checagem do mesmo texto vem do cache e não cobra
  const first = await (await page.request.post(`/api/clients/${client.id}/brand-voice/check`, { data: { text: bad, kind: "post" } })).json();
  expect(first.cached).toBe(true); // já checado pela UI
  const fresh = await (await page.request.post(`/api/clients/${client.id}/brand-voice/check`, { data: { text: "Pão quentinho às 7h. Vem tomar um café com a gente! #cafe", kind: "post" } })).json();
  expect(fresh.cached).toBe(false);
  expect(fresh.verdict).toBe("review"); // falta o termo obrigatório
  const again = await (await page.request.post(`/api/clients/${client.id}/brand-voice/check`, { data: { text: "Pão quentinho às 7h. Vem tomar um café com a gente! #cafe", kind: "post" } })).json();
  expect(again.cached).toBe(true);
  const billing = await (await page.request.get(`/api/billing`)).json().catch(() => null);
  void billing;
  const stats = await (await page.request.get(`/api/clients/${client.id}/brand-voice`)).json();
  expect(stats.stats.checks).toBe(3);
  expect(stats.stats.rewrites).toBe(1);
  expect((await page.request.post(`/api/clients/${client.id}/brand-voice/check`, { data: { text: "" } })).status()).toBe(400);

  // resposta do atendente em rascunho: checagem sem exigir CTA
  await page.request.post("/api/messaging/connections", { data: { channel: "whatsapp", mode: "session", apiToken: "", apiAccountId: "", sessionReady: true } });
  await page.request.put(`/api/clients/${client.id}/attendant`, { data: { mode: "draft" } });
  await page.request.post(`/api/clients/${client.id}/attendant/inbound`, { data: { fromAddress: "5511900000000", fromName: "Maria", body: "Vocês abrem no sábado?" } });
  await page.goto(`/clients/${client.id}?tab=attendant`);
  const draft = page.getByTestId("attendant-reply").filter({ has: page.getByTestId("reply-send") }).first();
  await draft.getByTestId("reply-text").fill("Oi Maria! O Café Aurora abre sábado das 8h às 14h. Te esperamos ☕");
  await draft.getByTestId("voice-check-run").click();
  await expect(draft.getByTestId("voice-check")).toHaveAttribute("data-verdict", "ok", { timeout: 30_000 });

  // outro cliente não checa nesta conta
  const other = await (await page.request.post("/api/clients", { data: { name: "Outra Marca" } })).json();
  await login(page, other.login.username, other.login.password);
  expect((await page.request.post(`/api/clients/${client.id}/brand-voice/check`, { data: { text: "oi" } })).status()).toBe(403);
});
