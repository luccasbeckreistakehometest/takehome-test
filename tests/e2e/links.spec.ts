import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

// Links rastreáveis + link na bio: UTM automático, clique contado (robô não),
// sem redirecionamento aberto, bio com as cores do cliente.
test("tracked link redirects with UTM, counts clicks and feeds the bio page", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Bio Floricultura", brandColors: "#b0305a", channels: ["Instagram"] } })).json();
  const month = new Date().toISOString().slice(0, 10);
  const post = await (
    await page.request.post("/api/scheduled-posts", {
      data: { clientId: client.id, title: "Buquê de setembro", channel: "Instagram", caption: "Flores da estação", scheduledFor: `${month}T10:00`, status: "scheduled", format: "Reels" },
    })
  ).json();

  const created = await page.request.post(`/api/clients/${client.id}/links`, {
    data: { destUrl: "https://loja.example.com/produto?cor=azul", postId: post.id, channel: "Instagram", label: "Buquê" },
  });
  expect(created.status()).toBe(201);
  const link = await created.json();
  expect(link.code).toMatch(/^[A-Za-z0-9]{7}$/);
  expect((await page.request.post(`/api/clients/${client.id}/links`, { data: { destUrl: "javascript:alert(1)" } })).status()).toBe(400);
  expect((await page.request.post(`/api/clients/${client.id}/links`, { data: { destUrl: "data:text/html,oi" } })).status()).toBe(400);

  const guest = await browser.newContext();
  const hit = await guest.request.get(`/l/${link.code}?to=https://evil.example.com`, { maxRedirects: 0 });
  expect(hit.status()).toBe(302);
  const location = new URL(hit.headers()["location"]);
  expect(location.host).toBe("loja.example.com");
  expect(location.searchParams.get("cor")).toBe("azul");
  expect(location.searchParams.get("utm_source")).toBe("instagram");
  expect(location.searchParams.get("utm_medium")).toBe("social");
  expect(location.searchParams.get("utm_content")).toBe(post.id);
  expect(hit.headers()["set-cookie"]).toBeUndefined();
  const bot = await guest.request.get(`/l/${link.code}`, { maxRedirects: 0, headers: { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } });
  expect(bot.status()).toBe(302);
  expect((await guest.request.get("/l/zzzzzzz", { maxRedirects: 0 })).status()).toBe(404);
  const stats = await (await page.request.get(`/api/clients/${client.id}/links`)).json();
  expect(stats.links.find((l: { code: string }) => l.code === link.code).clicks).toBe(1);

  // o post publicado com link entra na leitura de cliques
  await page.request.patch(`/api/scheduled-posts/${post.id}`, { data: { status: "published" } });
  const learnings = await (await page.request.get(`/api/clients/${client.id}/learnings`)).json();
  expect(learnings.clicks.postsWithLinks).toBe(1);
  expect(learnings.clicks.byFormat[0]).toMatchObject({ key: "Reels", clicks: 1 });

  // bio pela tela: link novo vira botão, publica
  await page.goto(`/clients/${client.id}?tab=bio`);
  await page.getByTestId("link-dest").fill("https://wa.me/5511999990000");
  await page.getByTestId("link-label").fill("Pedir no WhatsApp");
  await page.getByTestId("link-create").click();
  await expect(page.getByTestId("link-row")).toHaveCount(2);
  await expect(page.getByTestId("bio-buttons").locator("li")).toHaveCount(1);
  await page.getByTestId("bio-published").check();
  await page.getByTestId("bio-save").click();
  const slug = await page.getByTestId("bio-slug").inputValue();
  expect(slug).toBe("bio-floricultura");

  const bioPage = await guest.newPage();
  await bioPage.goto(`/b/${slug}`);
  await expect(bioPage.getByTestId("bio-page")).toHaveAttribute("data-primary", "#b0305a");
  await expect(bioPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(bioPage.getByTestId("bio-button")).toHaveText("Pedir no WhatsApp");
  await expect(bioPage.getByTestId("bio-button")).toHaveAttribute("href", /^\/l\/[A-Za-z0-9]{7}$/);
  await expect(bioPage.getByTestId("bio-tile").first()).toHaveAttribute("href", `/l/${link.code}`);
  // página não publicada = 404
  expect((await guest.request.get("/b/nao-existe")).status()).toBe(404);

  // dashboard e calendário mostram os cliques
  await page.goto(`/clients/${client.id}`);
  await expect(page.getByTestId("clicks-total")).toHaveText("1");
  await guest.close();
});

test("another tenant's brand cannot read or create links", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const a = await (await page.request.post("/api/clients", { data: { name: "Links A", channels: [] } })).json();
  const b = await (await page.request.post("/api/clients", { data: { name: "Links B", channels: [] } })).json();
  await login(page, b.login.username, b.login.password);
  expect((await page.request.get(`/api/clients/${a.id}/links`)).status()).toBe(403);
  expect((await page.request.post(`/api/clients/${a.id}/links`, { data: { destUrl: "https://x.example.com" } })).status()).toBe(403);
  expect((await page.request.put(`/api/clients/${a.id}/bio`, { data: { published: true } })).status()).toBe(403);
});
