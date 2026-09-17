import { test, expect } from "@playwright/test";
import { createHmac } from "crypto";
import { login, skipOnboarding, E2E_META_APP_SECRET } from "./helpers";

async function seedClient(page: import("@playwright/test").Page, name: string) {
  return (
    await page.request.post("/api/clients", {
      data: { name, industry: "salão de beleza", description: "Salão de bairro", tone: "acolhedor", channels: ["WhatsApp"], country: "Brasil" },
    })
  ).json();
}

test("attendant: draft mode drafts in the brand voice, auto mode answers safely and hands off on price", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await seedClient(page, "Salão Lumi");
  // canal da agência "conectado" (sessão) para as respostas automáticas terem por onde sair
  await page.request.post("/api/messaging/connections", {
    data: { channel: "whatsapp", mode: "session", apiToken: "", apiAccountId: "", sessionReady: true },
  });

  await page.goto(`/clients/${client.id}?tab=attendant`);
  await expect(page.getByTestId("attendant-tab")).toBeVisible();

  // desligado: a simulação só guarda a mensagem
  await page.getByTestId("attendant-test-text").fill("Oi, vocês abrem no sábado?");
  await page.getByTestId("attendant-test-send").click();
  await expect(page.getByTestId("attendant-test-result")).toContainText("desligado");

  // modo rascunho
  await page.getByTestId("mode-draft").click();
  await page.getByTestId("attendant-save").click();
  await expect(page.getByText("Aplicado ✓")).toBeVisible();
  await page.getByTestId("attendant-test-text").fill("Oi, vocês abrem no sábado?");
  await page.getByTestId("attendant-test-send").click();
  const result = page.getByTestId("attendant-test-result");
  await expect(result).toHaveAttribute("data-status", "draft");
  await expect(result).toContainText("Salão Lumi");
  // a agência aprova e envia o rascunho
  const draft = page.getByTestId("attendant-reply").filter({ has: page.getByTestId("reply-send") }).first();
  await draft.getByTestId("reply-send").click();
  await expect(page.getByTestId("attendant-reply").first()).toHaveAttribute("data-status", "sent");
  const outbox = await (await page.request.get("/api/messaging/outbox")).json();
  expect(outbox.outbox.some((m: { toAddress: string; body: string }) => m.toAddress === "5511900000000" && m.body.includes("Salão Lumi"))).toBe(true);

  // modo automático 24h (para o teste não depender da hora): responde sozinho...
  await page.request.put(`/api/clients/${client.id}/attendant`, {
    data: { mode: "auto", hoursStart: 0, hoursEnd: 24, days: [0, 1, 2, 3, 4, 5, 6], maxAutoPerContactPerDay: 2 },
  });
  const auto = await (
    await page.request.post(`/api/clients/${client.id}/attendant/inbound`, {
      data: { fromAddress: "5511911111111", fromName: "Ana", body: "Que horas vocês fecham?" },
    })
  ).json();
  expect(auto.reply.status).toBe("sent");
  expect(auto.reply.mode).toBe("auto");
  expect(auto.reply.confidence).toBeGreaterThan(0.7);
  expect(auto.reply.outboxId).toBeTruthy();

  // ...nunca inventa preço: passa para humano
  const price = await (
    await page.request.post(`/api/clients/${client.id}/attendant/inbound`, {
      data: { fromAddress: "5511911111111", fromName: "Ana", body: "Quanto custa a escova?" },
    })
  ).json();
  expect(price.reply.status).toBe("handoff");
  expect(price.reply.reason).toBe("needs_human");

  // ...e respeita o limite diário por contato (2 já usadas: 1 sent + 1 handoff)
  const limited = await (
    await page.request.post(`/api/clients/${client.id}/attendant/inbound`, {
      data: { fromAddress: "5511911111111", fromName: "Ana", body: "E o endereço?" },
    })
  ).json();
  expect(limited.reply.status).toBe("draft");
  expect(limited.reply.reason).toBe("rate_limit");

  // pedido explícito de humano nem passa pela IA
  const human = await (
    await page.request.post(`/api/clients/${client.id}/attendant/inbound`, {
      data: { fromAddress: "5511922222222", fromName: "Bia", body: "quero falar com um atendente" },
    })
  ).json();
  expect(human.reply.status).toBe("handoff");
  expect(human.reply.reason).toBe("requested_human");

  // fora do horário: vira rascunho
  await page.request.put(`/api/clients/${client.id}/attendant`, { data: { days: [] } });
  const closed = await (
    await page.request.post(`/api/clients/${client.id}/attendant/inbound`, {
      data: { fromAddress: "5511933333333", fromName: "Caio", body: "Oi, tudo bem?" },
    })
  ).json();
  expect(closed.reply.status).toBe("draft");
  expect(closed.reply.reason).toBe("outside_hours");

  // o log guarda modo + confiança de cada resposta
  const view = await (await page.request.get(`/api/clients/${client.id}/attendant`)).json();
  expect(view.replies.length).toBeGreaterThanOrEqual(6);
  expect(view.replies.every((r: { mode: string; confidence: number }) => ["auto", "draft"].includes(r.mode) && typeof r.confidence === "number")).toBe(true);
  expect(view.config.apiToken).toBe("");
});

test("the Meta webhook routes a message to the client by phone_number_id", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const client = await seedClient(page, "Barbearia Norte");
  await page.request.put(`/api/clients/${client.id}/attendant`, {
    data: { mode: "draft", phoneNumberId: "PN-123", apiToken: "tok" },
  });
  await page.context().clearCookies();
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "PN-123" },
              contacts: [{ profile: { name: "Duda" } }],
              messages: [{ from: "5521988887777", text: { body: "Vocês cortam cabelo infantil?" } }],
            },
          },
        ],
      },
    ],
  });
  // Sem assinatura (ou assinada com outro segredo): recusado, nada entra.
  const unsigned = await page.request.post("/api/webhooks/meta", { data: body, headers: { "content-type": "application/json" } });
  expect(unsigned.status()).toBe(401);
  const forged = await page.request.post("/api/webhooks/meta", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": `sha256=${createHmac("sha256", "wrong").update(body).digest("hex")}` },
  });
  expect(forged.status()).toBe(401);
  const hook = await page.request.post("/api/webhooks/meta", {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${createHmac("sha256", E2E_META_APP_SECRET).update(body).digest("hex")}`,
    },
  });
  expect(hook.status()).toBe(200);
  // Handshake: o token público antigo não vale; o configurado vale.
  expect((await page.request.get("/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=agencyhub-verify&hub.challenge=x")).status()).toBe(403);
  const ok = await page.request.get("/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=e2e-verify-token-0123&hub.challenge=abc");
  expect(await ok.text()).toBe("abc");
  await login(page, "agencia");
  const view = await (await page.request.get(`/api/clients/${client.id}/attendant`)).json();
  expect(view.inbound[0].fromName).toBe("Duda");
  expect(view.inbound[0].clientId).toBe(client.id);
  expect(view.replies[0].status).toBe("draft");
  expect(view.replies[0].reply).toContain("Barbearia Norte");
});
