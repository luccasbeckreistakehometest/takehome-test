import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// Os módulos de dados com duas agências reais num banco descartável.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "marqa-scope-"));
delete (globalThis as { __agencyhubDb?: unknown }).__agencyhubDb;
const { db, createClient, listClients, clientAgencyId, createGeneration } = await import("../../lib/db");
const agencies = await import("../../lib/agencies");
const market = await import("../../lib/marketplace-db");
const messaging = await import("../../lib/messaging-db");
const invites = await import("../../lib/invites-db");
const pages = await import("../../lib/agency-page-db");
const proposals = await import("../../lib/proposals-db");
const finance = await import("../../lib/finance-db");
const approvals = await import("../../lib/approvals-db");
const billing = await import("../../lib/billing-db");
const { agencyScope, ALL_AGENCIES, HOUSE_AGENCY_ID, TENANT_TABLES } = await import("../../lib/tenancy-rules");
// Carrega todos os módulos que criam tabelas (banco novo).
await Promise.all([
  import("../../lib/auth"),
  import("../../lib/ai-spend"),
  import("../../lib/attendant-db"),
  import("../../lib/brand-voice-db"),
  import("../../lib/campaigns-db"),
  import("../../lib/comments-db"),
  import("../../lib/integrations-db"),
  import("../../lib/learnings-db"),
  import("../../lib/onboarding-db"),
  import("../../lib/pulse-db"),
  import("../../lib/reports-db"),
  import("../../lib/webhook-auth"),
]);

const A = agencies.createAgency({ name: "Agência Alfa", ownerUserId: null }).id;
const B = agencies.createAgency({ name: "Agência Beta", ownerUserId: null }).id;
const scopeA = agencyScope(A);
const scopeB = agencyScope(B);

const brand = (name: string, agencyId: string) =>
  createClient(
    {
      name,
      industry: "",
      description: "",
      audience: "",
      tone: "",
      goals: "",
      budget: "",
      channels: [],
      differentials: "",
      competitors: "",
      brandColors: "",
      website: "",
      instagram: "",
      notes: "",
      capabilities: "",
      language: "pt-BR",
      source: "agency",
      country: "Brasil",
      selfServe: false,
    },
    agencyId
  );

const clientA = brand("Padaria da Alfa", A);
const clientB = brand("Loja da Beta", B);
const projectA = market.createProject({ clientId: clientA.id, title: "Cardápio", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "" });
const projectB = market.createProject({ clientId: clientB.id, title: "Vitrine", brief: "", skillsNeeded: [], location: "", budget: "", deadline: "" });

describe("tenant scoping in the data layer", () => {
  it("house agency always exists", () => {
    expect(agencies.getAgency(HOUSE_AGENCY_ID)).not.toBeNull();
  });

  it("every agency-owned table of a brand-new database has agencyId", () => {
    const missing: string[] = [];
    for (const table of Object.keys(TENANT_TABLES)) {
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
      if (cols.length === 0) missing.push(`${table} (tabela não criada)`);
      else if (!cols.includes("agencyId")) missing.push(table);
    }
    expect(missing).toEqual([]);
  });

  it("brands and demands inherit and filter by agency", () => {
    expect(listClients(scopeA).map((c) => c.id)).toEqual([clientA.id]);
    expect(listClients(scopeB).map((c) => c.id)).toEqual([clientB.id]);
    expect(listClients(ALL_AGENCIES).map((c) => c.id)).toEqual(expect.arrayContaining([clientA.id, clientB.id]));
    expect(clientAgencyId(clientB.id)).toBe(B);
    expect(projectA.agencyId).toBe(A);
    expect(market.listProjects({ scope: scopeA }).map((p) => p.id)).toEqual([projectA.id]);
    // filtro por marca de outra agência não vaza nada
    expect(market.listProjects({ scope: scopeA, clientId: clientB.id })).toEqual([]);
    const deliverable = market.createDeliverable({ projectId: projectB.id, title: "arte", mime: "image/png" });
    expect((db.prepare("SELECT agencyId FROM deliverables WHERE id = ?").get(deliverable.id) as { agencyId: string }).agencyId).toBe(B);
    const generation = createGeneration({ clientId: clientA.id, type: "strategy_analysis", title: "x", params: {}, content: "{}" });
    expect((db.prepare("SELECT agencyId FROM generations WHERE id = ?").get(generation.id) as { agencyId: string }).agencyId).toBe(A);
    expect(() => brand("Sem agência", "")).toThrow();
  });

  it("prospects, contacts, lists and invites stay in their agency", () => {
    const prospect = market.createProspect(
      { searchQuery: "manual", name: "Café", segment: "", location: "", website: "", instagram: "", whyFit: "", marketingMaturity: "", suggestedApproach: "" },
      A
    );
    expect(market.listProspects(scopeB).find((p) => p.id === prospect.id)).toBeUndefined();
    expect(market.listProspects(scopeA).map((p) => p.id)).toContain(prospect.id);

    const contact = messaging.createContact({ agencyId: A, name: "Ana", phone: "5511999990000", instagram: "", clientId: null, tags: "", notes: "" });
    expect(messaging.listContacts(scopeB)).toEqual([]);
    expect(messaging.deleteContact(scopeB, contact.id)).toBe(false);
    // lista de B não pode levar contato de A; envio de B ignora contato de A
    const list = messaging.createBroadcastList({ agencyId: B, name: "L", channel: "whatsapp", contactIds: [contact.id] });
    expect(list.contactIds).toEqual([]);
    expect(messaging.enqueueMessages({ agencyId: B, channel: "whatsapp", mode: "api", body: "oi", contactIds: [contact.id] })).toEqual([]);
    expect(messaging.enqueueMessages({ agencyId: A, channel: "whatsapp", mode: "api", body: "oi", contactIds: [contact.id] })).toHaveLength(1);
    expect(messaging.listOutbox(scopeB)).toEqual([]);
    expect(messaging.deleteContact(scopeA, contact.id)).toBe(true);

    const invite = invites.createInvite({ agencyId: A, role: "client" });
    expect(invites.listInvites(scopeB)).toEqual([]);
    expect(invites.revokeInvite(scopeB, invite.id)).toBe(false);
    expect(invites.revokeInvite(scopeA, invite.id)).toBe(true);
  });

  it("each agency has its own WhatsApp connection and automation rules", () => {
    messaging.saveConnection({ agencyId: A, channel: "whatsapp", mode: "api", apiToken: "tok-a", apiAccountId: "111" });
    expect(messaging.getConnection(B, "whatsapp")).toBeUndefined();
    expect(messaging.findAgencyByAccountId("whatsapp", "111")).toBe(A);
    expect(approvals.whatsappConnected(A)).toBe(true);
    expect(approvals.whatsappConnected(B)).toBe(false);
    approvals.saveApprovalRules(B, { notifyPhone: "5521988887777", notifyWhatsapp: true });
    expect(approvals.getApprovalRules(A).notifyPhone).toBe("");
    expect(approvals.getApprovalRules(B).notifyPhone).toBe("5521988887777");
    finance.saveFinanceSettings(A, { defaultHourlyCost: 123 });
    expect(finance.getFinanceSettings(B).defaultHourlyCost).not.toBe(123);
  });

  it("public pages resolve the agency by slug and never mix portfolios", () => {
    const alfa = agencies.getAgency(A)!;
    expect(pages.saveAgencyPage(A, { published: true, headline: "Alfa" })).toMatchObject({ ok: true });
    const clash = pages.saveAgencyPage(B, { slug: alfa.slug });
    expect(clash).toMatchObject({ ok: false });
    expect(pages.saveAgencyPage(B, { slug: "beta-studio", published: true })).toMatchObject({ ok: true });
    expect(pages.findPublishedPage(alfa.slug)?.agencyId).toBe(A);
    expect(pages.findPublishedPage("beta-studio")?.agencyId).toBe(B);
    expect(pages.findPublishedPage("nao-existe")).toBeNull();

    const art = market.createDeliverable({ projectId: projectB.id, title: "peça", mime: "image/png" });
    pages.setPublicDeliverables(A, [art.id]); // A tenta publicar peça de B
    expect(pages.getPublicDeliverable(A, art.id)).toBeNull();
    expect(pages.getPublicDeliverable(B, art.id)).toBeNull();
    pages.setPublicDeliverables(B, [art.id]);
    expect(pages.getPublicDeliverable(B, art.id)?.id).toBe(art.id);
    expect(pages.getPublicDeliverable(A, art.id)).toBeNull();
    pages.setShowcaseClients(A, [clientB.id]);
    expect(pages.listShowcaseClients(B)).toEqual([]);
  });

  it("professionals: own + marketplace + those who worked with the agency", () => {
    const base = {
      role: "designer" as const,
      email: "",
      phone: "",
      location: "",
      skills: [],
      specialties: "",
      marketFocus: "",
      bio: "",
      portfolio: [],
      priceRange: "",
      availability: "",
      employmentType: "freelancer" as const,
    };
    const ofA = market.createProfessional({ ...base, name: "Time Alfa" }, A);
    const ofB = market.createProfessional({ ...base, name: "Time Beta" }, B);
    const free = market.createProfessional({ ...base, name: "Freela" }, null);
    const seenByA = () => market.listProfessionals(scopeA).map((p) => p.id);
    expect(seenByA()).toEqual(expect.arrayContaining([ofA.id, free.id]));
    expect(seenByA()).not.toContain(ofB.id);
    // candidatura de B numa demanda de A: A passa a enxergar; a candidatura é de A
    const application = market.createApplication({ projectId: projectA.id, professionalId: ofB.id, message: "" })!;
    expect(market.getApplication(application.id)?.agencyId).toBe(A);
    expect(seenByA()).toContain(ofB.id);
    expect(market.professionalWorkedWith(ofB.id, A)).toBe(true);
    expect(market.professionalWorkedWith(ofA.id, B)).toBe(false);
    expect(finance.listProfessionalRates(scopeB).map((p) => p.id)).toEqual([ofB.id]);
  });

  it("proposals, meetings, jobs and activities are listed per agency", () => {
    const proposal = proposals.createProposal({
      agencyId: B,
      prospectId: null,
      prospectName: "Bar",
      segment: "",
      lang: "pt-BR",
      currency: "BRL",
      content: { pitch: "", packages: [] } as never,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(proposals.listRecentProposals(scopeA).find((p) => p.id === proposal.id)).toBeUndefined();
    expect(proposals.listRecentProposals(scopeB).map((p) => p.id)).toContain(proposal.id);

    // reunião de uma marca herda a agência dela, mesmo se pedirem outra
    const meeting = market.createMeeting({ agencyId: A, clientId: clientB.id, title: "Kickoff", scheduledAt: "2099-01-01T10:00", link: "", notes: "" });
    expect(meeting.agencyId).toBe(B);
    expect(market.listAllMeetings(scopeA)).toEqual([]);

    const job = market.createJob({ kind: "x", label: "y", clientId: clientA.id, agencyId: B });
    expect(job.agencyId).toBe(A);
    expect(market.listJobs(scopeB).find((j) => j.id === job.id)).toBeUndefined();

    market.logActivity({ audience: "agency", clientId: clientA.id, text: "só da Alfa" });
    expect(market.listActivities({ audience: "agency", scope: scopeB }).some((a) => a.text === "só da Alfa")).toBe(false);
    expect(market.listActivities({ audience: "agency", scope: scopeA }).some((a) => a.text === "só da Alfa")).toBe(true);
    market.markActivitiesRead("agency", { tenant: scopeB });
    expect(market.listActivities({ audience: "agency", scope: scopeA }).find((a) => a.text === "só da Alfa")?.readAt).toBeNull();
  });

  it("each agency has its own wallet and plan", () => {
    billing.startAccount("agency", A);
    billing.addCoins("agency", A, 50, "cortesia");
    expect(billing.getWallet("agency", B).purchasedCoins).toBe(0);
    expect(billing.getWallet("agency", A).purchasedCoins).toBe(50);
    expect(billing.getSubscription("agency", B).planId).toBe("agency_free");
    const row = db.prepare("SELECT agencyId FROM wallets WHERE accountType = 'agency' AND accountId = ?").get(A) as { agencyId: string };
    expect(row.agencyId).toBe(A);
    expect(billing.listTransactions({ agencyId: B }).every((t) => t.accountId !== A)).toBe(true);
  });
});
