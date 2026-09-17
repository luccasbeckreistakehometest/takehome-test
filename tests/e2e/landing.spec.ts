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

  test("showcase, month timeline, comparison and pricing per audience", async ({ page }) => {
    // home: vitrine com 4 cards; o 1º leva para o funil de agências
    await page.goto("/");
    const cards = page.getByTestId("showcase-card");
    await expect(cards).toHaveCount(4);
    await expect(page.getByTestId("landing-compare")).toBeVisible();
    await cards.first().click();
    await expect(page).toHaveURL(/\/para-agencias$/);

    // agências: linha do tempo, comparação, assinatura no cartão e custo por ação
    await expect(page.getByTestId("landing-timeline").locator("li")).toHaveCount(6);
    await expect(page.getByTestId("landing-compare")).toContainText("link com histórico");
    await expect(page.getByTestId("pricing-card-line")).toContainText("cancele quando quiser");
    await expect(page.getByTestId("pricing-action-costs")).toContainText("10 coins");
    await page.getByTestId("showcase-card").nth(1).click();
    await expect(page).toHaveURL(/\/criar-conta\?type=agency$/);

    for (const [path, type] of [["/para-marcas", "client"], ["/para-profissionais", "professional"]] as const) {
      await page.goto(path);
      await expect(page.getByTestId("landing-timeline")).toHaveCount(0);
      await page.getByTestId("showcase-card").first().click();
      await expect(page).toHaveURL(new RegExp(`/criar-conta\\?type=${type}$`));
    }

    // inglês nativo, cobrado em BRL
    await page.evaluate(() => localStorage.setItem("uiLang", "en"));
    await page.goto("/para-agencias");
    await expect(page.getByTestId("landing-showcase")).toContainText("What only Marqa does for your agency");
    await expect(page.getByTestId("pricing-card-line")).toContainText("cancel anytime");
    await page.evaluate(() => localStorage.removeItem("uiLang"));
  });

  test("funnels fit a 360 px phone", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 780 }, baseURL: "http://localhost:3200", locale: "pt-BR" });
    const page = await context.newPage();
    for (const path of ["/", "/para-agencias", "/para-marcas", "/para-profissionais"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      const offenders = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-testid="showcase-card"], [data-testid="landing-compare"] > div > div, [data-testid="landing-timeline"] li, #planos'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < -1 || r.right > window.innerWidth + 1;
          })
          .map((el) => `${el.tagName}.${el.getAttribute("data-testid") ?? el.id}`)
      );
      expect(offenders, path).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
});
