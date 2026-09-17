import { test, expect } from "@playwright/test";
import { login, seedClientWithDelivery, skipOnboarding } from "./helpers";

test("client approval creates a post draft, notifies the agency and shows the timeline", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  // regras visíveis em Configurações: liga WhatsApp com número + canal "conectado" (sessão)
  await page.goto("/settings");
  await page.getByTestId("rule-phone").fill("5511999999999");
  await page.getByTestId("rules-save").click();
  await expect(page.getByText("Aplicado ✓").first()).toBeVisible();
  await page.request.post("/api/messaging/connections", {
    data: { channel: "whatsapp", mode: "session", apiToken: "", apiAccountId: "", sessionReady: true },
  });

  const { client, project } = await seedClientWithDelivery(page.request, "Approvco");
  await page.request.patch(`/api/projects/${project.id}`, { data: { status: "client_approval" } });

  // o cliente aprova no portal
  await login(page, client.login.username, client.login.password);
  await skipOnboarding(page);
  await page.goto(`/portal/client/${client.id}`);
  await expect(page.getByTestId("portal-deliverable")).toBeVisible();
  await page.getByTestId("approve-deliverable").click();
  const timeline = page.getByTestId("approval-timeline");
  await expect(timeline).toBeVisible();
  await expect(timeline.locator('[data-action="post_draft"]')).toBeVisible();
  await expect(timeline.locator('[data-action="whatsapp"]')).toBeVisible();
  await expect(timeline.locator('[data-action="project_approved"]')).toBeVisible();

  // o que a aprovação deixou para trás: rascunho com a peça anexada, fila de WhatsApp, demanda aprovada
  const posts = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  const draft = posts.find((p: { status: string }) => p.status === "draft");
  expect(draft).toBeTruthy();
  expect(draft.channel).toBe("Instagram");
  expect(draft.deliverableId).toBeTruthy();
  const detail = await (await page.request.get(`/api/projects/${project.id}`)).json();
  expect(detail.status).toBe("approved");
  expect(detail.deliverables[0].approvalStatus).toBe("approved");

  // a agência vê o aviso na fila do WhatsApp e no sino
  await login(page, "agencia");
  const outbox = await (await page.request.get("/api/messaging/outbox")).json();
  expect(outbox.outbox.some((m: { toAddress: string; body: string }) => m.toAddress === "5511999999999" && m.body.includes("Approvco aprovou"))).toBe(true);
  const activities = await (await page.request.get("/api/activities?audience=agency")).json();
  expect(activities.some((a: { text: string }) => a.text.includes("Approvco aprovou"))).toBe(true);

  // aprovar de novo não repete as ações
  const again = await page.request.post(`/api/deliverables/${detail.deliverables[0].id}/approval`, { data: { decision: "approved" } });
  expect(again.status()).toBe(200);
  const postsAfter = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  expect(postsAfter.filter((p: { status: string }) => p.status === "draft")).toHaveLength(1);
});

test("a client cannot decide another client's deliverable", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const a = await seedClientWithDelivery(page.request, "Owner Co");
  const b = await seedClientWithDelivery(page.request, "Other Co");
  await login(page, b.client.login.username, b.client.login.password);
  await skipOnboarding(page);
  const denied = await page.request.post(`/api/deliverables/${a.deliverable.id}/approval`, { data: { decision: "approved" } });
  expect(denied.status()).toBe(403);
});
