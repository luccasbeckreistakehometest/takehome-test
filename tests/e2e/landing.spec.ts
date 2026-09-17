import { test, expect } from "@playwright/test";

test.describe("landing", () => {
  test("anonymous root is the landing, in pt and en", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const pt = await page.locator("h1").first().innerText();
    expect(pt.length).toBeGreaterThan(10);
    await page.evaluate(() => { localStorage.setItem("uiLang", "en"); });
    await page.reload();
    // a tradução é client-side (após a hidratação): espera o h1 mudar em vez
    // de ler o texto no instante do reload
    await expect(page.locator("h1").first()).not.toHaveText(pt);
    expect(errors).toEqual([]);
  });

  test("one funnel per audience", async ({ page }) => {
    for (const path of ["/para-agencias", "/para-marcas", "/para-profissionais"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).not.toBeEmpty();
      await expect(page.getByRole("link", { name: /criar|começar|start/i }).first()).toBeVisible();
    }
  });
});
