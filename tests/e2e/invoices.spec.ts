import { test, expect } from "@playwright/test";
import { login, skipOnboarding } from "./helpers";

const month = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 7);
const previousMonth = (() => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
})();

// Fatura do fee por Pix: rascunho com fee + extra aprovado, envio só com a
// chave cadastrada, página pública com QR e copia e cola, "Já paguei" →
// confirmação da agência, atraso na Hoje.
test("fee invoice: draft with the approved extra, Pix page, paid claim and confirmation", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await (await page.request.post("/api/clients", { data: { name: "Fatura Café", channels: ["Instagram"] } })).json();
  expect((await page.request.put(`/api/clients/${client.id}/finance`, { data: { monthlyFee: 2500 } })).status()).toBe(200);
  // pacote sem posts: qualquer post pedido é extra de R$ 300
  await page.request.put(`/api/clients/${client.id}/package`, { data: { items: [{ label: "Posts", unit: "post", qty: 0, extraPrice: 300 }] } });

  const brandCtx = await browser.newContext();
  const brand = await brandCtx.newPage();
  await login(brand, client.login.username, client.login.password);
  const request = await (await brand.request.post(`/api/clients/${client.id}/scope-requests`, { data: { text: "post extra de aniversário", itemKey: "post", qty: 1 } })).json();
  expect(request.needsApproval).toBe(true);
  expect((await brand.request.patch(`/api/scope-requests/${request.request.id}`, { data: { decision: "approved" } })).status()).toBe(200);

  // rascunho pela aba Cobranças do cliente
  await page.goto(`/clients/${client.id}?tab=invoices`);
  await expect(page.getByTestId("invoices-no-pix")).toBeVisible();
  await page.getByTestId("invoice-create").click();
  const row = page.getByTestId("invoice-row").first();
  await expect(row).toHaveAttribute("data-state", "draft");
  await expect(row).toContainText("2.800");
  await expect(row.getByTestId("invoice-send")).toBeDisabled();
  const list = await (await page.request.get(`/api/invoices?clientId=${client.id}`)).json();
  const invoice = list.invoices[0];
  expect(invoice.total).toBe(2800);
  expect(invoice.items.map((i: { kind: string }) => i.kind)).toEqual(["fee", "extra"]);
  expect((await page.request.patch(`/api/invoices/${invoice.id}`, { data: { action: "send" } })).status()).toBe(409);
  // o mesmo mês não duplica e o extra não entra duas vezes
  const again = await (await page.request.post("/api/invoices", { data: { clientId: client.id, month } })).json();
  expect(again.id).toBe(invoice.id);

  // recebimentos
  await page.goto("/settings#recebimentos");
  await page.getByTestId("pix-key").fill("pix-invalida");
  await page.getByTestId("pix-name").fill("Agência Marqa Teste");
  await page.getByTestId("pix-city").fill("São Paulo");
  await page.getByTestId("pix-save").click();
  await expect(page.getByTestId("invoice-settings").getByRole("alert")).toBeVisible();
  await page.getByTestId("pix-key").fill("financeiro@example.com");
  await page.getByTestId("pix-save").click();
  await expect(page.getByTestId("invoice-settings")).toContainText("Pronto para enviar faturas");

  const sent = await (await page.request.patch(`/api/invoices/${invoice.id}`, { data: { action: "send" } })).json();
  expect(sent.invoice.status).toBe("sent");
  expect(sent.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(sent.invoice.pixPayload).toContain("financeiro@example.com");
  expect(sent.invoice.pixPayload).toContain("54072800.00");

  // cliente sem sessão abre a fatura
  const guestCtx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const guest = await guestCtx.newPage();
  await guest.goto(`/fatura/${invoice.token}`);
  await expect(guest.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(guest.getByTestId("invoice-qr").locator("svg")).toBeVisible();
  await expect(guest.getByTestId("invoice-payload")).toHaveText(sent.invoice.pixPayload);
  await guest.getByTestId("invoice-copy").click();
  expect(await guest.evaluate(() => navigator.clipboard.readText())).toBe(sent.invoice.pixPayload);
  await guest.getByTestId("invoice-claim").click();
  await expect(guest.getByTestId("invoice-claimed")).toBeVisible();
  const activities = await (await page.request.get("/api/activities?audience=agency")).json();
  expect(activities.some((a: { text: string }) => a.text.includes("avisou que pagou"))).toBe(true);

  // a agência confirma
  await page.goto("/invoices");
  const paidRow = page.locator('[data-testid="invoice-row"]', { hasText: "Fatura Café" }).first();
  await paidRow.getByTestId("invoice-confirm").click();
  await expect(paidRow).toHaveAttribute("data-state", "paid");
  await guest.reload();
  await expect(guest.getByTestId("invoice-paid")).toBeVisible();

  // portal do cliente lista a fatura; CSV da agência
  await brand.goto(`/portal/client/${client.id}`);
  await expect(brand.getByTestId("portal-invoices")).toContainText(month);
  const csv = await page.request.get("/api/invoices?format=csv");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Fatura Café");

  // fatura do mês passado enviada e não paga: atrasada na Hoje
  const old = await (await page.request.post("/api/invoices", { data: { clientId: client.id, month: previousMonth } })).json();
  await page.request.patch(`/api/invoices/${old.id}`, { data: { action: "send" } });
  const oldRow = (await (await page.request.get(`/api/invoices?clientId=${client.id}`)).json()).invoices.find((i: { id: string }) => i.id === old.id);
  expect(oldRow.state).toBe("overdue");
  await page.goto("/");
  await expect(page.getByTestId("home-overdue").first()).toContainText("Fatura Café");

  // ninguém de fora mexe nas faturas
  expect((await brand.request.patch(`/api/invoices/${old.id}`, { data: { action: "paid" } })).status()).toBe(403);
  expect((await guestCtx.request.post("/api/fatura/token-invalido/paid")).status()).toBe(404);
  await guestCtx.close();
  await brandCtx.close();
});
