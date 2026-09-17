import { test as teardown, expect } from "@playwright/test";
import { login } from "./helpers";

teardown("turn billing enforcement off", async ({ page }) => {
  await login(page, "admin");
  const off = await page.request.post("/api/billing/enforce", { data: { on: false } });
  expect((await off.json()).enforced).toBe(false);
});
