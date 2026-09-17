import { test, expect } from "@playwright/test";
import { adminUserId, login, signupViaApi } from "./helpers";

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

test("admin sees real AI cost per action, caps one account, grants coins with a note, exports and deletes it", async ({ page, browser }) => {
  const tenant = await browser.newContext();
  const account = await signupViaApi(tenant.request, "agency", "Agência Custo Real", {}, "198.51.100.61");
  const client = await (await tenant.request.post("/api/clients", { data: { name: "Cliente do Custo", channels: ["Instagram"] } })).json();
  const first = await tenant.request.post("/api/generate", { data: { clientId: client.id, type: "social_calendar", params: {} } });
  expect(first.status()).toBe(201);

  await login(page, "admin");
  const id = await adminUserId(page.request, account.username);
  const overview = await (await page.request.get("/api/admin/overview")).json();
  expect(overview.ai.byActionModel.some((r: { action: string; calls: number }) => r.action === "social_calendar" && r.calls >= 1)).toBe(true);
  expect(Array.isArray(overview.ai.margins)).toBe(true);

  // teto minúsculo: a próxima chamada para antes de sair
  const cap = await page.request.post(`/api/admin/users/${id}`, { data: { action: "set_cap", usd: 0.0001 } });
  expect(cap.status()).toBe(200);
  const blocked = await tenant.request.post("/api/generate", { data: { clientId: client.id, type: "social_calendar", params: {} } });
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).error).toContain("limite de uso de IA");
  await page.request.post(`/api/admin/users/${id}`, { data: { action: "set_cap", usd: null } });
  expect((await tenant.request.post("/api/generate", { data: { clientId: client.id, type: "social_calendar", params: {} } })).status()).toBe(201);

  // concessão exige motivo e muda a carteira exatamente
  const before = (await (await tenant.request.get("/api/billing")).json()).wallet.coins;
  expect((await page.request.post(`/api/admin/users/${id}`, { data: { action: "grant_coins", coins: 500 } })).status()).toBe(400);
  const granted = await page.request.post(`/api/admin/users/${id}`, { data: { action: "grant_coins", coins: 500, note: "cortesia de teste" } });
  expect(granted.status()).toBe(200);
  expect((await (await tenant.request.get("/api/billing")).json()).wallet.coins).toBe(before + 500);

  // UI: aba de custos com margem e tabela por ação
  await page.goto("/admin");
  await page.getByTestId("admin-tab-ai").click();
  await expect(page.getByTestId("admin-ai-margins")).toBeVisible();
  await expect(page.getByTestId("admin-ai-actions")).toContainText("social_calendar");

  // LGPD: exporta só esta conta e exclui com confirmação
  const exported = await (await page.request.get(`/api/admin/users/${id}/export`)).json();
  expect(exported.account.username).toBe(account.username);
  expect(JSON.stringify(exported)).not.toContain("agencia");
  expect((await page.request.post(`/api/admin/users/${id}`, { data: { action: "delete_account", confirm: "outro" } })).status()).toBe(400);
  expect((await page.request.post(`/api/admin/users/${id}`, { data: { action: "delete_account", confirm: account.username } })).status()).toBe(200);
  const relogin = await browser.newContext();
  const loginAttempt = await relogin.request.post("/api/auth/login", { data: { username: account.username, password: account.password } });
  expect(loginAttempt.status()).not.toBe(200);
  await relogin.close();
  await tenant.close();
});

test("only the admin reaches the new admin APIs", async ({ page }) => {
  await login(page, "agencia");
  expect([401, 403]).toContain((await page.request.get("/api/admin/users/x/export")).status());
  expect([401, 403]).toContain((await page.request.post("/api/admin/users/x", { data: { action: "set_cap", usd: 1 } })).status());
});
