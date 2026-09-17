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
  // a primeira volta para no 6º passo; "Ver todos os diferenciais" segue um por card
  await expect(page.getByTestId("tour-step")).toContainText("6 / 6");
  await page.getByTestId("tour-more").click();
  await expect(page.getByTestId("tour-step")).toHaveAttribute("data-step", "6");
  const counter = (await page.getByTestId("tour-step").locator("p").first().textContent()) ?? "";
  const total = Number(counter.split("/")[1]);
  expect(total).toBeGreaterThan(20);
  for (let i = 6; i < total; i++) {
    await expect(page.getByTestId("tour-step")).toHaveAttribute("data-step", String(i));
    // todo diferencial tem card na Hoje (a lista abre sozinha)
    await expect(page.getByTestId("tour-step")).toHaveAttribute("data-anchor", /^(diff-|nav-)/);
    await page.getByTestId("tour-next").click();
  }
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
  // O acesso do cliente aparece uma vez, com senha provisória aleatória.
  await expect(page.getByTestId("one-time-login")).toBeVisible();
  await expect(page.getByTestId("otp-password")).toHaveText(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
  await page.getByRole("button", { name: "Abrir o cliente" }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new$)[^/]+$/);
  await expect(page.locator("h1").first()).toContainText("Padaria do Bairro");
});

test("self-service brand signup lands in its own workspace", async ({ page }) => {
  await page.goto("/criar-conta");
  await page.getByRole("button", { name: /marca|cliente/i }).first().click();
  await page.getByTestId("reg-name").fill("Loja Sol");
  await page.getByTestId("reg-industry").fill("moda");
  await page.getByTestId("reg-email").fill("loja.sol@example.com");
  await page.getByTestId("reg-password").fill("senha1234");
  await page.getByTestId("reg-terms").check();
  await page.getByTestId("reg-submit").click();
  await expect(page).toHaveURL(/\/portal\/client\/[^/?]+\?welcome=1&choose=1$/, { timeout: 20_000 });
});
