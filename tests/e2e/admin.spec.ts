import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("admin sees the platform totals and first-session funnel", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin");
  await expect(page.getByText("Tours concluídos")).toBeVisible();
  await expect(page.getByText("Briefings por voz")).toBeVisible();
  await expect(page.getByTestId("admin-onboarding")).toBeVisible();
});

test("agency cannot open the platform admin", async ({ page }) => {
  await login(page, "agencia");
  const r = await page.request.get("/api/admin/overview");
  expect([401, 403]).toContain(r.status());
});
