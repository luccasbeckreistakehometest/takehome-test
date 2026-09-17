import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Analytics próprio: visita com UTM no funil de agências → cadastro → funil
// do admin mostra 1 → 1 para agencia/ig. Sem cookie; robô não conta.
test("a visit with utm_source=ig that signs up shows in the admin funnel", async ({ page, browser }) => {
  const visitor = await browser.newContext();
  const tab = await visitor.newPage();
  const source = `ig${Date.now() % 100000}`;
  await tab.goto(`/para-agencias?utm_source=${source}&utm_campaign=teste`);
  await expect(tab.getByRole("link", { name: /começar|criar|agência/i }).first()).toBeVisible();
  await tab.waitForTimeout(300);
  await tab.locator('[data-track="cta_click"]').first().click();
  await expect(tab).toHaveURL(/\/criar-conta\?type=agency/);
  await tab.getByTestId("reg-name").fill("Agência Funil IG");
  await tab.getByTestId("reg-email").fill(`funil.${source}@example.com`);
  await tab.getByTestId("reg-password").fill("senha-forte-123");
  await tab.getByTestId("reg-terms").check();
  await tab.getByTestId("reg-submit").click();
  await expect(tab).not.toHaveURL(/\/criar-conta/, { timeout: 20_000 });
  const cookies = await visitor.cookies();
  expect(cookies.every((c) => c.name !== "marqa_visitor")).toBe(true);

  // coletor: sem cookie, robô ignorado, limites
  const anon = await browser.newContext();
  const beacon = await anon.request.post("/api/t", { data: JSON.stringify({ name: "view", path: "/", utm: { source: "direct-check" } }), headers: { "content-type": "text/plain" } });
  expect(beacon.status()).toBe(204);
  expect(beacon.headers()["set-cookie"]).toBeUndefined();
  const botBeacon = await anon.request.post("/api/t", {
    data: JSON.stringify({ name: "view", path: "/", utm: { source: `bot${source}` } }),
    headers: { "content-type": "text/plain", "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" },
  });
  expect(botBeacon.status()).toBe(204);
  const tooBig = await anon.request.post("/api/t", { data: JSON.stringify({ name: "view", path: "/", pad: "x".repeat(3000) }), headers: { "content-type": "text/plain" } });
  expect(tooBig.status()).toBe(413);
  const unknown = await anon.request.post("/api/t", { data: JSON.stringify({ name: "comprou_tudo", path: "/" }), headers: { "content-type": "text/plain" } });
  expect(unknown.status()).toBe(400);
  const notPublic = await anon.request.post("/api/t", { data: JSON.stringify({ name: "view", path: "/admin" }), headers: { "content-type": "text/plain" } });
  expect(notPublic.status()).toBe(400);
  expect((await anon.request.get("/api/admin/analytics")).status()).toBe(401);
  await anon.close();

  // admin: funil agencia/ig
  await login(page, "admin");
  const report = await (await page.request.get(`/api/admin/analytics?days=7&audience=agencia&source=${source}`)).json();
  const count = (step: string) => report.funnel.find((r: { step: string }) => r.step === step).count;
  expect(count("view")).toBe(1);
  expect(count("cta_click")).toBe(1);
  expect(count("signup_started")).toBe(1);
  expect(count("signup_completed")).toBe(1);
  expect(report.signups.some((s: { utm: { source: string } }) => s.utm.source === source)).toBe(true);
  const botReport = await (await page.request.get(`/api/admin/analytics?days=7&source=bot${source}`)).json();
  expect(botReport.funnel[0].count).toBe(0);

  await page.goto(`/admin/analytics?days=7&audience=agencia&source=${source}`);
  await expect(page.locator('[data-testid="analytics-funnel"] [data-step="signup_completed"]')).toHaveAttribute("data-count", "1");
  await page.getByTestId("utm-campaign").fill("black friday");
  await expect(page.getByTestId("utm-url")).toContainText("utm_campaign=black+friday");
  const csv = await page.request.get("/api/admin/analytics?format=csv&days=7");
  expect(await csv.text()).toContain("dia;publico;origem;passo;total");

  // agência não vê o funil da plataforma
  await login(page, "agencia");
  expect((await page.request.get("/api/admin/analytics")).status()).toBe(403);
  await visitor.close();
});
