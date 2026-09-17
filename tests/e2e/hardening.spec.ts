import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { login, signupViaApi } from "./helpers";

// Endurecimento do lançamento: cada teste reproduz um furo achado na revisão
// adversária e prova que ele fechou (com a cobrança global DESLIGADA, como no
// primeiro boot de produção).

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>');

let ipSeq = 0;
const nextIp = () => `203.0.113.${(++ipSeq % 200) + 20}`;

async function newAgency(browser: Browser, name: string) {
  const context = await browser.newContext();
  const account = await signupViaApi(context.request, "agency", name, {}, nextIp());
  await context.request.post("/api/onboarding", { data: { completed: true, event: "e2e_skip" } });
  return { context, request: context.request, account };
}

async function newClient(request: APIRequestContext, name: string) {
  const res = await request.post("/api/clients", { data: { name, industry: "café", channels: ["Instagram"], country: "Brasil" } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; login: { username: string; password: string } };
}

test("an SVG with a script is never served as an image, not even on the public page", async ({ browser }) => {
  const agency = await newAgency(browser, "Agência Vetor");
  const client = await newClient(agency.request, "Marca Vetor");
  const svg = await agency.request.post(`/api/clients/${client.id}/assets`, {
    multipart: { kind: "brand", file: { name: "logo.svg", mimeType: "image/svg+xml", buffer: SVG } },
  });
  expect(svg.status()).toBe(201);
  const svgAsset = await svg.json();
  expect(svgAsset.mime).toBe("application/octet-stream");
  // arquivo disfarçado de PNG também não passa por imagem
  const fake = await (
    await agency.request.post(`/api/clients/${client.id}/assets`, {
      multipart: { kind: "brand", file: { name: "logo.png", mimeType: "image/png", buffer: SVG } },
    })
  ).json();
  expect(fake.mime).toBe("application/octet-stream");

  const page = await (
    await agency.request.put("/api/agency-page", {
      data: { config: { published: true, showClients: true, headline: "Vetores" }, showcaseClientIds: [client.id] },
    })
  ).json();
  const slug = page.config.slug as string;
  const anonymous = await browser.newContext();
  const logo = await anonymous.request.get(`/api/a/${slug}/logo/${client.id}`);
  expect(logo.status()).toBe(404);

  const download = await agency.request.get(`/api/assets/${svgAsset.id}`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("application/octet-stream");
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(download.headers()["content-security-policy"]).toContain("sandbox");
  expect(download.headers()["x-content-type-options"]).toBe("nosniff");

  // um PNG de verdade vira o logo público, também em sandbox
  expect(
    (
      await agency.request.post(`/api/clients/${client.id}/assets`, {
        multipart: { kind: "brand", file: { name: "logo.png", mimeType: "image/png", buffer: PNG } },
      })
    ).status()
  ).toBe(201);
  const real = await anonymous.request.get(`/api/a/${slug}/logo/${client.id}`);
  expect(real.status()).toBe(200);
  expect(real.headers()["content-type"]).toBe("image/png");
  expect(real.headers()["content-security-policy"]).toContain("sandbox");

  // entrega com bytes que não são imagem: recusada
  const project = await (
    await agency.request.post("/api/projects", { data: { clientId: client.id, title: "Posts", mode: "internal" } })
  ).json();
  const bad = await agency.request.post(`/api/projects/${project.id}/deliverables`, {
    multipart: { title: "falsa", file: { name: "x.png", mimeType: "image/png", buffer: SVG } },
  });
  expect(bad.status()).toBe(400);
  await anonymous.close();
  await agency.context.close();
});

test("a managed brand cannot flip itself to self-serve, delete the agency's work or buy plans", async ({ browser }) => {
  const agency = await newAgency(browser, "Agência Guarda");
  const client = await newClient(agency.request, "Marca Guardada");
  const project = await (
    await agency.request.post("/api/projects", { data: { clientId: client.id, title: "Campanha de verão", mode: "internal" } })
  ).json();

  const brandContext = await browser.newContext();
  const brand = brandContext.request;
  const signIn = await brand.post("/api/auth/login", { data: { username: client.login.username, password: client.login.password } });
  expect(signIn.status()).toBe(200);
  // senha provisória: nada funciona antes da troca
  const blocked = await brand.get(`/api/clients/${client.id}`);
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe("must_change_password");
  const changed = await brand.post("/api/account/password", { data: { current: client.login.password, next: "senha-nova-da-marca" } });
  expect(changed.status()).toBe(200);

  const view = await (await brand.get(`/api/clients/${client.id}`)).json();
  expect(view.canChooseMode).toBe(false);
  expect((await brand.post(`/api/clients/${client.id}/mode`, { data: { selfServe: true } })).status()).toBe(403);
  expect((await brand.delete(`/api/projects/${project.id}`)).status()).toBe(403);
  expect((await brand.post(`/api/clients/${client.id}/report`, { data: { month: "2026-09" } })).status()).toBe(403);
  expect((await agency.request.get(`/api/projects/${project.id}`)).status()).toBe(200);

  // nada para comprar: a agência paga a IA da marca
  const checkout = await brand.post("/api/billing/checkout", { data: { kind: "coins", packId: "pack_100" } });
  expect(checkout.status()).toBe(403);
  expect((await checkout.json()).code).toBe("not_for_sale");
  expect((await (await brand.get("/api/billing")).json()).purchaseBlocked).toBeTruthy();

  // marca que entrou por convite da agência também é da agência
  const invite = (await (await agency.request.post("/api/invites", { data: { role: "client" } })).json()).invite;
  const invitedContext = await browser.newContext();
  const invited = await signupViaApi(invitedContext.request, "client", "Marca Convidada", { token: invite.token }, nextIp());
  const invitedId = invited.home.match(/\/portal\/client\/([^/?]+)/)?.[1] ?? "";
  const invitedClient = await (await invitedContext.request.get(`/api/clients/${invitedId}`)).json();
  expect(invitedClient.source).toBe("agency");
  expect(invitedClient.canChooseMode).toBe(false);
  expect((await invitedContext.request.post(`/api/clients/${invitedId}/mode`, { data: { selfServe: true } })).status()).toBe(403);

  // marca que se cadastrou sozinha escolhe o próprio modo
  const selfContext = await browser.newContext();
  const selfServe = await signupViaApi(selfContext.request, "client", "Marca Solo", {}, nextIp());
  const selfId = selfServe.home.match(/\/portal\/client\/([^/?]+)/)?.[1] ?? "";
  expect((await selfContext.request.post(`/api/clients/${selfId}/mode`, { data: { selfServe: false } })).status()).toBe(200);
  expect((await selfContext.request.post(`/api/clients/${selfId}/mode`, { data: { selfServe: true } })).status()).toBe(200);

  for (const c of [brandContext, invitedContext, selfContext, agency.context]) await c.close();
});

test("with the global switch off, a free agency still stops at zero coins", async ({ browser }) => {
  const agency = await newAgency(browser, "Agência Sem Cota");
  const billing = await (await agency.request.get("/api/billing")).json();
  expect(billing.enforced).toBe(true); // plano grátis: bloqueio sempre ligado
  expect(billing.subscription.planId).toBe("agency_free");
  const client = await newClient(agency.request, "Marca Sem Cota");
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await agency.request.post("/api/generate", { data: { clientId: client.id, type: "strategy_analysis", params: {} } });
    statuses.push(res.status());
    if (res.status() === 402) {
      expect((await res.json()).code).toBe("no_coins");
      break;
    }
  }
  expect(statuses).toContain(402);
  const after = await (await agency.request.get("/api/billing")).json();
  expect(after.wallet.coins).toBeGreaterThanOrEqual(0);
  await agency.context.close();
});

test("freelancers see only a public view of open demands; foreign agencies see no freelancer contact or cost", async ({ browser }) => {
  const owner = await newAgency(browser, "Agência Dona da Vaga");
  const client = await newClient(owner.request, "Marca da Vaga");
  const project = await (
    await owner.request.post("/api/projects", {
      data: { clientId: client.id, title: "Ensaio de produto", brief: "Fotos de 12 produtos", skillsNeeded: ["fotografia"], mode: "marketplace" },
    })
  ).json();
  const proContext = await browser.newContext();
  const pro = await signupViaApi(proContext.request, "professional", "Foto Curiosa", { location: "SP" }, nextIp());
  const match = await owner.request.post(`/api/projects/${project.id}/match`, { data: {} });
  expect(match.status(), await match.text()).toBe(200);
  const proId = pro.home.match(/\/professionals\/([^/?]+)/)?.[1] ?? "";
  const profile = await (await proContext.request.get(`/api/professionals/${proId}`)).json();
  const opportunity = profile.opportunities.find((o: { id: string }) => o.id === project.id);
  expect(opportunity).toBeTruthy();
  expect(Object.keys(opportunity).sort()).toEqual(
    ["agencyName", "brief", "budget", "createdAt", "deadline", "id", "location", "mode", "skillsNeeded", "status", "title"].sort()
  );
  expect(opportunity.agencyName).toBe("Agência Dona da Vaga");
  for (const hidden of ["matchResult", "sketch", "clientId", "professionalId", "agencyId"]) expect(opportunity).not.toHaveProperty(hidden);
  // o próprio profissional vê o próprio contato
  expect(profile.email).toBe(pro.email);

  const rival = await newAgency(browser, "Agência Curiosa");
  const seen = (await (await rival.request.get("/api/professionals")).json()) as Record<string, unknown>[];
  const row = seen.find((p) => p.id === proId)!;
  expect(row).toBeTruthy();
  expect(row.email).toBe("");
  expect(row.phone).toBe("");
  expect(row).not.toHaveProperty("hourlyCost");
  const detail = await (await rival.request.get(`/api/professionals/${proId}`)).json();
  expect(detail.email).toBe("");
  expect(detail).not.toHaveProperty("hourlyCost");

  // depois da candidatura, a agência da vaga vê o contato (custo continua oculto)
  expect((await proContext.request.post(`/api/projects/${project.id}/applications`, { data: { message: "Tenho experiência." } })).status()).toBe(201);
  const ownerView = ((await (await owner.request.get("/api/professionals")).json()) as Record<string, unknown>[]).find((p) => p.id === proId)!;
  expect(ownerView.email).toBe(pro.email);
  expect(ownerView).not.toHaveProperty("hourlyCost");

  for (const c of [proContext, owner.context, rival.context]) await c.close();
});

test("a single-use invite and a proposal can each be used once, even concurrently", async ({ browser }) => {
  const agency = await newAgency(browser, "Agência Corrida");
  const invite = (await (await agency.request.post("/api/invites", { data: { role: "agency" } })).json()).invite;
  const racers = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  const results = await Promise.all(
    racers.map((ctx, i) =>
      ctx.request.post("/api/auth/register", {
        data: { name: `Corredor ${i}`, email: `corredor.${Date.now()}.${i}@example.com`, password: "senha-forte-123", acceptTerms: true, token: invite.token },
        headers: { "x-forwarded-for": nextIp() },
      })
    )
  );
  expect(results.map((r) => r.status()).filter((s) => s === 201)).toHaveLength(1);

  const prospect = await (await agency.request.post("/api/prospects/manual", { data: { name: "Prospect Corrida", segment: "café" } })).json();
  const proposal = (await (await agency.request.post(`/api/prospects/${prospect.id}/proposal`, { data: { services: "social media" } })).json()).proposal;
  const packageName = proposal.content.packages[0].name as string;
  const accepts = await Promise.all(
    [0, 1, 2].map(() =>
      racers[0].request.post(`/api/proposals/${proposal.token}/accept`, { data: { packageName, name: "Ana Corrida", contact: "ana@example.com" } })
    )
  );
  expect(accepts.map((r) => r.status()).sort()).toEqual([201, 409, 409]);
  const clients = (await (await agency.request.get("/api/clients")).json()) as { name: string }[];
  expect(clients.filter((c) => c.name === "Prospect Corrida")).toHaveLength(1);
  for (const c of [...racers, agency.context]) await c.close();
});

test("a WhatsApp or Instagram id belongs to one agency only", async ({ browser }) => {
  const first = await newAgency(browser, "Agência Número Um");
  const second = await newAgency(browser, "Agência Número Dois");
  const id = `PN-UNICO-${Date.now()}`;
  const save = (request: APIRequestContext) =>
    request.post("/api/messaging/connections", { data: { channel: "whatsapp", mode: "api", apiToken: "tok", apiAccountId: id } });
  expect((await save(first.request)).status()).toBe(201);
  const clash = await save(second.request);
  expect(clash.status()).toBe(409);
  const client = await newClient(second.request, "Marca Número Dois");
  const attendant = await second.request.put(`/api/clients/${client.id}/attendant`, { data: { mode: "draft", phoneNumberId: id, apiToken: "tok" } });
  expect(attendant.status()).toBe(409);
  // o dono pode salvar de novo
  expect((await save(first.request)).status()).toBe(201);
  for (const c of [first.context, second.context]) await c.close();
});

test("a new agency's public page stays out of Google until the admin approves it", async ({ browser, page }) => {
  const agency = await newAgency(browser, "Agência Moderada");
  const config = (await (await agency.request.put("/api/agency-page", { data: { config: { published: true, headline: "Moderada" } } })).json()).config;
  const slug = config.slug as string;
  const anonymous = await browser.newContext();
  const html = await (await anonymous.request.get(`/a/${slug}`)).text();
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  expect(await (await anonymous.request.get("/sitemap.xml")).text()).not.toContain(`/a/${slug}<`);

  await login(page, "admin");
  const overview = await (await page.request.get("/api/admin/overview")).json();
  const row = overview.agencies.find((a: { slug: string }) => a.slug === slug);
  expect(row).toMatchObject({ pagePublished: true, pageIndexable: false });
  expect((await page.request.patch(`/api/admin/agencies/${row.id}`, { data: { pageIndexable: true } })).status()).toBe(200);
  expect(await (await anonymous.request.get("/sitemap.xml")).text()).toContain(`/a/${slug}<`);
  expect(await (await anonymous.request.get(`/a/${slug}`)).text()).toMatch(/<meta name="robots" content="index, follow"/);
  // denúncia: o admin despublica
  expect((await page.request.patch(`/api/admin/agencies/${row.id}`, { data: { unpublish: true } })).status()).toBe(200);
  expect((await anonymous.request.get(`/a/${slug}`)).status()).toBe(404);
  // só o admin modera
  expect((await agency.request.patch(`/api/admin/agencies/${row.id}`, { data: { pageIndexable: true } })).status()).toBe(403);
  for (const c of [anonymous, agency.context]) await c.close();
});
