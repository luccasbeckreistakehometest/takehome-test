import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { login, seedClientWithDelivery, signupViaApi } from "./helpers";

// Multi-agência: duas agências novas (cadastro público) com workspaces
// isolados. Nenhuma lista, abre, edita ou apaga o que é da outra — nem
// chamando a API direto com ids alheios (IDOR).

const NOT_VISIBLE = [403, 404];

type Seeded = {
  clientId: string;
  projectId: string;
  deliverableId: string;
  prospectId: string;
  proposalToken: string;
  contactId: string;
  listId: string;
  meetingId: string;
  entryId: string;
  inviteId: string;
  postId: string;
  slug: string;
};

async function newAgency(browser: Browser, name: string, ip: string) {
  const context = await browser.newContext();
  const account = await signupViaApi(context.request, "agency", name, {}, ip);
  await context.request.post("/api/onboarding", { data: { completed: true, event: "e2e_skip" } });
  return { context, request: context.request, account };
}

// Um pouco de tudo na agência A.
async function seedAgency(request: APIRequestContext, label: string): Promise<Seeded> {
  const { client, project, deliverable } = await seedClientWithDelivery(request, `Cliente ${label}`);
  const prospect = await (await request.post("/api/prospects/manual", { data: { name: `Prospect ${label}`, segment: "café" } })).json();
  const proposalRes = await request.post(`/api/prospects/${prospect.id}/proposal`, { data: { services: "social media" } });
  expect(proposalRes.status(), await proposalRes.text()).toBe(201);
  const proposal = await proposalRes.json();
  const contact = (await (await request.post("/api/messaging/contacts", { data: { name: `Contato ${label}`, phone: "5511988887777" } })).json()).contact;
  const list = (await (await request.post("/api/messaging/lists", { data: { name: `Lista ${label}`, channel: "whatsapp", contactIds: [contact.id] } })).json()).list;
  const meeting = await (await request.post("/api/meetings", { data: { title: `Reunião ${label}`, scheduledAt: "2099-01-10T10:00", clientId: client.id } })).json();
  const entry = (await (await request.post("/api/time-entries", { data: { action: "manual", clientId: client.id, minutes: 30, note: label } })).json()).entry;
  const invite = (await (await request.post("/api/invites", { data: { role: "client", note: label } })).json()).invite;
  const post = await (
    await request.post("/api/scheduled-posts", {
      data: { clientId: client.id, title: `Post ${label}`, channel: "Instagram", caption: "oi", scheduledFor: "2099-01-11T10:00" },
    })
  ).json();
  const month = new Date().toISOString().slice(0, 7);
  expect((await request.post(`/api/clients/${client.id}/report`, { data: { month } })).status()).toBe(201);
  expect((await request.post(`/api/clients/${client.id}/account-messages`, { data: { text: `Oi ${label}` } })).status()).toBe(201);
  const page = await (await request.put("/api/agency-page", { data: { config: { published: true, headline: `Página ${label}` } } })).json();
  return {
    clientId: client.id,
    projectId: project.id,
    deliverableId: deliverable.id,
    prospectId: prospect.id,
    proposalToken: proposal.proposal.token,
    contactId: contact.id,
    listId: list.id,
    meetingId: meeting.id,
    entryId: entry.id,
    inviteId: invite.id,
    postId: post.id,
    slug: page.config.slug,
  };
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

test("a new agency gets its own empty workspace, brand, wallet and plan", async ({ browser }) => {
  const norte = await newAgency(browser, "Agência Norte", "198.51.100.10");
  expect(norte.account.role).toBe("agency");
  expect(norte.account.home).toMatch(/^\/\?welcome=1$/);
  const settings = await (await norte.request.get("/api/settings")).json();
  expect(settings.agencyName).toBe("Agência Norte");
  expect(settings.agencySlug).toBe("agencia-norte");
  expect(await (await norte.request.get("/api/clients")).json()).toEqual([]);
  expect((await (await norte.request.get("/api/prospects")).json()).prospects).toEqual([]);
  expect((await (await norte.request.get("/api/messaging/contacts")).json()).contacts).toEqual([]);
  expect(await (await norte.request.get("/api/meetings")).json()).toEqual([]);
  const overview = await (await norte.request.get("/api/agency/overview")).json();
  expect(overview.clients).toEqual([]);
  const billing = await (await norte.request.get("/api/billing")).json();
  expect(billing.accountType).toBe("agency");
  expect(billing.plan.id).toBe("agency_free");
  expect(billing.wallet.coins).toBe(60);
  // a casa segue com os dados e o nome dela
  const house = await browser.newContext();
  const housePage = await house.newPage();
  await login(housePage, "agencia");
  const houseSettings = await (await house.request.get("/api/settings")).json();
  expect(houseSettings.agencyName).not.toBe("Agência Norte");
  expect(houseSettings.agencyId).toBe("agency");
  await house.close();
  await norte.context.close();
});

test("two agencies cannot list, open, edit or delete each other's data (including direct API calls)", async ({ browser }) => {
  const a = await newAgency(browser, "Agência Leste", "198.51.100.11");
  const b = await newAgency(browser, "Agência Oeste", "198.51.100.12");
  const seeded = await seedAgency(a.request, "Leste");
  const own = await seedAgency(b.request, "Oeste");
  const B = b.request;

  // ---- listas: nada da agência A aparece para B ----
  const clients = await (await B.get("/api/clients")).json();
  expect(ids(clients)).toEqual([own.clientId]);
  expect(ids(await (await B.get("/api/projects")).json())).not.toContain(seeded.projectId);
  expect(ids((await (await B.get("/api/prospects")).json()).prospects)).not.toContain(seeded.prospectId);
  expect(ids((await (await B.get("/api/messaging/contacts")).json()).contacts)).not.toContain(seeded.contactId);
  expect(ids((await (await B.get("/api/messaging/lists")).json()).lists)).not.toContain(seeded.listId);
  expect((await (await B.get("/api/messaging/outbox")).json()).outbox.every((m: { contactId: string }) => m.contactId !== seeded.contactId)).toBe(true);
  expect(ids(await (await B.get("/api/meetings")).json())).not.toContain(seeded.meetingId);
  expect(ids((await (await B.get("/api/invites")).json()).invites)).not.toContain(seeded.inviteId);
  expect(ids(await (await B.get("/api/scheduled-posts")).json())).not.toContain(seeded.postId);
  expect(ids((await (await B.get("/api/time-entries")).json()).entries)).not.toContain(seeded.entryId);
  const search = await (await B.get("/api/search?q=Leste")).json();
  expect(search).toEqual([]);
  const insights = await (await B.get("/api/insights")).json();
  expect(insights.clients.map((c: { id: string }) => c.id)).toEqual([own.clientId]);
  const overview = await (await B.get("/api/agency/overview")).json();
  expect(ids(overview.clients)).toEqual([own.clientId]);
  const pulse = await (await B.get("/api/pulse/overview")).json();
  expect(ids(pulse.clients)).toEqual([own.clientId]);
  const margin = await (await B.get("/api/finance/margin")).json();
  expect(margin.rows.every((r: { clientId: string }) => r.clientId !== seeded.clientId)).toBe(true);
  const activities = await (await B.get("/api/activities")).json();
  expect(activities.every((x: { clientId: string | null }) => x.clientId !== seeded.clientId)).toBe(true);
  const page = await (await B.get("/api/agency-page")).json();
  expect(page.leads).toEqual([]);
  expect(page.clients.map((c: { id: string }) => c.id)).toEqual([own.clientId]);
  expect(page.portfolio.every((p: { id: string }) => p.id !== seeded.deliverableId)).toBe(true);

  // ---- abrir/editar/apagar pelo id da outra agência ----
  const month = new Date().toISOString().slice(0, 7);
  const calls: [string, () => Promise<{ status(): number }>][] = [
    ["GET client", () => B.get(`/api/clients/${seeded.clientId}`)],
    ["PUT client", () => B.put(`/api/clients/${seeded.clientId}`, { data: { name: "Hack", channels: [] } })],
    ["DELETE client", () => B.delete(`/api/clients/${seeded.clientId}`)],
    ["mode", () => B.post(`/api/clients/${seeded.clientId}/mode`, { data: { selfServe: true } })],
    ["dashboard", () => B.get(`/api/clients/${seeded.clientId}/dashboard`)],
    ["generations", () => B.get(`/api/generations?clientId=${seeded.clientId}`)],
    ["generate", () => B.post("/api/generate", { data: { clientId: seeded.clientId, type: "strategy_analysis", params: {} } })],
    ["report GET", () => B.get(`/api/clients/${seeded.clientId}/report?month=${month}`)],
    ["report POST", () => B.post(`/api/clients/${seeded.clientId}/report`, { data: { month } })],
    ["account messages GET", () => B.get(`/api/clients/${seeded.clientId}/account-messages`)],
    ["account messages POST", () => B.post(`/api/clients/${seeded.clientId}/account-messages`, { data: { text: "oi" } })],
    ["assets", () => B.get(`/api/clients/${seeded.clientId}/assets`)],
    ["attendant GET", () => B.get(`/api/clients/${seeded.clientId}/attendant`)],
    ["attendant PUT", () => B.put(`/api/clients/${seeded.clientId}/attendant`, { data: { mode: "auto" } })],
    ["attendant inbound", () => B.post(`/api/clients/${seeded.clientId}/attendant/inbound`, { data: { fromAddress: "5511911112222", body: "oi" } })],
    ["finance GET", () => B.get(`/api/clients/${seeded.clientId}/finance`)],
    ["finance PUT", () => B.put(`/api/clients/${seeded.clientId}/finance`, { data: { monthlyFee: 1 } })],
    ["pulse", () => B.get(`/api/clients/${seeded.clientId}/pulse`)],
    ["campaigns", () => B.get(`/api/clients/${seeded.clientId}/campaigns`)],
    ["brand voice", () => B.get(`/api/clients/${seeded.clientId}/brand-voice`)],
    ["sales", () => B.get(`/api/clients/${seeded.clientId}/sales`)],
    ["connections", () => B.get(`/api/clients/${seeded.clientId}/connections`)],
    ["webhook token", () => B.get(`/api/clients/${seeded.clientId}/webhook-token`)],
    ["learnings", () => B.get(`/api/clients/${seeded.clientId}/learnings?month=${month}`)],
    ["project GET", () => B.get(`/api/projects/${seeded.projectId}`)],
    ["project PATCH", () => B.patch(`/api/projects/${seeded.projectId}`, { data: { title: "Hack" } })],
    ["project DELETE", () => B.delete(`/api/projects/${seeded.projectId}`)],
    ["project new (foreign client)", () => B.post("/api/projects", { data: { clientId: seeded.clientId, title: "x", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "" } })],
    ["project messages", () => B.get(`/api/projects/${seeded.projectId}/messages`)],
    ["project deliverables", () => B.get(`/api/projects/${seeded.projectId}/deliverables`)],
    ["project applications", () => B.get(`/api/projects/${seeded.projectId}/applications`)],
    ["apply as agency", () => B.post(`/api/projects/${seeded.projectId}/applications`, { data: { message: "x" } })],
    ["project meetings", () => B.post(`/api/projects/${seeded.projectId}/meetings`, { data: { title: "x", scheduledAt: "2099-01-01T10:00" } })],
    ["file", () => B.get(`/api/files/${seeded.deliverableId}`)],
    ["deliverable DELETE", () => B.delete(`/api/deliverables/${seeded.deliverableId}`)],
    ["approval GET", () => B.get(`/api/deliverables/${seeded.deliverableId}/approval`)],
    ["approval POST", () => B.post(`/api/deliverables/${seeded.deliverableId}/approval`, { data: { decision: "approved" } })],
    ["comments GET", () => B.get(`/api/deliverables/${seeded.deliverableId}/comments`)],
    ["comments POST", () => B.post(`/api/deliverables/${seeded.deliverableId}/comments`, { data: { body: "oi" } })],
    ["annotations", () => B.get(`/api/deliverables/${seeded.deliverableId}/annotations`)],
    ["prospect PATCH", () => B.patch(`/api/prospects/${seeded.prospectId}`, { data: { status: "converted" } })],
    ["prospect DELETE", () => B.delete(`/api/prospects/${seeded.prospectId}`)],
    ["proposals GET", () => B.get(`/api/prospects/${seeded.prospectId}/proposal`)],
    ["proposal POST", () => B.post(`/api/prospects/${seeded.prospectId}/proposal`, { data: {} })],
    ["contact DELETE", () => B.delete(`/api/messaging/contacts?id=${seeded.contactId}`)],
    ["contact on foreign client", () => B.post("/api/messaging/contacts", { data: { name: "x", phone: "5511900000000", clientId: seeded.clientId } })],
    ["list DELETE", () => B.delete(`/api/messaging/lists?id=${seeded.listId}`)],
    ["send to foreign list", () => B.post("/api/messaging/outbox", { data: { channel: "whatsapp", body: "spam", listId: seeded.listId } })],
    ["draft for foreign client", () => B.post("/api/messaging/draft", { data: { channel: "whatsapp", goal: "oi", clientId: seeded.clientId } })],
    ["meeting PATCH", () => B.patch(`/api/meetings/${seeded.meetingId}`, { data: { title: "Hack" } })],
    ["meeting DELETE", () => B.delete(`/api/meetings/${seeded.meetingId}`)],
    ["meeting on foreign client", () => B.post("/api/meetings", { data: { title: "x", scheduledAt: "2099-01-01T10:00", clientId: seeded.clientId } })],
    ["time entries of foreign client", () => B.get(`/api/time-entries?clientId=${seeded.clientId}`)],
    ["time entry PATCH", () => B.patch(`/api/time-entries/${seeded.entryId}`, { data: { note: "Hack" } })],
    ["time entry DELETE", () => B.delete(`/api/time-entries/${seeded.entryId}`)],
    ["time entry on foreign client", () => B.post("/api/time-entries", { data: { action: "manual", clientId: seeded.clientId, minutes: 5 } })],
    ["invite DELETE", () => B.delete(`/api/invites?id=${seeded.inviteId}`)],
    ["post PATCH", () => B.patch(`/api/scheduled-posts/${seeded.postId}`, { data: { status: "canceled" } })],
    ["post DELETE", () => B.delete(`/api/scheduled-posts/${seeded.postId}`)],
    ["post on foreign client", () => B.post("/api/scheduled-posts", { data: { clientId: seeded.clientId, title: "x", channel: "Instagram", scheduledFor: "2099-01-01T10:00" } })],
    ["ideas for foreign client", () => B.post("/api/ideas", { data: { audience: "client", targetId: seeded.clientId } })],
    ["fees of foreign client", () => B.put("/api/finance/settings", { data: { clientFees: [{ clientId: seeded.clientId, monthlyFee: 1 }] } })],
    ["page slug of the other agency", () => B.put("/api/agency-page", { data: { config: { slug: seeded.slug } } })],
  ];
  for (const [name, call] of calls) {
    const response = await call();
    const status = response.status();
    if (name === "page slug of the other agency") expect(status, name).toBe(409);
    else if (name === "send to foreign list") expect(status, name).toBe(404);
    else expect(NOT_VISIBLE, `${name} → ${status}`).toContain(status);
  }
  // envio com ids de contatos alheios não enfileira nada
  const spam = await B.post("/api/messaging/outbox", { data: { channel: "whatsapp", body: "spam", contactIds: [seeded.contactId] } });
  expect(spam.status()).toBe(400);

  // ---- tudo continua intacto na agência A ----
  const A = a.request;
  const client = await (await A.get(`/api/clients/${seeded.clientId}`)).json();
  expect(client.name).toBe("Cliente Leste");
  const project = await (await A.get(`/api/projects/${seeded.projectId}`)).json();
  expect(project.title).toBe("Posts do feed");
  expect(project.deliverables.map((d: { id: string; approvalStatus: string }) => [d.id, d.approvalStatus])).toEqual([[seeded.deliverableId, "pending"]]);
  expect(ids((await (await A.get("/api/prospects")).json()).prospects)).toContain(seeded.prospectId);
  expect(ids((await (await A.get("/api/messaging/contacts")).json()).contacts)).toContain(seeded.contactId);
  expect(ids((await (await A.get("/api/messaging/lists")).json()).lists)).toContain(seeded.listId);
  expect(ids(await (await A.get("/api/meetings")).json())).toContain(seeded.meetingId);
  const invites = (await (await A.get("/api/invites")).json()).invites as { id: string; status: string }[];
  expect(invites.find((i) => i.id === seeded.inviteId)?.status).toBe("pending");
  const posts = (await (await A.get("/api/scheduled-posts")).json()) as { id: string; status: string }[];
  expect(posts.find((p) => p.id === seeded.postId)?.status).toBe("scheduled");
  expect(ids((await (await A.get("/api/time-entries")).json()).entries)).toContain(seeded.entryId);
  expect((await (await A.get("/api/settings")).json()).agencyName).toBe("Agência Leste");

  // ---- configurações: cada uma muda só a própria marca ----
  const put = await B.put("/api/settings", { data: { agencyName: "Oeste Renomeada", tagline: "", accentColor: "#0a0a0a" } });
  expect((await put.json()).agencyName).toBe("Oeste Renomeada");
  expect((await (await A.get("/api/settings")).json()).agencyName).toBe("Agência Leste");
  const rules = await (await B.put("/api/automation/approval", { data: { notifyPhone: "5521977776666" } })).json();
  expect(rules.rules.notifyPhone).toBe("5521977776666");
  expect((await (await A.get("/api/automation/approval")).json()).rules.notifyPhone).not.toBe("5521977776666");

  // ---- proposta pública: marca da agência que enviou ----
  const publicProposal = await (await A.get(`/api/proposals/${seeded.proposalToken}`)).json();
  expect(publicProposal.agency.name).toBe("Agência Leste");

  await a.context.close();
  await b.context.close();
});

test("public pages, leads, invites and the admin filter stay per agency", async ({ browser, page }) => {
  const sol = await newAgency(browser, "Estúdio Sol", "198.51.100.13");
  const lua = await newAgency(browser, "Estúdio Lua", "198.51.100.14");
  await sol.request.put("/api/settings", { data: { agencyName: "Estúdio Sol", tagline: "marcas com luz própria", accentColor: "#ff9900" } });
  const solPage = (await (await sol.request.put("/api/agency-page", { data: { config: { published: true, headline: "Sol na sua marca" } } })).json()).config;
  const luaPage = (await (await lua.request.put("/api/agency-page", { data: { config: { published: true, headline: "Lua na sua marca" } } })).json()).config;
  expect(solPage.slug).toBe("estudio-sol");
  expect(luaPage.slug).toBe("estudio-lua");

  // cada endereço mostra a própria agência
  await page.goto(`/a/${solPage.slug}`);
  await expect(page.getByTestId("agency-headline")).toHaveText("Sol na sua marca");
  await expect(page.getByTestId("agency-page")).toContainText("Estúdio Sol");
  await expect(page.getByTestId("agency-page")).not.toContainText("Estúdio Lua");
  await page.goto(`/a/${luaPage.slug}`);
  await expect(page.getByTestId("agency-headline")).toHaveText("Lua na sua marca");

  // lead da página do Sol vira prospect só do Sol
  const lead = await page.request.post(`/api/a/${solPage.slug}/lead`, {
    data: { name: "Dona Cida", whatsapp: "11987654321", need: "Quero vender bolo pelo Instagram", budgetBand: "ate-1k" },
    headers: { "x-forwarded-for": "198.51.100.15" },
  });
  expect(lead.status()).toBe(201);
  const solProspects = (await (await sol.request.get("/api/prospects")).json()).prospects as { name: string }[];
  const luaProspects = (await (await lua.request.get("/api/prospects")).json()).prospects as { name: string }[];
  expect(solProspects.map((p) => p.name)).toContain("Dona Cida");
  expect(luaProspects.map((p) => p.name)).not.toContain("Dona Cida");
  expect((await (await lua.request.get("/api/agency-page")).json()).leads).toEqual([]);

  // convite do Sol: quem entra é marca do Sol e vê a marca do Sol
  const invite = (await (await sol.request.post("/api/invites", { data: { role: "client", note: "Padaria" } })).json()).invite;
  const lookup = await (await page.request.get(`/api/invites/${invite.token}`)).json();
  expect(lookup.agency.name).toBe("Estúdio Sol");
  const brand = await browser.newContext();
  const joined = await signupViaApi(brand.request, "client", "Padaria da Cida", { token: invite.token }, "198.51.100.16");
  expect(joined.role).toBe("client");
  const me = await (await brand.request.get("/api/auth/me")).json();
  expect((await (await sol.request.get("/api/clients")).json()).map((c: { id: string }) => c.id)).toContain(me.refId);
  expect((await (await lua.request.get("/api/clients")).json()).map((c: { id: string }) => c.id)).not.toContain(me.refId);
  expect((await (await brand.request.get("/api/settings")).json()).agencyName).toBe("Estúdio Sol");
  const brandPage = await brand.newPage();
  await brandPage.goto(`/portal/client/${me.refId}`);
  await expect(brandPage.locator("header")).toContainText("Estúdio Sol");
  // a agência Lua não abre a marca do Sol
  expect(NOT_VISIBLE).toContain((await lua.request.get(`/api/clients/${me.refId}`)).status());
  await brand.close();

  // time: convite de agência entra na MESMA agência
  const teamInvite = (await (await sol.request.post("/api/invites", { data: { role: "agency" } })).json()).invite;
  const mate = await browser.newContext();
  await signupViaApi(mate.request, "agency", "Sócia do Sol", { token: teamInvite.token }, "198.51.100.17");
  const mateClients = await (await mate.request.get("/api/clients")).json();
  expect(mateClients.map((c: { id: string }) => c.id)).toContain(me.refId);
  expect((await (await mate.request.get("/api/settings")).json()).agencyId).toBe((await (await sol.request.get("/api/settings")).json()).agencyId);
  await mate.close();

  // admin vê tudo e filtra por agência
  await login(page, "admin");
  const all = await (await page.request.get("/api/admin/overview")).json();
  const solId = (await (await sol.request.get("/api/settings")).json()).agencyId as string;
  const agencyNames = all.agencies.map((x: { name: string }) => x.name);
  expect(agencyNames).toEqual(expect.arrayContaining(["Estúdio Sol", "Estúdio Lua"]));
  expect(all.clients.map((c: { id: string }) => c.id)).toContain(me.refId);
  const filtered = await (await page.request.get(`/api/admin/overview?agency=${solId}`)).json();
  expect(filtered.clients.map((c: { id: string }) => c.id)).toEqual([me.refId]);
  const users = (await (await page.request.get(`/api/admin/users?agency=${solId}`)).json()).users as { username: string; agencyId: string }[];
  expect(users.length).toBeGreaterThanOrEqual(3);
  expect(users.every((u) => u.agencyId === solId)).toBe(true);
  await page.goto("/admin");
  await page.getByTestId("admin-agency-filter").selectOption(solId);
  await expect(page.getByTestId("admin-agencies")).toContainText("Estúdio Sol");

  await sol.context.close();
  await lua.context.close();
});

test("agency signup through the form lands on its empty workspace with the welcome and first steps", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "198.51.100.18" } });
  const page = await context.newPage();
  await page.goto("/criar-conta?type=agency");
  await page.getByTestId("reg-name").fill("Agência Maré");
  await page.getByTestId("reg-email").fill(`agencia.mare.${Date.now()}@example.com`);
  await page.getByTestId("reg-password").fill("senha1234");
  await page.getByTestId("reg-terms").check();
  await page.getByTestId("reg-submit").click();
  await expect(page).toHaveURL(/\/\?welcome=1$/, { timeout: 20_000 });
  await expect(page.getByTestId("welcome")).toBeVisible();
  await expect(page.locator("header")).toContainText("Agência Maré");
  await expect(page.getByTestId("agency-empty-state")).toBeVisible();
  await expect(page.getByTestId("agency-empty-state")).toContainText("Cadastre o primeiro cliente");
  // o tour guiado começa depois do welcome
  for (let i = 0; i < 4; i++) await page.getByTestId("welcome-next").click();
  await expect(page.getByTestId("tour-step")).toHaveAttribute("data-step", "0");
  await context.close();
});
