import { test, expect } from "@playwright/test";
import { login, seedClientWithDelivery, skipOnboarding } from "./helpers";

// Aprovação por link, sem login: 3 posts + 1 entrega num link; o cliente
// aprova num navegador sem sessão; posts aprovados entram na agenda.
test("a logged-out client approves posts and a delivery from a link", async ({ page, browser }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client, project, deliverable } = await seedClientWithDelivery(page.request, "Linkco");
  await page.request.patch(`/api/projects/${project.id}`, { data: { status: "client_approval" } });
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const posts = [];
  for (const title of ["Post do cappuccino", "Post da torta", "Post do bairro"]) {
    const created = await page.request.post("/api/scheduled-posts", {
      data: { clientId: client.id, title, channel: "Instagram", caption: `${title} — venha provar`, scheduledFor: `${day}T10:00`, status: "draft" },
    });
    expect(created.status()).toBe(201);
    posts.push(await created.json());
  }

  // a agência gera o link pelo dashboard do cliente
  await page.goto(`/clients/${client.id}`);
  await page.getByTestId("approval-link-open").click();
  const dialog = page.getByTestId("approval-link-dialog");
  await expect(dialog.getByTestId("approval-candidate")).toHaveCount(4);
  for (const box of await dialog.getByTestId("approval-candidate").all()) await box.check();
  await dialog.getByTestId("approval-link-create").click();
  const url = (await dialog.getByTestId("approval-link-url").textContent())!.trim();
  expect(url).toMatch(/\/aprovar\/[A-Za-z0-9_-]{43}$/);
  await expect(dialog.getByTestId("approval-link-whatsapp")).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  const token = url.split("/aprovar/")[1];

  // cliente sem sessão
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`/aprovar/${token}`);
  await expect(guestPage).toHaveURL(new RegExp(`/aprovar/${token}$`));
  await expect(guestPage.getByTestId("approval-item")).toHaveCount(4);
  await expect(guestPage.getByTestId("approval-agency")).toBeVisible();
  await expect(guestPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await guestPage.getByTestId("approver-name").fill("Ana do Café");

  // aprova o primeiro post
  const first = guestPage.locator(`[data-testid="approval-item"][data-id="${posts[0].id}"]`);
  await first.getByTestId("item-approve").click();
  await expect(first).toHaveAttribute("data-decision", "approved");

  // pede ajuste no segundo (comentário obrigatório)
  const empty = await guest.request.post(`/api/approve/${token}`, { data: { kind: "post", id: posts[1].id, decision: "changes_requested", note: "" } });
  expect(empty.status()).toBe(400);
  const second = guestPage.locator(`[data-testid="approval-item"][data-id="${posts[1].id}"]`);
  await second.getByTestId("item-changes").click();
  await second.getByTestId("changes-note").fill("Trocar a foto por uma mais clara");
  await second.getByTestId("changes-send").click();
  await expect(second).toHaveAttribute("data-decision", "changes_requested");

  // item de outro cliente não entra por este link
  const other = await seedClientWithDelivery(page.request, "Outro Linkco");
  const foreign = await guest.request.post(`/api/approve/${token}`, { data: { kind: "deliverable", id: other.deliverable.id, decision: "approved" } });
  expect(foreign.status()).toBe(404);

  // aprovar tudo que falta: terceiro post + a entrega
  await guestPage.getByTestId("approve-all").click();
  await expect(guestPage.getByTestId("approval-all-done")).toBeVisible();

  // o que ficou gravado
  const after = await (await page.request.get(`/api/scheduled-posts?clientId=${client.id}`)).json();
  const byId = new Map(after.map((p: { id: string }) => [p.id, p]));
  expect(byId.get(posts[0].id)).toMatchObject({ status: "scheduled", clientApproval: "approved", clientApprovalBy: "Ana do Café" });
  expect(byId.get(posts[1].id)).toMatchObject({ status: "draft", clientApproval: "changes_requested", clientApprovalNote: "Trocar a foto por uma mais clara" });
  expect(byId.get(posts[2].id)).toMatchObject({ status: "scheduled", clientApproval: "approved" });
  const approval = await (await page.request.get(`/api/deliverables/${deliverable.id}/approval`)).json();
  expect(approval.approvalStatus).toBe("approved");
  expect(approval.events[0]).toMatchObject({ source: "link", approverName: "Ana do Café" });
  const activities = await (await page.request.get("/api/activities?audience=agency")).json();
  expect(activities.some((a: { text: string }) => a.text.includes("aprovou pelo link"))).toBe(true);

  // a agência vê o pedido de ajuste no calendário
  await page.goto("/calendar");
  await page.getByTestId("calendar-client").selectOption(client.id);

  // encerrar o link: a página mostra expirado e a decisão devolve 410
  const links = await (await page.request.get(`/api/approval-links?clientId=${client.id}`)).json();
  expect(links.links[0].viewCount).toBeGreaterThanOrEqual(1);
  expect((await page.request.patch(`/api/approval-links/${links.links[0].id}`)).status()).toBe(200);
  const closed = await guest.request.post(`/api/approve/${token}`, { data: { kind: "post", id: posts[1].id, decision: "approved" } });
  expect(closed.status()).toBe(410);
  await guestPage.goto(`/aprovar/${token}`);
  await expect(guestPage.getByTestId("approval-expired")).toBeVisible();
  // token inválido
  expect((await guest.request.get("/aprovar/nao-existe")).status()).toBe(404);
  await guest.close();
});

test("a client of another agency cannot list or create links", async ({ page }) => {
  await login(page, "agencia");
  await skipOnboarding(page);
  const { client } = await seedClientWithDelivery(page.request, "Guardco");
  await login(page, client.login.username, client.login.password);
  expect((await page.request.get(`/api/approval-links?clientId=${client.id}`)).status()).toBe(403);
  const created = await page.request.post("/api/approval-links", { data: { clientId: client.id, items: [{ kind: "post", id: "x" }] } });
  expect(created.status()).toBe(403);
});
