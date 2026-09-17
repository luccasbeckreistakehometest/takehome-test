import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

test("brand briefing by voice fills the client form", async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __ahVoiceTest: boolean }).__ahVoiceTest = true; });
  await login(page, "agencia");
  await skipOnboarding(page);
  await page.goto("/clients/new");
  await page.getByTestId("mode-voice").click();
  await expect(page.getByTestId("voice")).toBeVisible();
  await page.getByTestId("voice-start").click();
  await expect(page.getByTestId("voice-stop")).toBeVisible();

  // thin first turn → the listener asks for what is missing
  await page.evaluate(() => (window as unknown as { __ahVoiceFeed: (t: string) => void }).__ahVoiceFeed("oi, é uma cafeteria"));
  await expect(page.getByTestId("voice-review")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("voice-confirm")).toBeDisabled();

  await page.getByTestId("voice-start").click();
  await page.evaluate(() => (window as unknown as { __ahVoiceFeed: (t: string) => void }).__ahVoiceFeed(
    "A marca é o Café Aurora, uma cafeteria artesanal de bairro com padaria própria. Quem compra são moradores de 25 a 45 anos em home office. O objetivo é dobrar o movimento nas manhãs de semana em seis meses, com uns três mil por mês em Instagram e Google.",
  ));
  await expect(page.getByTestId("voice-confirm")).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId("voice-confirm").click();

  // fields are filled for review, then saved like any client
  await expect(page.getByPlaceholder("Ex.: Café Aurora")).toHaveValue("Café Aurora");
  await expect(page.getByText(/Preenchido por voz/)).toBeVisible();
  await page.getByTestId("save-client").click();
  await expect(page.getByTestId("one-time-login")).toBeVisible();
  await page.getByRole("button", { name: "Abrir o cliente" }).click();
  await expect(page).toHaveURL(/\/clients\/(?!new$)[^/]+$/);
  await expect(page.locator("h1").first()).toContainText("Café Aurora");
});
