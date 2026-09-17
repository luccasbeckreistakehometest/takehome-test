import { test, expect } from "@playwright/test";
import { login, signupViaApi, skipOnboarding } from "./helpers";

// Navegação consolidada: 7 itens + Mais, páginas antigas continuam abrindo,
// abas do cliente em grupos e ?tab= resolvendo o grupo.
test("agency header has at most 7 items plus Mais and old URLs still open", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, "agencia");
  await skipOnboarding(page);
  await page.goto("/");
  const nav = page.getByTestId("agency-nav");
  await expect(nav).toBeVisible();
  expect(await nav.locator(":scope > a").count()).toBeLessThanOrEqual(7);
  await expect(page.getByTestId("nav-more")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByTestId("nav-more").click();
  await expect(page.getByRole("menuitem", { name: "Profissionais" })).toBeVisible();

  // Agenda: conteúdo e reuniões nos endereços de sempre
  await page.goto("/calendar");
  await expect(page.getByTestId("agenda-tab-content")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("agenda-tab-meetings").click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(page.getByTestId("agenda-tab-meetings")).toHaveAttribute("aria-current", "page");
  // Resultados: insights e margem
  await page.goto("/finance");
  await expect(page.getByTestId("results-tab-finance")).toHaveAttribute("aria-current", "page");
  // Crescimento: hub com prospecção
  await page.goto("/growth");
  await expect(page.getByTestId("growth-hub")).toBeVisible();
  await page.getByTestId("growth-prospecting").click();
  await expect(page).toHaveURL(/\/prospecting$/);

  const client = await (await page.request.post("/api/clients", { data: { name: "Nav Co", channels: ["Instagram"] } })).json();
  await page.goto(`/clients/${client.id}?tab=campaign30`);
  await expect(page.locator('[data-testid="workspace-groups"] [data-group="plan"]')).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="campaign30"]')).toHaveAttribute("aria-current", "page");
  await page.goto(`/clients/${client.id}?tab=time`);
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="time"]')).toHaveAttribute("aria-current", "page");
  // trocar de seção abre a primeira aba dela e atualiza a URL
  await page.locator('[data-testid="workspace-groups"] [data-group="content"]').click();
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="social_calendar"]')).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/tab=social_calendar/);
});

test("a self-serve brand sees no agency-only tabs", async ({ page }) => {
  await signupViaApi(page.request, "client", "Marca Sem Horas");
  const me = await (await page.request.get("/api/auth/me")).json();
  await skipOnboarding(page);
  await page.goto(`/clients/${me.refId}?tab=time`);
  await expect(page.getByTestId("workspace-groups")).toBeVisible();
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="dashboard"]')).toHaveAttribute("aria-current", "page");
  await page.locator('[data-testid="workspace-groups"] [data-group="ops"]').click();
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="projects"]')).toBeVisible();
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="time"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="workspace-tabs"] [data-tab="attendant"]')).toHaveCount(0);
});
