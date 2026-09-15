import { expect, type Page } from "@playwright/test";

export async function login(page: Page, username: string, password = "e2e-pass") {
  await page.goto("/login");
  await page.getByPlaceholder("ex.: agencia").fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Marca o tour como concluído para specs que não são sobre ele. */
export async function skipOnboarding(page: Page) {
  await page.request.post("/api/onboarding", { data: { completed: true, event: "e2e_skip" } });
}
