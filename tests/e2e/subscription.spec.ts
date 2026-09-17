import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { signupViaApi, skipOnboarding } from "./helpers";

// Assinatura recorrente no cartão (Mercado Pago preapproval) com o transporte
// falso: pedido de R$ 997/mês, 1ª cobrança aprovada liga o plano e recarrega
// a cota, replay não faz nada, cancelar mantém até o fim, carência de 3 dias.
const dataDir = path.join(process.cwd(), "data", "e2e");
const readJson = (file: string, fallback: unknown) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  } catch {
    return fallback;
  }
};

test("card subscription: preapproval, first charge, replay, cancel and grace", async ({ page }) => {
  await signupViaApi(page.request, "agency", "Agência Recorrente", {}, "198.51.100.77");
  await skipOnboarding(page);
  const state = await (await page.request.get("/api/billing/subscription")).json();
  expect(state.available).toBe(true);
  expect(state.recurring).toBe(false);

  await page.goto("/plans");
  await page.getByTestId("subscribe-agency_growth").click();
  await expect(page).toHaveURL(/\/plans\?sub=fake&preapproval=fake-pre-\d+/);
  await expect(page.getByText("Assinatura enviada ao Mercado Pago")).toBeVisible();
  const preapprovalId = new URL(page.url()).searchParams.get("preapproval")!;

  const outbox = readJson("mp-outbox.json", []) as { method: string; path: string; body: Record<string, unknown> }[];
  const sent = outbox.filter((r) => r.method === "POST" && r.path === "/preapproval");
  const mine = sent[sent.length - 1];
  expect(mine.body.auto_recurring).toMatchObject({ transaction_amount: 997, currency_id: "BRL", frequency: 1, frequency_type: "months" });
  expect(String(mine.body.external_reference)).toMatch(/^sub\|agency\|.+\|agency_growth\|monthly$/);
  const accountId = String(mine.body.external_reference).split("|")[2];

  // o "Mercado Pago" aprova a 1ª cobrança
  const store = readJson("mp-fake.json", { preapprovals: {}, authorized_payments: {}, seq: 0 });
  const chargeId = `70${Date.now() % 100000}`;
  store.authorized_payments[chargeId] = {
    id: chargeId,
    preapproval_id: preapprovalId,
    status: "processed",
    transaction_amount: 997,
    currency_id: "BRL",
    payment: { id: 5001, status: "approved" },
  };
  fs.writeFileSync(path.join(dataDir, "mp-fake.json"), JSON.stringify(store));
  const hook = { data: { type: "subscription_authorized_payment", data: { id: chargeId } } };
  const first = await (await page.request.post("/api/webhooks/mercadopago", hook)).json();
  expect(first.outcome).toBe("credited");
  let billing = await (await page.request.get("/api/billing")).json();
  expect(billing.plan.id).toBe("agency_growth");
  expect(billing.wallet.planCoins).toBe(6000);
  const days = (Date.parse(billing.subscription.renewsAt) - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(27);
  const replay = await (await page.request.post("/api/webhooks/mercadopago", hook)).json();
  expect(replay.outcome).toBe("already_credited");
  expect((await (await page.request.get("/api/billing")).json()).wallet.planCoins).toBe(6000);

  // status e cancelamento
  await page.goto("/plans");
  await expect(page.getByTestId("subscription-status")).toContainText("Próxima cobrança");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("subscription-cancel").click();
  await expect(page.getByTestId("subscription-status")).toContainText("Cancelada");
  const cancels = (readJson("mp-outbox.json", []) as { method: string; path: string; body: { status?: string } }[]).filter(
    (r) => r.method === "PUT" && r.path === `/preapproval/${preapprovalId}`
  );
  expect(cancels[0]?.body.status).toBe("cancelled");
  billing = await (await page.request.get("/api/billing")).json();
  expect(billing.plan.id).toBe("agency_growth");

  // carência: renovação ativa vale até fim + 3 dias; depois volta ao grátis
  const db = new Database(path.join(dataDir, "agencyhub.db"), { timeout: 10_000 });
  const setEnd = (daysAgo: number, cancel: number) =>
    db
      .prepare("UPDATE subscriptions SET renewsAt = ?, cancelAtPeriodEnd = ? WHERE accountType = 'agency' AND accountId = ?")
      .run(new Date(Date.now() - daysAgo * 86_400_000).toISOString(), cancel, accountId);
  setEnd(2, 0);
  expect((await (await page.request.get("/api/billing")).json()).plan.id).toBe("agency_growth");
  setEnd(4, 0);
  expect((await (await page.request.get("/api/billing")).json()).plan.id).toBe("agency_free");
  db.close();
});

test("subscription API refuses managed brands and bad plans", async ({ page }) => {
  await signupViaApi(page.request, "professional", "Fotógrafa Sem Plano", { professionalRole: "fotografo", location: "Recife, PE" }, "198.51.100.82");
  const blocked = await page.request.post("/api/billing/subscription", { data: { planId: "pro_plus" } });
  expect(blocked.status()).toBe(403);
  await page.context().clearCookies();
  await signupViaApi(page.request, "client", "Marca Assinante", {}, "198.51.100.83");
  const wrong = await page.request.post("/api/billing/subscription", { data: { planId: "agency_growth" } });
  expect(wrong.status()).toBe(400);
  const noCancel = await page.request.post("/api/billing/subscription/cancel");
  expect(noCancel.status()).toBe(409);
});
