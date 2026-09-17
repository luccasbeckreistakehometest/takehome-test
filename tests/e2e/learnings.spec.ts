import { test, expect, type APIRequestContext } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

// Mês corrente em UTC, igual ao padrão do card; dias 1..27 sempre existem.
const month = new Date().toISOString().slice(0, 7);
const day = (d: number) => `${month}-${String(d).padStart(2, "0")}`;

async function publishedPost(request: APIRequestContext, clientId: string, d: number, format: string, hookType: string, hour: string) {
  const post = await (
    await request.post("/api/scheduled-posts", {
      data: { clientId, title: `${format} dia ${d}`, channel: "Instagram", caption: "", hashtags: [], scheduledFor: `${day(d)}T${hour}`, status: "scheduled", format, hookType },
    })
  ).json();
  const patched = await request.patch(`/api/scheduled-posts/${post.id}`, { data: { status: "published" } });
  expect(patched.status()).toBe(200);
}

test("what works for this client: deterministic best/worst from posts × daily sales, AI reading, thin-data message, monthly report", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Aprendeco", industry: "confeitaria", channels: ["Instagram"] } })).json();
  // Reels (bastidores, 19h) nos dias 1, 8, 15, 22; Feed (oferta, 9h) nos dias 4, 11, 18, 25
  const reels = [1, 8, 15, 22];
  const feed = [4, 11, 18, 25];
  for (const d of reels) await publishedPost(page.request, client.id, d, "Reels", "bastidores", "19:00");
  for (const d of feed) await publishedPost(page.request, client.id, d, "Feed", "oferta", "09:00");
  // vendas por dia: R$ 1.000/dia nos 3 dias após cada Reels, R$ 100/dia após cada Feed
  const rows = [
    ...reels.flatMap((d) => [0, 1, 2].map((i) => ({ source: "Loja", periodStart: day(d + i), periodEnd: day(d + i), revenue: 1000, units: 10 }))),
    ...feed.flatMap((d) => [0, 1, 2].map((i) => ({ source: "Loja", periodStart: day(d + i), periodEnd: day(d + i), revenue: 100, units: 1 }))),
  ];
  expect((await page.request.post(`/api/clients/${client.id}/sales`, { data: { rows } })).status()).toBe(201);
  const api = await (await page.request.get(`/api/clients/${client.id}/learnings?month=${month}`)).json();
  expect(api.learnings).toMatchObject({ hasEnoughData: true, metric: "revenue", postsPublished: 8, postsAnalyzed: 8, baseline: 550 });
  expect(api.learnings.best.format).toMatchObject({ key: "Reels", liftPct: 82, posts: 4 });
  expect(api.learnings.best.hour.key).toBe("evening");
  expect(api.learnings.best.hookType.key).toBe("bastidores");
  expect(api.learnings.best.weekday.posts).toBe(4);
  expect(api.learnings.worst).toMatchObject({ dimension: "format", key: "Feed", liftPct: -82 });
  expect(api.reading).toBeNull();

  // card no Dashboard do cliente
  await page.goto(`/clients/${client.id}`);
  const card = page.getByTestId("learnings-card");
  await expect(card.getByTestId("learnings-ready")).toBeVisible();
  await expect(card.locator('[data-testid="learning-best"][data-dimension="format"]')).toContainText("Reels");
  await expect(card.locator('[data-testid="learning-best"][data-dimension="format"]')).toContainText("+82%");
  await expect(card.locator('[data-testid="learning-best"][data-dimension="hour"]')).toContainText("noite");
  await expect(card.getByTestId("learning-worst")).toContainText("Feed");
  // leitura de 3 linhas (fixture) sob demanda
  await card.getByTestId("learnings-generate").click();
  const reading = card.getByTestId("learnings-reading");
  await expect(reading).toBeVisible({ timeout: 30_000 });
  await expect(reading.locator("li")).toHaveCount(3);
  await expect(reading).toContainText("Reels");
  await expect(card.getByTestId("learnings-generate")).toBeHidden();
  // mesma leitura para os mesmos números: cache, sem nova cobrança
  const again = await (await page.request.post(`/api/clients/${client.id}/learnings`, { data: { month } })).json();
  expect(again.cached).toBe(true);
  // números mudam → a leitura fica marcada como velha
  await publishedPost(page.request, client.id, 26, "Reels", "bastidores", "19:00");
  const stale = await (await page.request.get(`/api/clients/${client.id}/learnings?month=${month}`)).json();
  expect(stale.readingStale).toBe(true);
  await page.reload();
  await expect(page.getByTestId("learnings-card").getByTestId("learnings-generate")).toContainText("Atualizar leitura");
  await page.getByTestId("learnings-card").getByTestId("learnings-generate").click();
  await expect(page.getByTestId("learnings-card").getByTestId("learnings-generate")).toBeHidden({ timeout: 30_000 });

  // relatório mensal traz os números e a leitura atual
  const report = await (await page.request.get(`/api/clients/${client.id}/report?month=${month}`)).json();
  expect(report.data.learnings.best.format.key).toBe("Reels");
  expect(report.data.learningsReading.lines).toHaveLength(3);
  await page.goto(`/clients/${client.id}/report`);
  await expect(page.getByTestId("report-learnings")).toContainText("Reels");
  await expect(page.getByTestId("report-learnings").getByTestId("learnings-reading")).toBeVisible();

  // cliente com pouco dado: a tela diz o que falta e a IA não é chamada
  const thin = await (await page.request.post("/api/clients", { data: { name: "Poucoco", industry: "moda" } })).json();
  await publishedPost(page.request, thin.id, 2, "Reels", "dor", "10:00");
  await publishedPost(page.request, thin.id, 5, "Feed", "dor", "10:00");
  await page.goto(`/clients/${thin.id}`);
  const thinCard = page.getByTestId("learnings-card");
  await expect(thinCard.getByTestId("learnings-thin")).toHaveAttribute("data-reason", "few_posts");
  await expect(thinCard.getByTestId("learnings-thin")).toContainText("pelo menos 4");
  await expect(thinCard.getByTestId("learnings-generate")).toHaveCount(0);
  const refused = await page.request.post(`/api/clients/${thin.id}/learnings`, { data: { month } });
  expect(refused.status()).toBe(422);
  expect((await refused.json()).reason).toBe("few_posts");
  // 4 posts mas nenhum resultado diário registrado → "no_outcomes" (sync de 30 dias ignorado: ver teste unitário)
  for (const d of [8, 12]) await publishedPost(page.request, thin.id, d, "Carrossel", "dado", "12:00");
  const noOutcomes = await (await page.request.get(`/api/clients/${thin.id}/learnings?month=${month}`)).json();
  expect(noOutcomes.learnings.reason).toBe("no_outcomes");
  expect((await page.request.get(`/api/clients/${thin.id}/learnings?month=2026-13`)).status()).toBe(400);

  // a marca gerenciada vê, mas não gera a leitura; outra marca não vê
  await login(page, client.login.username, client.login.password);
  expect((await page.request.get(`/api/clients/${client.id}/learnings?month=${month}`)).status()).toBe(200);
  expect((await page.request.post(`/api/clients/${client.id}/learnings`, { data: { month } })).status()).toBe(403);
  expect((await page.request.get(`/api/clients/${thin.id}/learnings?month=${month}`)).status()).toBe(403);
});

test("sales import: a CSV batch stores every row (it used to store one empty sale)", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Lotesco" } })).json();
  const batch = await page.request.post(`/api/clients/${client.id}/sales`, {
    data: { rows: [{ source: "CSV", periodStart: day(2), periodEnd: day(2), revenue: 120, units: 2 }, { source: "CSV", periodStart: day(3), periodEnd: day(3), revenue: 80, units: 1 }] },
  });
  expect(batch.status()).toBe(201);
  expect((await batch.json()).created).toBe(2);
  const single = await page.request.post(`/api/clients/${client.id}/sales`, { data: { source: "Manual", periodStart: day(4), periodEnd: day(4), revenue: 50, units: 1 } });
  expect((await single.json()).created).toBe(1);
  const list = await (await page.request.get(`/api/clients/${client.id}/sales`)).json();
  expect(list.totals).toMatchObject({ revenue: 250, units: 4, entries: 3 });
  // uma marca não mexe nas vendas de outra
  const other = await (await page.request.post("/api/clients", { data: { name: "Outraco" } })).json();
  await login(page, other.login.username, other.login.password);
  expect((await page.request.get(`/api/clients/${client.id}/sales`)).status()).toBe(403);
  expect((await page.request.delete(`/api/clients/${other.id}/sales?saleId=${list.sales[0].id}`)).status()).toBe(200);
  await login(page, "agencia");
  expect((await (await page.request.get(`/api/clients/${client.id}/sales`)).json()).totals.entries).toBe(3);
});
