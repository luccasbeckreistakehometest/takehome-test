import { NextResponse } from "next/server";
import { db, listClients } from "@/lib/db";
import { getAgencyStats, listProfessionals } from "@/lib/marketplace-db";
import { agencySalesTotal } from "@/lib/integrations-db";
import { listUsers } from "@/lib/auth";
import { listInvites } from "@/lib/invites-db";
import { onboardingStats } from "@/lib/onboarding-db";
import { guard, isDenied } from "@/lib/guard";
import { aiDailyLimitUsd, aiSpendTodayUsd, recentAiErrors, spendByDay, usageByAccount } from "@/lib/ai-spend";
import { inboxCounts } from "@/lib/contact-db";
import { isEnforced, platformRevenue } from "@/lib/billing-db";
import "@/lib/agency-page-db";
import "@/lib/proposals-db";
import "@/lib/pulse-db";

// Visão do admin da plataforma: contas, receita, custo de IA e sinais de uso.
export async function GET() {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  const agencyStats = getAgencyStats();
  const sales = agencySalesTotal();
  const clients = listClients();
  const professionals = listProfessionals();
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const proName = new Map(professionals.map((p) => [p.id, p.name]));
  const accountName = (type: string | null, id: string | null) =>
    type === "agency" ? "Agência" : type === "client" ? (clientName.get(id ?? "") ?? "(removido)") : type === "professional" ? (proName.get(id ?? "") ?? "(removido)") : "Admin / sistema";

  return NextResponse.json({
    onboarding: onboardingStats(),
    totals: {
      users: count("SELECT COUNT(*) as c FROM users"),
      clients: clients.length,
      professionals: professionals.length,
      generations: agencyStats.generations,
      paidProjects: agencyStats.paidProjects,
      trackedRevenue: sales.revenue,
    },
    clients: clients.map((c) => ({ id: c.id, name: c.name, industry: c.industry, country: c.country, selfServe: c.selfServe })),
    professionals: professionals.map((p) => ({ id: p.id, name: p.name, role: p.role, employmentType: p.employmentType })),
    users: listUsers(),
    invites: listInvites().map((i) => ({ token: i.token, role: i.role, status: i.status, note: i.note, createdAt: i.createdAt })),
    billing: { enforced: isEnforced(), revenue: platformRevenue() },
    ai: {
      spendTodayUsd: aiSpendTodayUsd(),
      dailyLimitUsd: aiDailyLimitUsd(),
      byDay: spendByDay(14),
      byAccount: usageByAccount(30).map((row) => ({ ...row, name: accountName(row.accountType, row.accountId) })),
      errors: recentAiErrors(20),
      keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    inbox: inboxCounts(),
    leads: {
      total: count("SELECT COUNT(*) as c FROM leads"),
      last30: count(`SELECT COUNT(*) as c FROM leads WHERE createdAt >= '${new Date(Date.now() - 30 * 86_400_000).toISOString()}'`),
      recent: db.prepare("SELECT id, slug, name, need, budgetBand, createdAt FROM leads ORDER BY createdAt DESC LIMIT 15").all(),
    },
    proposals: {
      byStatus: db.prepare("SELECT status, COUNT(*) AS c FROM proposals GROUP BY status").all(),
      recent: db
        .prepare("SELECT id, prospectName, status, acceptedPackage, expiresAt, createdAt FROM proposals ORDER BY createdAt DESC LIMIT 15")
        .all(),
    },
    pulse: {
      responses: count("SELECT COUNT(*) as c FROM client_pulses"),
      avgScore: (db.prepare("SELECT AVG(score) AS a FROM client_pulses").get() as { a: number | null }).a,
      recent: db
        .prepare("SELECT p.clientId, c.name AS clientName, p.score, p.createdAt FROM client_pulses p LEFT JOIN clients c ON c.id = p.clientId ORDER BY p.createdAt DESC LIMIT 15")
        .all(),
    },
  });
}
