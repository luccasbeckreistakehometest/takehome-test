import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

// Painel de público sintético (modo de teste): tabela completa persona ×
// versão, vencedora, rótulo de personas genéricas, cache sem custo, limites.
test("synthetic audience panel from the calendar post editor", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Painel Doceria", audience: "famílias do bairro", channels: ["Instagram"] } })).json();
  const today = new Date().toISOString().slice(0, 10);
  const post = await (
    await page.request.post("/api/scheduled-posts", {
      data: { clientId: client.id, title: "Bolo do dia", channel: "Instagram", caption: "Hoje tem bolo de cenoura com cobertura de chocolate feito na hora, venha provar", scheduledFor: `${today}T15:00`, status: "draft" },
    })
  ).json();
  const coins = async () => (await (await page.request.get("/api/billing")).json()).wallet.coins as number;
  const before = await coins();

  await page.goto("/calendar");
  await page.getByTestId("calendar-client").selectOption(client.id);
  await page.getByTestId("calendar-post").filter({ hasText: "Bolo do dia" }).first().click();
  const panel = page.getByTestId("post-panel");
  await panel.getByTestId("panel-open").click();
  await panel.getByTestId("panel-variant").nth(1).fill("Bolo de cenoura quentinho hoje");
  await panel.getByTestId("panel-run").click();
  const result = panel.getByTestId("panel-result");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-winner", "1");
  await expect(panel.getByTestId("panel-cell")).toHaveCount(8);
  await expect(result).toContainText("personas genéricas");
  await expect(panel.getByTestId("panel-disclaimer")).toContainText("não substitui teste real");
  expect(await coins()).toBe(before - 2);

  // mesmo teste de novo: resultado guardado, sem custo
  await panel.getByTestId("panel-run").click();
  await expect(result).toContainText("mesmo teste de antes");
  expect(await coins()).toBe(before - 2);

  // usar a vencedora troca a legenda (o guardião da voz fica logo acima)
  await panel.getByTestId("panel-apply").click();
  await expect(panel.getByTestId("post-caption")).toHaveValue("Bolo de cenoura quentinho hoje");

  // limites
  const one = await page.request.post(`/api/clients/${client.id}/panel`, { data: { variants: ["só uma versão"] } });
  expect(one.status()).toBe(400);
  const four = await page.request.post(`/api/clients/${client.id}/panel`, { data: { variants: ["versão um", "versão dois", "versão três", "versão quatro"] } });
  expect(four.status()).toBe(400);

  // agendar a versão A para comparar com cliques reais; calibragem ainda sem dados
  const tests = await (await page.request.get(`/api/clients/${client.id}/panel`)).json();
  expect(tests.tests).toHaveLength(1);
  expect(tests.calibration).toBeNull();
  const scheduled = await page.request.post(`/api/panel/${tests.tests[0].id}/schedule`, { data: { variant: 0, scheduledFor: `${today}T18:00` } });
  expect(scheduled.status()).toBe(201);
  expect((await scheduled.json()).test.variantPostIds[0]).toBeTruthy();
  const learnings = await (await page.request.get(`/api/clients/${client.id}/learnings`)).json();
  expect(learnings.panel.calibration).toBeNull();
  void post;
});
