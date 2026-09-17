import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

// Pacote do cliente + guardião do escopo: 12 posts no pacote e 12 já na
// agenda → "mais um post" vira extra que só vira demanda depois de aprovado.
test("a request beyond the package waits for the client to approve the extra price", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const created = await (await page.request.post("/api/clients", { data: { name: "Escopo Café", channels: ["Instagram"] } })).json();
  const clientId = created.id as string;

  // pacote pelo modelo "Social básico" (12 posts, 4 stories, 1 relatório)
  await page.goto(`/clients/${clientId}?tab=package`);
  await page.getByTestId("preset-social_basico").click();
  await page.getByTestId("package-save").click();
  await expect(page.locator('[data-testid="package-usage"] [data-key="post"]')).toHaveAttribute("data-allowance", "12");

  const month = new Date().toISOString().slice(0, 7);
  for (let i = 1; i <= 12; i++) {
    const day = String(Math.min(i, 28)).padStart(2, "0");
    const r = await page.request.post("/api/scheduled-posts", {
      data: { clientId, title: `Post ${i}`, channel: "Instagram", caption: "legenda", scheduledFor: `${month}-${day}T09:00`, status: "scheduled", format: "Feed" },
    });
    expect(r.status()).toBe(201);
  }
  const projectsBefore = (await (await page.request.get(`/api/projects?clientId=${clientId}`)).json()).length;

  // portal do cliente
  const clientCtx = await browser.newContext();
  const portal = await clientCtx.newPage();
  await login(portal, created.login.username, created.login.password);
  await skipOnboarding(portal);
  await portal.goto(`/portal/client/${clientId}`);
  const card = portal.getByTestId("scope-request-card");
  await expect(card.locator('[data-key="post"]')).toHaveAttribute("data-used", "12");
  await card.getByTestId("scope-text").fill("mais um post para o Dia dos Pais");
  await card.getByTestId("scope-next").click();
  await expect(card.getByTestId("scope-item")).toHaveValue("post");
  await expect(card.getByTestId("scope-preview")).toHaveAttribute("data-in", "false");
  await expect(card.getByTestId("scope-preview")).toContainText("120");
  await card.getByTestId("scope-send").click();
  await expect(card.getByTestId("scope-sent")).toHaveAttribute("data-kind", "extra");
  // nenhuma demanda nova ainda
  expect((await (await page.request.get(`/api/projects?clientId=${clientId}`)).json()).length).toBe(projectsBefore);
  const pending = (await (await portal.request.get(`/api/clients/${clientId}/scope-requests`)).json())[0];
  expect(pending).toMatchObject({ status: "pending_client", inPackage: false, extraPrice: 120, itemKey: "post", classifiedBy: "ai" });

  // o cliente aprova o valor → vira demanda
  await card.getByTestId("scope-approve").first().click();
  await expect(card.locator('[data-testid="scope-request"]').first()).toHaveAttribute("data-status", "approved");
  const projectsAfter = await (await page.request.get(`/api/projects?clientId=${clientId}`)).json();
  expect(projectsAfter.length).toBe(projectsBefore + 1);
  expect(projectsAfter.some((p: { brief: string }) => p.brief.includes("extra aprovado pelo cliente"))).toBe(true);
  // a agência não aprova no lugar do cliente, e não decide duas vezes
  expect((await page.request.patch(`/api/scope-requests/${pending.id}`, { data: { decision: "approved" } })).status()).toBe(403);
  expect((await portal.request.patch(`/api/scope-requests/${pending.id}`, { data: { decision: "declined" } })).status()).toBe(409);

  // dentro do pacote (stories 0/4): demanda na hora
  await card.getByTestId("scope-text").fill("um story dos bastidores da cozinha");
  await card.getByTestId("scope-next").click();
  await expect(card.getByTestId("scope-item")).toHaveValue("story");
  await expect(card.getByTestId("scope-preview")).toHaveAttribute("data-in", "true");
  await card.getByTestId("scope-send").click();
  await expect(card.getByTestId("scope-sent")).toHaveAttribute("data-kind", "in");
  expect((await (await page.request.get(`/api/projects?clientId=${clientId}`)).json()).length).toBe(projectsBefore + 2);

  // a Hoje da agência mostra o extra aprovado
  await page.goto("/");
  // (a soma inclui extras de outras specs da mesma agência)
  await expect(page.getByTestId("extras-summary")).toContainText("Extras aprovados este mês: R$");

  // outro cliente não enxerga este pacote
  const other = await (await page.request.post("/api/clients", { data: { name: "Vizinho Escopo", channels: [] } })).json();
  const otherCtx = await browser.newContext();
  const otherPage = await otherCtx.newPage();
  await login(otherPage, other.login.username, other.login.password);
  await skipOnboarding(otherPage);
  expect((await otherPage.request.get(`/api/clients/${clientId}/package`)).status()).toBe(403);
  expect((await otherPage.request.patch(`/api/scope-requests/${pending.id}`, { data: { decision: "declined" } })).status()).toBe(403);
  expect((await portal.request.put(`/api/clients/${clientId}/package`, { data: { items: [] } })).status()).toBe(403);
  await otherCtx.close();
  await clientCtx.close();
});

// Guardião do escopo: pedido dentro do pacote reserva a cota (o mesmo pedido
// não passa quatro vezes), a etiqueta "IA" é do servidor e a agência pode
// reclassificar um pedido como extra.
test("in-package requests use up the quota and the agency can charge one as an extra", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const created = await (await page.request.post("/api/clients", { data: { name: "Reserva Café", channels: ["Instagram"] } })).json();
  const clientId = created.id as string;
  await page.request.put(`/api/clients/${clientId}/package`, {
    data: { rolloverUnused: false, items: [{ key: "post", label: "Posts no feed", unit: "post", qty: 12, extraPrice: 120 }, { key: "relatorio", label: "Relatório mensal", unit: "relatório", qty: 1, extraPrice: 250 }] },
  });

  const clientCtx = await browser.newContext();
  const portal = await clientCtx.newPage();
  await login(portal, created.login.username, created.login.password);
  const ask = (text: string, itemKey: string, qty: number) => portal.request.post(`/api/clients/${clientId}/scope-requests`, { data: { text, itemKey, qty } });

  const first = await ask("quero mais 12 posts para o mês", "post", 12);
  expect(first.status()).toBe(201);
  expect((await first.json()).request).toMatchObject({ inPackage: true, extraPrice: 0, qty: 12 });
  // a reserva consome a cota: o mesmo pedido de novo já é extra
  const usage = await (await portal.request.get(`/api/clients/${clientId}/package`)).json();
  expect(usage.usage.find((u: { key: string }) => u.key === "post")).toMatchObject({ used: 12, remaining: 0 });
  const second = await ask("quero mais 12 posts para o mês", "post", 12);
  expect(second.status()).toBe(201);
  const secondBody = await second.json();
  expect(secondBody.needsApproval).toBe(true);
  expect(secondBody.request).toMatchObject({ inPackage: false, extraPrice: 1440 });

  // etiqueta forjada pelo cliente não entra
  const forged = await portal.request.post(`/api/clients/${clientId}/scope-requests`, {
    data: { text: "um site novo completo com loja virtual e posts de divulgação", itemKey: "relatorio", qty: 1, classifiedBy: "ai", aiReasoning: "forjado pelo cliente" },
  });
  expect(forged.status()).toBe(201);
  const forgedRequest = (await forged.json()).request;
  expect(forgedRequest).toMatchObject({ classifiedBy: "manual", aiReasoning: "", inPackage: true, needsReview: true });

  // a agência vê o aviso e cobra como extra
  await page.goto(`/clients/${clientId}?tab=package`);
  const review = page.locator('[data-testid="scope-request"]').filter({ hasText: "um site novo completo" }).first();
  await expect(review.getByTestId("scope-review")).toBeVisible();
  page.once("dialog", (d) => d.accept("3500"));
  await review.getByTestId("scope-charge-extra").click();
  await expect(review).toHaveAttribute("data-status", "pending_client");
  const afterCharge = (await (await page.request.get(`/api/clients/${clientId}/scope-requests`)).json()).find((r: { id: string }) => r.id === forgedRequest.id);
  expect(afterCharge).toMatchObject({ status: "pending_client", inPackage: false, extraPrice: 3500 });
  // o cliente aprova o valor e a demanda que já existia continua sendo uma só
  const projectsBefore = (await (await page.request.get(`/api/projects?clientId=${clientId}`)).json()).length;
  expect((await portal.request.patch(`/api/scope-requests/${forgedRequest.id}`, { data: { decision: "approved" } })).status()).toBe(200);
  expect((await (await page.request.get(`/api/projects?clientId=${clientId}`)).json()).length).toBe(projectsBefore);
  // o cliente não reclassifica
  expect((await portal.request.patch(`/api/scope-requests/${(await first.json()).request.id}`, { data: { decision: "charge_extra", price: 10 } })).status()).toBe(403);
  await clientCtx.close();
});
