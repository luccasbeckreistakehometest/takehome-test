import { test, expect } from "@playwright/test";
import { login, seedClientWithDelivery, skipOnboarding } from "./helpers";

test("hours and margin: timer + manual entries per client, hourly costs, monthly fee, flagged clients and CSV", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client, project } = await seedClientWithDelivery(page.request, "Margemco");
  const loss = await (await page.request.post("/api/clients", { data: { name: "Prejuizoco", industry: "moda" } })).json();
  const pro = await (
    await page.request.post("/api/professionals", {
      data: { name: "Dani Designer", role: "designer", location: "Curitiba", skills: ["Social media design"] },
    })
  ).json();

  // custos: R$ 80/h da equipe, R$ 200/h da Dani, meta 30%
  await page.goto("/finance");
  await expect(page.getByTestId("finance-page")).toBeVisible();
  await page.getByTestId("rate-default").fill("80");
  await page.getByTestId("rate-target").fill("30");
  await page.getByLabel("Custo/hora de Dani Designer").fill("200");
  await page.getByTestId("finance-save").click();
  await expect(page.getByText("Aplicado ✓")).toBeVisible();

  // aba Horas do cliente: fee, cronômetro e lançamento manual
  await page.goto(`/clients/${client.id}?tab=time`);
  await expect(page.getByTestId("time-tab")).toBeVisible();
  await page.getByTestId("client-fee").fill("1000");
  await page.getByTestId("client-fee-save").click();
  await page.getByTestId("timer-note").fill("Posts de outubro");
  await page.getByTestId("timer-project").selectOption(project.id);
  await page.getByTestId("timer-start").click();
  await expect(page.getByTestId("timer-running")).toBeVisible();
  await expect(page.getByTestId("time-entry").first()).toHaveAttribute("data-running", "yes");
  await page.getByTestId("timer-stop").click();
  await expect(page.getByTestId("timer-running")).toBeHidden();
  await expect(page.getByTestId("time-entry").first()).toHaveAttribute("data-running", "no");
  // 3h à mão pela equipe (R$ 240) + 1h da Dani (R$ 200)
  await page.getByTestId("manual-hours").fill("3");
  await page.getByTestId("manual-minutes").fill("0");
  await page.getByTestId("manual-note").fill("Planejamento do mês");
  await page.getByTestId("manual-save").click();
  await expect(page.getByTestId("time-entry")).toHaveCount(2);
  await page.getByTestId("manual-hours").fill("1");
  await page.getByTestId("manual-professional").selectOption(pro.id);
  await page.getByTestId("manual-note").fill("Artes");
  await page.getByTestId("manual-save").click();
  await expect(page.getByTestId("time-entry")).toHaveCount(3);
  await expect(page.getByTestId("client-hours")).toHaveText("4h00");
  await expect(page.getByTestId("client-cost")).toContainText("440");
  await expect(page.getByTestId("client-margin-value")).toContainText("560");
  await expect(page.getByTestId("client-margin")).toHaveAttribute("data-status", "ok");

  // o segundo cliente custa mais do que paga
  await page.request.put(`/api/clients/${loss.id}/finance`, { data: { monthlyFee: 100 } });
  const manual = await page.request.post("/api/time-entries", { data: { action: "manual", clientId: loss.id, minutes: 300, note: "Reuniões" } });
  expect(manual.status()).toBe(201);
  const month = new Date().toISOString().slice(0, 7);
  const report = await (await page.request.get(`/api/finance/margin?month=${month}`)).json();
  const lossRow = report.rows.find((r: { clientId: string }) => r.clientId === loss.id);
  expect(lossRow).toMatchObject({ fee: 100, minutes: 300, cost: 400, margin: -300, status: "loss" });
  const okRow = report.rows.find((r: { clientId: string }) => r.clientId === client.id);
  expect(okRow).toMatchObject({ fee: 1000, cost: 440, margin: 560, marginPct: 56, status: "ok", entries: 3 });
  expect(report.totals.flagged).toBe(1);

  // visão da agência + CSV
  await page.goto("/finance");
  await expect(page.getByTestId("margin-row").filter({ hasText: "Prejuizoco" })).toHaveAttribute("data-status", "loss");
  await expect(page.getByTestId("margin-row").filter({ hasText: "Margemco" })).toHaveAttribute("data-status", "ok");
  const csv = await page.request.get(`/api/finance/margin?month=${month}&format=csv`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain("Mês;Cliente;Fee mensal");
  expect(body).toContain("Prejuizoco;100,00;5,00;400,00;-300,00;-300,00");
  expect(body).toContain("TOTAL");

  // editar e excluir apontamento; validações
  const entries = await (await page.request.get(`/api/time-entries?clientId=${loss.id}&month=${month}`)).json();
  const edited = await (await page.request.patch(`/api/time-entries/${entries.entries[0].id}`, { data: { minutes: 60, note: "Reunião curta" } })).json();
  expect(edited.entry.minutes).toBe(60);
  expect((await page.request.delete(`/api/time-entries/${entries.entries[0].id}`)).status()).toBe(200);
  expect((await page.request.get("/api/finance/margin?month=2026-13")).status()).toBe(400);
  // cliente não acessa a margem
  await login(page, client.login.username, client.login.password);
  expect((await page.request.get(`/api/finance/margin?month=${month}`)).status()).toBe(403);
  expect((await page.request.get(`/api/clients/${client.id}/finance`)).status()).toBe(403);
});
