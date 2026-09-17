import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

// Radar de IA (modo de teste): perguntas sugeridas, uma rodada com busca
// registrada no ledger, participação calculada, aviso de simulação, trava
// de 7 dias e o bloco no relatório mensal.
test("AI radar: suggest questions, run once a week, ledger and report block", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (
    await page.request.post("/api/clients", {
      data: { name: "Pet Shop Au-Au", industry: "pet shop", competitors: "Cão Feliz, Mundo Pet", channels: ["Instagram"] },
    })
  ).json();
  const coins = async () => (await (await page.request.get("/api/billing")).json()).wallet.coins as number;
  const before = await coins();

  await page.goto(`/clients/${client.id}?tab=ai_radar`);
  await expect(page.getByTestId("radar-empty")).toBeVisible();
  await page.getByTestId("radar-suggest").click();
  await expect(page.getByTestId("radar-question")).toHaveCount(8);
  await page.getByTestId("radar-run").click();
  await expect(page.getByTestId("radar-result")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("radar-row")).toHaveCount(8);
  await expect(page.getByTestId("radar-disclaimer")).toContainText("Simulação feita por IA com busca na web");
  await expect(page.getByTestId("radar-actions").locator("li").first()).toBeVisible();
  // 1 (sugestão) + 12 (rodada)
  expect(await coins()).toBe(before - 13);

  const state = await (await page.request.get(`/api/clients/${client.id}/ai-radar`)).json();
  const run = state.runs[0];
  // exemplo: a marca aparece em 3 das 8 respostas, 3 de 19 menções
  expect(run.summary.clientMentions).toBe(3);
  expect(run.summary.totalMentions).toBe(19);
  expect(run.summary.shareOfVoice).toBe(15.8);
  await expect(page.getByTestId("radar-sov")).toHaveText("15,8%");
  expect(state.canRun).toBe(false);
  await expect(page.getByTestId("radar-next")).toBeVisible();

  const again = await page.request.post(`/api/clients/${client.id}/ai-radar/run`);
  expect(again.status()).toBe(429);
  expect((await again.json()).nextRunAt).toBeTruthy();

  // relatório do mês traz o bloco com o aviso
  const report = await (await page.request.get(`/api/clients/${client.id}/report`)).json();
  expect(report.data.aiRadar.shareOfVoice).toBe(15.8);
  expect(report.data.aiRadar.disclaimer).toContain("podem responder diferente");

  // ledger: 8 perguntas com 2 buscas cada
  await login(page, "admin");
  const overview = await (await page.request.get("/api/admin/overview")).json();
  const radar = overview.ai.byActionModel.find((r: { action: string }) => r.action === "ai_radar");
  expect(radar.calls).toBe(8);
  expect(radar.webSearches).toBe(16);

  // outra marca não abre o radar deste cliente
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(page, "agencia");
  const neighbour = await (await page.request.post("/api/clients", { data: { name: "Vizinho Radar", channels: [] } })).json();
  await login(otherPage, neighbour.login.username, neighbour.login.password);
  expect((await otherPage.request.get(`/api/clients/${client.id}/ai-radar`)).status()).toBe(403);
  expect((await otherPage.request.post(`/api/clients/${client.id}/ai-radar/run`)).status()).toBe(403);
  await other.close();
});
