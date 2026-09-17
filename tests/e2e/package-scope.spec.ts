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
  await expect(page.getByTestId("extras-summary")).toContainText("120");

  // outro cliente não enxerga este pacote
  const other = await (await page.request.post("/api/clients", { data: { name: "Vizinho Escopo", channels: [] } })).json();
  const otherCtx = await browser.newContext();
  const otherPage = await otherCtx.newPage();
  await login(otherPage, other.login.username, other.login.password);
  expect((await otherPage.request.get(`/api/clients/${clientId}/package`)).status()).toBe(403);
  expect((await otherPage.request.patch(`/api/scope-requests/${pending.id}`, { data: { decision: "declined" } })).status()).toBe(403);
  expect((await portal.request.put(`/api/clients/${clientId}/package`, { data: { items: [] } })).status()).toBe(403);
  await otherCtx.close();
  await clientCtx.close();
});
