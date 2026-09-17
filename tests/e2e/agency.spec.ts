import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

test("first login: welcome → anchored tour across pages → saved on the server", async ({ page }) => {
  await login(page, "agencia");
  await expect(page.getByTestId("welcome")).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByTestId("welcome-next").click();
  // the modal hands over to the spotlight tour
  await expect(page.getByTestId("tour-step")).toHaveAttribute("data-step", "0");
  await page.getByTestId("tour-next").click();
  await page.getByTestId("tour-next").click();
  // step 3 lives on the new-client page: the tour navigates there itself
  await expect(page).toHaveURL(/\/clients\/new/);
  await expect(page.getByTestId("tour-step")).toHaveAttribute("data-step", "2");
  await page.getByTestId("tour-next").click();
  await page.getByTestId("tour-next").click();
  // os diferenciais ficam na Hoje: o tour volta para "/" sozinho
  await page.getByTestId("tour-next").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("tour-step")).toHaveAttribute("data-step", "5");
  await expect(page.getByTestId("differentiators")).toBeVisible();
  // um passo por diferencial (5 da rodada 1 + os da rodada 2)
  for (let i = 0; i < 11; i++) await page.getByTestId("tour-next").click();
  await expect(page.getByTestId("tour-step")).toBeHidden();
  const state = await page.evaluate(() => fetch("/api/onboarding").then((r) => r.json()));
  expect(state.tourCompleted).toBe(true);
  await page.goto("/");
  await page.waitForTimeout(800);
  await expect(page.getByTestId("welcome")).toBeHidden();
});

test("new client by typing", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  await page.goto("/clients/new");
  await page.getByPlaceholder("Ex.: Café Aurora").fill("Padaria do Bairro");
  await page.getByPlaceholder("Ex.: cafeteria artesanal").fill("padaria");
  await page.getByPlaceholder(/O que a empresa faz/).fill("Padaria de bairro com pães artesanais e café da manhã.");
  await page.getByTestId("save-client").click();
  await expect(page).toHaveURL(/\/clients\/[^/]+$/);
  await expect(page.locator("h1").first()).toContainText("Padaria do Bairro");
});

test("self-service brand signup lands in its own workspace", async ({ page }) => {
  await page.goto("/criar-conta");
  await page.getByRole("button", { name: /marca|cliente/i }).first().click();
  await page.getByTestId("reg-name").fill("Loja Sol");
  await page.getByTestId("reg-industry").fill("moda");
  await page.getByTestId("reg-password").fill("senha1234");
  await page.getByTestId("reg-submit").click();
  await expect(page).toHaveURL(/\/(clients|portal)\//, { timeout: 20_000 });
});
