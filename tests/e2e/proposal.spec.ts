import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

test("public proposal: generate from a prospect, prospect accepts without login, client + portal login created", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  await page.goto("/prospecting");
  // prospect cadastrado à mão (sem depender da busca por IA)
  await page.getByTestId("manual-prospect-toggle").click();
  await page.getByTestId("manual-name").fill("Padaria Sol");
  await page.getByTestId("manual-segment").fill("padaria");
  await page.getByTestId("manual-save").click();
  await expect(page.getByText("Padaria Sol")).toBeVisible();

  await page.getByTestId("proposal-toggle").first().click();
  await page.getByTestId("proposal-services").fill("gestão de Instagram R$ 1.500/mês");
  await page.getByTestId("proposal-generate").click();
  const row = page.getByTestId("proposal-row").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toHaveAttribute("data-state", "open");
  const href = await row.getByTestId("proposal-open").getAttribute("href");
  expect(href).toMatch(/^\/proposta\/[a-f0-9]+$/);

  // o prospect abre sem login e aceita
  await page.context().clearCookies();
  await page.goto(href!);
  await expect(page.getByTestId("proposal-headline")).toContainText("Padaria Sol");
  await page.getByTestId("proposal-package").filter({ hasText: "Essencial" }).click();
  await page.getByTestId("proposal-name").fill("Dona Sol");
  await page.getByTestId("proposal-contact").fill("41999990000");
  await page.getByTestId("proposal-accept").click();
  await expect(page.getByTestId("proposal-accepted")).toBeVisible();
  const username = await page.getByTestId("proposal-username").innerText();
  expect(username).toContain("padaria");

  // segunda tentativa de aceite é recusada; a página mostra "já aceita"
  const again = await page.request.post(`/api${href!.replace("/proposta", "/proposals")}/accept`, {
    data: { packageName: "Essencial", name: "X Y", contact: "12345678" },
  });
  expect(again.status()).toBe(409);
  await page.reload();
  await expect(page.getByText("Esta proposta já foi aceita.")).toBeVisible();

  // a agência foi avisada e o prospect virou cliente
  await login(page, "agencia");
  const activities = await (await page.request.get("/api/activities?audience=agency")).json();
  expect(activities.some((a: { text: string }) => a.text.includes("Padaria Sol aceitou a proposta"))).toBe(true);
  const prospects = await (await page.request.get("/api/prospects")).json();
  const converted = prospects.prospects.find((p: { name: string }) => p.name === "Padaria Sol");
  expect(converted.status).toBe("converted");
  expect(converted.clientId).toBeTruthy();
  const client = await (await page.request.get(`/api/clients/${converted.clientId}`)).json();
  expect(client.name).toBe("Padaria Sol");
  expect(client.notes).toContain("Essencial");
});

// A expiração no instante exato é coberta pelo teste unitário de proposal-rules
// (a API não cria propostas já vencidas: validade mínima de 1 dia).
test("accept refuses unknown tokens and unknown packages", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const prospect = await (await page.request.post("/api/prospects/manual", { data: { name: "Loja Expirada", segment: "moda" } })).json();
  const created = await (
    await page.request.post(`/api/prospects/${prospect.id}/proposal`, { data: { expiresInDays: 1 } })
  ).json();
  const token = created.proposal.token as string;
  await page.context().clearCookies();
  const before = await (await page.request.get(`/api/proposals/${token}`)).json();
  expect(before.state).toBe("open");
  const missing = await page.request.post(`/api/proposals/nope/accept`, { data: { packageName: "x", name: "ab", contact: "12345" } });
  expect(missing.status()).toBe(404);
  const unknownPackage = await page.request.post(`/api/proposals/${token}/accept`, { data: { packageName: "Platina", name: "ab", contact: "12345" } });
  expect(unknownPackage.status()).toBe(400);
});
