import { test, expect, type Page } from "@playwright/test";
import { login, signupViaApi, skipOnboarding } from "./helpers";

// Tours por papel e "primeiros passos": profissional (salvo no servidor),
// cliente gerenciado (4 passos, nunca uma âncora da agência) e o checklist que
// marca sozinho depois da ação.

async function walkTour(page: Page, kind: string, total: number, anchors: RegExp) {
  const card = page.getByTestId("tour-step");
  for (let i = 0; i < total; i++) {
    await expect(card).toHaveAttribute("data-step", String(i));
    await expect(card).toHaveAttribute("data-kind", kind);
    await expect(card).toContainText(`${i + 1} / ${total}`);
    // só telas do próprio papel (nunca nav-/diff- da agência)
    await expect(card, `step ${i}`).toHaveAttribute("data-anchor", anchors);
    await page.getByTestId("tour-next").click();
  }
  await expect(card).toBeHidden();
}

test("professional: welcome hands over to the professional tour, completion survives reload and another device", async ({ page, browser }) => {
  const pro = await signupViaApi(page.request, "professional", "Fotógrafa Tour", { professionalRole: "fotografo", location: "Curitiba, PR" }, "198.51.100.91");
  await page.goto(pro.home);
  await expect(page.getByTestId("welcome")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByTestId("welcome-next").click();
  await expect(page.getByTestId("tour-step")).toHaveAttribute("data-anchor", "pro-portfolio");
  await walkTour(page, "professional", 5, /^pro-/);
  const state = await (await page.request.get("/api/onboarding")).json();
  expect(state).toMatchObject({ tourCompleted: true, kind: "professional" });

  // checklist do profissional: o portfólio conta a partir de 3 peças
  const checklist = page.getByTestId("activation-checklist");
  await expect(checklist).toHaveAttribute("data-role", "professional");
  await expect(checklist.locator('[data-key="portfolio"]')).toHaveAttribute("data-done", "false");

  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.getByTestId("tour-step")).toBeHidden();
  await expect(page.getByTestId("welcome")).toBeHidden();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, pro.email, pro.password);
  await otherPage.goto(pro.home);
  await otherPage.waitForTimeout(800);
  await expect(otherPage.getByTestId("welcome")).toBeHidden();
  await expect(otherPage.getByTestId("tour-step")).toBeHidden();
  // refazer o tour pelo menu da conta
  await otherPage.getByTestId("user-menu").click();
  await otherPage.getByTestId("tour-restart").click();
  await expect(otherPage.getByTestId("tour-step")).toHaveAttribute("data-step", "0");
  await otherPage.getByTestId("tour-skip").click();
  await other.close();
});

test("managed client: 4-step portal tour and a checklist that ticks without reload", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Floricultura Tour", industry: "flores", channels: ["Instagram"] } })).json();

  const context = await browser.newContext();
  const brand = await context.newPage();
  await login(brand, client.login.username, client.login.password);
  await brand.goto(`/portal/client/${client.id}`);
  await expect(brand.getByTestId("welcome")).toBeVisible();
  await expect(brand.getByTestId("welcome")).toContainText("Bem-vindo ao seu portal");
  for (let i = 0; i < 3; i++) await brand.getByTestId("welcome-next").click();
  await expect(brand.getByTestId("tour-step")).toHaveAttribute("data-anchor", "portal-deliverables");
  await walkTour(brand, "managed", 4, /^portal-/);

  // primeiros passos: nada feito; a mensagem para a agência marca na hora
  const checklist = brand.getByTestId("activation-checklist");
  await expect(checklist).toHaveAttribute("data-role", "managed");
  await expect(checklist.getByTestId("activation-step")).toHaveCount(4);
  const talk = checklist.locator('[data-key="talk"]');
  await expect(talk).toHaveAttribute("data-done", "false");
  await brand.getByPlaceholder("Escreva para a agência...").fill("Oi! Tudo certo por aqui.");
  await brand.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(talk).toHaveAttribute("data-done", "true");
  await expect(checklist.getByTestId("activation-count")).toHaveText("1 de 4");
  // fecha quando quiser, mesmo no meio (e some da tela)
  await checklist.getByTestId("activation-dismiss").click();
  await expect(brand.getByTestId("activation-checklist")).toBeHidden();
  await brand.reload();
  await expect(brand.getByTestId("activation-checklist")).toBeHidden();

  // a agência vendo o portal não recebe o card nem o tour do cliente
  await page.goto(`/portal/client/${client.id}`);
  await page.waitForTimeout(800);
  await expect(page.getByTestId("activation-checklist")).toBeHidden();
  await expect(page.getByTestId("welcome")).toBeHidden();

  // o funil do admin recebe o passo uma vez só
  await login(page, "admin");
  const csv = await (await page.request.get("/api/admin/analytics?format=csv&days=7")).text();
  expect(csv).toContain("activation_step");
  const analytics = await (await page.request.get("/api/admin/analytics?days=7")).json();
  expect(analytics.activation.find((a: { step: string }) => a.step === "managed:talk")?.accounts).toBeGreaterThanOrEqual(1);
  await page.goto("/admin/analytics?days=7");
  await expect(page.getByTestId("analytics-activation")).toContainText("managed:talk");
  await context.close();
});

test("agency: first run stops at 6 steps unless it asks to see every differentiator", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  await page.goto("/");
  await page.getByTestId("user-menu").click();
  await page.getByTestId("tour-restart").click();
  const card = page.getByTestId("tour-step");
  for (let i = 0; i < 5; i++) {
    await expect(card).toHaveAttribute("data-step", String(i));
    await page.getByTestId("tour-next").click();
  }
  await expect(page).toHaveURL(/\/$/);
  await expect(card).toHaveAttribute("data-anchor", "diff-scope");
  await expect(card).toContainText("6 / 6");
  await expect(page.getByTestId("tour-more")).toBeVisible();
  await expect(page.getByTestId("tour-next")).toHaveText("Entendi");
  await page.getByTestId("tour-next").click();
  await expect(card).toBeHidden();
  expect((await (await page.request.get("/api/onboarding")).json()).tourCompleted).toBe(true);
});
