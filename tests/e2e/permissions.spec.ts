import { test, expect, type APIRequestContext } from "@playwright/test";
import { login, seedClientWithDelivery, signupViaApi, skipOnboarding } from "./helpers";

// Marca e profissional não alcançam rotas da agência nem da plataforma.
async function expectForbidden(request: APIRequestContext, label: string) {
  const calls: [string, () => Promise<{ status(): number }>][] = [
    ["PUT settings", () => request.put("/api/settings", { data: { agencyName: "Hack", accentColor: "#000000", aiMode: "premium", anthropicApiKey: "clear" } })],
    ["GET clients", () => request.get("/api/clients")],
    ["POST clients", () => request.post("/api/clients", { data: { name: "X" } })],
    ["GET invites", () => request.get("/api/invites")],
    ["POST invites", () => request.post("/api/invites", { data: { role: "agency" } })],
    ["POST enforce", () => request.post("/api/billing/enforce", { data: { on: false } })],
    ["GET professionals", () => request.get("/api/professionals")],
    ["POST messaging send", () => request.post("/api/messaging/send")],
    ["POST messaging draft", () => request.post("/api/messaging/draft", { data: { channel: "whatsapp", goal: "oi" } })],
    ["GET messaging connections", () => request.get("/api/messaging/connections")],
    ["POST ideas", () => request.post("/api/ideas", { data: { audience: "agency" } })],
    ["POST prospects", () => request.post("/api/prospects", { data: { niche: "café", region: "SP" } })],
    ["POST assistant", () => request.post("/api/assistant", { data: { messages: [{ role: "user", content: "oi" }] } })],
    ["GET admin overview", () => request.get("/api/admin/overview")],
    ["GET admin users", () => request.get("/api/admin/users")],
    ["GET insights", () => request.get("/api/insights")],
    ["GET search", () => request.get("/api/search?q=a")],
  ];
  for (const [name, call] of calls) {
    const response = await call();
    expect(response.status(), `${label}: ${name}`).toBe(403);
  }
}

test("client and professional get 403 on agency and platform routes", async ({ page, browser }) => {
  // marca autônoma
  await signupViaApi(page.request, "client", "Marca Curiosa");
  await expectForbidden(page.request, "client");
  // não gera para outra marca
  await login(page, "agencia");
  const other = await (await page.request.post("/api/clients", { data: { name: "Outra Marca", channels: [] } })).json();
  const brandContext = await browser.newContext();
  const brand = brandContext.request;
  await signupViaApi(brand, "client", "Marca Vizinha");
  const cross = await brand.post("/api/generate", { data: { clientId: other.id, type: "strategy_analysis", params: {} } });
  expect(cross.status()).toBe(403);
  expect((await brand.get(`/api/generations?clientId=${other.id}`)).status()).toBe(403);
  expect((await brand.get(`/api/clients/${other.id}`)).status()).toBe(403);
  // GET settings: sem presença de chaves
  const settings = await (await brand.get("/api/settings")).json();
  expect(settings).not.toHaveProperty("hasAnthropicKey");
  expect(settings).not.toHaveProperty("houseStyle");
  await brandContext.close();

  // profissional
  const proContext = await browser.newContext();
  await signupViaApi(proContext.request, "professional", "Foto Curiosa");
  await expectForbidden(proContext.request, "professional");
  expect((await proContext.request.post("/api/generate", { data: { clientId: other.id, type: "strategy_analysis", params: {} } })).status()).toBe(403);
  await proContext.close();
});

test("agency cannot change AI keys, AI mode or landing pages; admin sees key presence", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const before = await (await page.request.get("/api/settings")).json();
  expect(before).not.toHaveProperty("hasAnthropicKey");
  const put = await page.request.put("/api/settings", {
    data: { agencyName: "Agência Teste", tagline: "", accentColor: "#123456", aiMode: "premium", landingPagesEnabled: true, anthropicApiKey: "sk-ant-fake" },
  });
  expect(put.status()).toBe(200);
  const after = await put.json();
  expect(after.agencyName).toBe("Agência Teste");
  expect(after.aiMode).toBe(before.aiMode);
  expect(after.landingPagesEnabled).toBe(before.landingPagesEnabled);

  await page.context().clearCookies();
  await login(page, "admin");
  const admin = await (await page.request.get("/api/settings")).json();
  expect(admin).toHaveProperty("hasAnthropicKey");
  expect(admin.anthropicKeySource).not.toBe("database"); // a chave da agência não foi gravada
  // devolve o nome original para as outras specs
  await page.request.put("/api/settings", { data: { agencyName: before.agencyName, tagline: before.tagline, accentColor: before.accentColor } });
});

test("anonymous access: 401 on APIs, public pages open, unknown pages 404, token pages noindex", async ({ request }) => {
  expect((await request.get("/api/clients")).status()).toBe(401);
  expect((await request.get("/api/settings")).status()).toBe(401);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true, db: "ok" });
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: http://localhost:3200/sitemap.xml");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const path of ["/para-agencias", "/termos", "/privacidade", "/reembolso"]) expect(xml).toContain(`http://localhost:3200${path}`);
  const unknown = await request.get("/pagina-que-nao-existe", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
  const privatePage = await request.get("/clients", { maxRedirects: 0 });
  expect(privatePage.status()).toBe(307);
  const invite = await request.get("/convite/token-qualquer");
  expect(invite.headers()["x-robots-tag"]).toContain("noindex");
  const proposal = await request.get("/proposta/token-qualquer");
  expect(proposal.headers()["x-robots-tag"]).toContain("noindex");
  expect((await request.get("/api/auth/users")).status()).toBe(200); // dev: lista de logins
  // cookie de sessão com assinatura forjada não entra
  const forged = await request.get("/api/clients", { headers: { cookie: "agencyhub_session=eyJ1c2VySWQiOiJ4Iiwicm9sZSI6ImFkbWluIn0.abc" } });
  expect(forged.status()).toBe(401);
});

test("AI landing HTML is served sandboxed; sales webhook needs the client's token", async ({ page }) => {
  // o admin liga as landing pages para este teste
  await login(page, "admin");
  const settings = await (await page.request.get("/api/settings")).json();
  await page.request.put("/api/settings", {
    data: { agencyName: settings.agencyName, tagline: settings.tagline, accentColor: settings.accentColor, landingPagesEnabled: true },
  });
  await page.context().clearCookies();
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client } = await seedClientWithDelivery(page.request, "Loja do Webhook");
  const landing = await page.request.post("/api/generate", { data: { clientId: client.id, type: "landing_page", params: {} } });
  expect(landing.status()).toBe(201);
  const html = await page.request.get(`/api/generations/${(await landing.json()).id}/html`);
  expect(html.status()).toBe(200);
  const csp = html.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("sandbox");
  expect(csp).not.toContain("allow-same-origin");

  // webhook de vendas
  const noToken = await page.request.post(`/api/webhooks/sales/${client.id}`, { data: { revenue: 100 } });
  expect(noToken.status()).toBe(403);
  const token = (await (await page.request.post(`/api/clients/${client.id}/webhook-token`)).json()).token as string;
  expect(token).toMatch(/^[a-f0-9]{48}$/);
  const wrong = await page.request.post(`/api/webhooks/sales/${client.id}?token=${"0".repeat(48)}`, { data: { revenue: 100 } });
  expect(wrong.status()).toBe(403);
  const ok = await page.request.post(`/api/webhooks/sales/${client.id}`, {
    data: { revenue: 150, units: 2, source: "loja" },
    headers: { "x-webhook-token": token },
  });
  expect(ok.status()).toBe(201);
  const otherClient = await page.request.post(`/api/webhooks/sales/nao-existe?token=${token}`, { data: { revenue: 1 } });
  expect(otherClient.status()).toBe(403);

  await page.context().clearCookies();
  await login(page, "admin");
  await page.request.put("/api/settings", {
    data: { agencyName: settings.agencyName, tagline: settings.tagline, accentColor: settings.accentColor, landingPagesEnabled: false },
  });
});

test("a managed brand can approve in the portal but cannot run the agency's workspace", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const created = await (
    await page.request.post("/api/clients", { data: { name: "Marca Gerenciada", channels: ["Instagram"] } })
  ).json();
  const { username, password } = created.login;
  expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);

  const context = await browser.newContext();
  const brandPage = await context.newPage();
  await login(brandPage, username, password);
  await expect(brandPage).toHaveURL(/\/conta\?trocar=1/); // senha provisória → trocar
  const brand = context.request;
  expect((await brand.post("/api/generate", { data: { clientId: created.id, type: "strategy_analysis", params: {} } })).status()).toBe(403);
  expect((await brand.put(`/api/clients/${created.id}`, { data: { name: "Renomeada", channels: [] } })).status()).toBe(403);
  expect((await brand.delete(`/api/clients/${created.id}`)).status()).toBe(403);
  expect((await brand.get(`/api/clients/${created.id}/finance`)).status()).toBe(403);
  expect((await brand.get(`/api/clients/${created.id}`)).status()).toBe(200);
  const request = await brand.post("/api/projects", {
    data: { clientId: created.id, title: "Pedido do portal", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "" },
  });
  expect(request.status()).toBe(201);
  const project = await request.json();
  // mudar status fora da aprovação: negado
  expect((await brand.patch(`/api/projects/${project.id}`, { data: { status: "paid" } })).status()).toBe(403);
  await context.close();
});
