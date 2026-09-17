import { test as setup, expect } from "@playwright/test";
import { adminUserId, login } from "./helpers";

// Liga o bloqueio por saldo (mesma checagem de BILLING_ENFORCED=true) e dá à
// agência da casa o plano Growth pelo admin — como o dono faz antes de ligar a
// cobrança em produção.
setup("turn billing enforcement on and grant the house agency a plan", async ({ page }) => {
  await login(page, "admin");
  const on = await page.request.post("/api/billing/enforce", { data: { on: true } });
  expect((await on.json()).enforced).toBe(true);
  const agencyId = await adminUserId(page.request, "agencia");
  const plan = await page.request.post(`/api/admin/users/${agencyId}`, {
    data: { action: "set_plan", planId: "agency_growth", months: 1 },
  });
  expect(plan.status()).toBe(200);
});
