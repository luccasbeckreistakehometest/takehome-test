import { test, expect } from "@playwright/test";
import { login, signupViaApi, skipOnboarding } from "./helpers";

// Roda no projeto "enforced": bloqueio por saldo LIGADO (enforce.setup.ts) e a
// agência da casa no plano Growth (dado pelo admin).

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

test("enforcement is on and paid plans or free coins cannot be taken without paying", async ({ page }) => {
  const account = await signupViaApi(page.request, "client", "Marca Esperta");
  const billing = await (await page.request.get("/api/billing")).json();
  expect(billing.enforced).toBe(true);
  expect(billing.plan.id).toBe("client_free");
  expect(billing.wallet.coins).toBe(40); // cota grátis na criação da conta
  expect(billing.prepaid).toBe(true);

  const paid = await page.request.post("/api/billing/subscribe", { data: { planId: "client_pro", period: "annual" } });
  expect(paid.status()).toBe(402);
  const crossType = await page.request.post("/api/billing/subscribe", { data: { planId: "agency_scale" } });
  expect(crossType.status()).toBe(400);
  // a rota de coins grátis não existe mais (o middleware nem deixa a marca chegar lá)
  const freeCoins = await page.request.post("/api/billing/coins", { data: { packId: "pack_2000" } });
  expect([403, 404, 405]).toContain(freeCoins.status());
  // sem MP_ACCESS_TOKEN no e2e: checkout indisponível, nada é creditado
  const checkout = await page.request.post("/api/billing/checkout", { data: { kind: "coins", packId: "pack_100" } });
  expect(checkout.status()).toBe(503);
  const again = await (await page.request.get("/api/billing")).json();
  expect(again.wallet.coins).toBe(40);
  expect(again.plan.id).toBe("client_free");
  // webhook forjado não credita (a consulta ao MP falha → 5xx)
  const forged = await page.request.post("/api/webhooks/mercadopago", {
    data: { type: "payment", data: { id: "123456" } },
  });
  expect(forged.status()).toBeGreaterThanOrEqual(500);
  expect((await (await page.request.get("/api/billing")).json()).wallet.coins).toBe(40);
  expect(account.username).toBeTruthy();
});

test("a self-serve brand uses its free coins for AI and gets a clear 402 when they run out", async ({ page }) => {
  await signupViaApi(page.request, "client", "Marca Com Cota");
  const me = await (await page.request.get("/api/auth/me")).json();
  const clientId = me.refId as string;

  const first = await page.request.post("/api/generate", { data: { clientId, type: "strategy_analysis", params: {} } });
  expect(first.status()).toBe(201); // 10 coins
  let wallet = (await (await page.request.get("/api/billing")).json()).wallet;
  expect(wallet.coins).toBe(30);

  for (let i = 0; i < 3; i++) {
    expect((await page.request.post("/api/generate", { data: { clientId, type: "strategy_analysis", params: {} } })).status()).toBe(201);
  }
  const blocked = await page.request.post("/api/generate", { data: { clientId, type: "strategy_analysis", params: {} } });
  expect(blocked.status()).toBe(402);
  const body = await blocked.json();
  expect(body.code).toBe("no_coins");
  expect(body.error).toContain("coins");
  wallet = (await (await page.request.get("/api/billing")).json()).wallet;
  expect(wallet.coins).toBe(0);
  // ações sem custo seguem funcionando
  expect((await page.request.get(`/api/clients/${clientId}/dashboard`)).status()).toBe(200);
});

test("the agency uses its plan quota for clients (report, campaign, match) under enforcement", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const before = (await (await page.request.get("/api/billing")).json()).wallet.coins;
  expect(before).toBeGreaterThan(100);
  const client = await (
    await page.request.post("/api/clients", { data: { name: "Cliente do Plano", industry: "moda", channels: ["Instagram"] } })
  ).json();
  const month = new Date().toISOString().slice(0, 7);
  expect((await page.request.post(`/api/clients/${client.id}/report`, { data: { month } })).status()).toBe(201);
  expect(
    (await page.request.post(`/api/clients/${client.id}/campaigns`, { data: { goal: "lançar coleção", channels: ["Instagram"] } })).status()
  ).toBe(201);
  const project = await (
    await page.request.post("/api/projects", {
      data: { clientId: client.id, title: "Ensaio da coleção", brief: "fotos de produto", skillsNeeded: ["Fotografia de produto"], location: "", budget: "", deadline: "" },
    })
  ).json();
  // proposta comercial para um prospect (4 coins)
  const prospect = await (await page.request.post("/api/prospects/manual", { data: { name: "Prospect Pago", segment: "padaria" } })).json();
  const proposal = await page.request.post(`/api/prospects/${prospect.id}/proposal`, { data: { services: "gestão de Instagram" } });
  expect(proposal.status()).toBe(201);
  const match = await page.request.post(`/api/projects/${project.id}/match`);
  // sem profissionais cadastrados a rota responde 400 antes de cobrar; com eles, 200
  expect([200, 400]).toContain(match.status());
  const after = (await (await page.request.get("/api/billing")).json()).wallet.coins;
  expect(after).toBeLessThan(before);
  expect(before - after).toBeGreaterThanOrEqual(3 + 8 + 4);
});

test("a freelancer keeps using profile, portfolio and applications under enforcement", async ({ page, browser }) => {
  // demanda aberta da agência
  const agency = await browser.newContext();
  const agencyPage = await agency.newPage();
  await login(agencyPage, "agencia");
  const client = await (await agency.request.post("/api/clients", { data: { name: "Cliente Marketplace", channels: [] } })).json();
  const project = await (
    await agency.request.post("/api/projects", {
      data: { clientId: client.id, title: "Fotos para o feed", brief: "10 fotos", skillsNeeded: [], location: "", budget: "", deadline: "", mode: "marketplace" },
    })
  ).json();

  await signupViaApi(page.request, "professional", "Fotógrafo Plano Grátis", { professionalRole: "fotografo", location: "São Paulo, SP" });
  const me = await (await page.request.get("/api/auth/me")).json();
  const profile = await (await page.request.get(`/api/professionals/${me.refId}`)).json();
  expect(profile.opportunities.some((p: { id: string }) => p.id === project.id)).toBe(true);
  const upload = await page.request.post(`/api/professionals/${me.refId}/assets`, {
    multipart: { file: { name: "foto.png", mimeType: "image/png", buffer: PNG } },
  });
  expect(upload.status()).toBe(201);
  const apply = await page.request.post(`/api/projects/${project.id}/applications`, { data: { message: "Tenho portfólio de produto." } });
  expect(apply.status()).toBe(201);
  // candidatura sempre em nome próprio
  expect((await apply.json()).professionalId).toBe(me.refId);
  const billing = await (await page.request.get("/api/billing")).json();
  expect(billing.plan.id).toBe("pro_free");
  await page.goto(`/professionals/${me.refId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await agency.close();
});

test("a new agency spends its own entry-plan coins and never the house agency's", async ({ page, browser }) => {
  const house = await browser.newContext();
  const housePage = await house.newPage();
  await login(housePage, "agencia");
  const houseBefore = (await (await house.request.get("/api/billing")).json()).wallet.coins;

  await signupViaApi(page.request, "agency", "Agência Enxuta", {}, "198.51.100.40");
  const start = await (await page.request.get("/api/billing")).json();
  expect(start.plan.id).toBe("agency_free");
  expect(start.wallet.coins).toBe(60);
  const client = await (await page.request.post("/api/clients", { data: { name: "Cliente Enxuto", channels: ["Instagram"] } })).json();
  for (let i = 0; i < 6; i++) {
    const ok = await page.request.post("/api/generate", { data: { clientId: client.id, type: "strategy_analysis", params: {} } });
    expect(ok.status()).toBe(201); // 10 coins cada
  }
  const blocked = await page.request.post("/api/generate", { data: { clientId: client.id, type: "strategy_analysis", params: {} } });
  expect(blocked.status()).toBe(402);
  expect((await blocked.json()).code).toBe("no_coins");
  expect((await (await page.request.get("/api/billing")).json()).wallet.coins).toBe(0);
  // a casa não pagou nada disso
  expect((await (await house.request.get("/api/billing")).json()).wallet.coins).toBe(houseBefore);
  await house.close();
});
