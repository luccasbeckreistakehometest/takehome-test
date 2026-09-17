import { test, expect } from "@playwright/test";
import { login, seedClientWithDelivery, skipOnboarding } from "./helpers";

test("monthly report: numbers, AI summary, print link and the client portal view", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client } = await seedClientWithDelivery(page.request, "Reportco");
  await page.request.post("/api/scheduled-posts", {
    data: { clientId: client.id, title: "Post agendado", channel: "Instagram", caption: "oi", hashtags: [], scheduledFor: new Date().toISOString().slice(0, 16) },
  });

  await page.goto(`/clients/${client.id}`);
  await page.getByTestId("open-monthly-report").click();
  await expect(page).toHaveURL(new RegExp(`/clients/${client.id}/report`));
  await expect(page.getByTestId("monthly-report")).toBeVisible();
  await expect(page.getByText("Post do cappuccino")).toBeVisible();

  await page.getByTestId("report-generate").click();
  await expect(page.getByTestId("report-summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("report-summary")).toContainText("Reportco");
  const printHref = await page.getByTestId("report-print-link").getAttribute("href");
  expect(printHref).toMatch(/\/print\/report\/[a-f0-9]+/);

  // link público (sem login) abre a versão imprimível
  await page.context().clearCookies();
  await page.goto(printHref!);
  await expect(page.getByTestId("print-title")).toContainText("Relatório mensal");
  await expect(page.getByTestId("report-summary")).toBeVisible();

  // o cliente vê o mesmo relatório dentro do portal
  await login(page, client.login.username, client.login.password);
  await skipOnboarding(page);
  await page.goto(`/portal/client/${client.id}`);
  await page.getByTestId("portal-monthly-report").click();
  await expect(page).toHaveURL(new RegExp(`/portal/client/${client.id}/report`));
  await expect(page.getByTestId("report-summary")).toBeVisible();
  // marca gerenciada não gera o relatório sozinha
  const denied = await page.request.post(`/api/clients/${client.id}/report`, { data: { month: "2026-01" } });
  expect(denied.status()).toBe(403);
});
