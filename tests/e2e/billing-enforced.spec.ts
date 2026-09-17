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
  const freeCoins = await page.request.post("/api/billing/coins", { data: { packId: "pack_2000" } });
  expect([404, 405]).toContain(freeCoins.status());
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
  const match = await page.request.post(`/api/projects/${project.id}/match`);
  // sem profissionais cadastrados a rota responde 400 antes de cobrar; com eles, 200
  expect([200, 400]).toContain(match.status());
  const after = (await (await page.request.get("/api/billing")).json()).wallet.coins;
  expect(after).toBeLessThan(before);
  expect(before - after).toBeGreaterThanOrEqual(3 + 8);
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
