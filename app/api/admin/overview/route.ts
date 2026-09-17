import { NextResponse } from "next/server";
import { db, listClients } from "@/lib/db";
import { getAgencyStats, listProfessionals } from "@/lib/marketplace-db";
import { agencySalesTotal } from "@/lib/integrations-db";
import { listUsers } from "@/lib/auth";
import { listInvites } from "@/lib/invites-db";
import { onboardingStats } from "@/lib/onboarding-db";
import { guard, isDenied, tenantOf } from "@/lib/guard";
import {
  aiAccountLimitUsd,
  aiDailyLimitUsd,
  aiFreePoolLimitUsd,
  aiFreePoolSpendTodayUsd,
  aiSpendTodayUsd,
  recentAiErrors,
  spendByDay,
  usageByAccount,
} from "@/lib/ai-spend";
import { inboxCounts } from "@/lib/contact-db";
import { isEnforced, platformRevenue, viewAccount } from "@/lib/billing-db";
import { agencyPageIndexable, getAgencyPageConfig, listAgencies } from "@/lib/agencies";
import { agencySelfSignupEnabled, legalIdentityComplete } from "@/lib/legal";
import { getPlan } from "@/lib/plans";
import { scopeWhere } from "@/lib/tenancy-rules";
import "@/lib/agency-page-db";
import "@/lib/proposals-db";
import "@/lib/pulse-db";

// Visão do admin da plataforma: agências, contas, receita, custo de IA e
// sinais de uso. ?agency=<id> filtra tudo por uma agência.
export async function GET(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const scope = tenantOf(auth, request);
  const tenant = scopeWhere(scope);
  const agencyFilter = scope.agencyId;
  const count = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params, ...tenant.params) as { c: number }).c;
  const agencyStats = getAgencyStats(scope);
  const sales = agencySalesTotal(scope);
  const clients = listClients(scope);
  const professionals = listProfessionals(scope);
  const agencies = listAgencies();
  const agencyName = new Map(agencies.map((a) => [a.id, a.name]));
  const clientName = new Map(listClients(tenantOf(auth)).map((c) => [c.id, c.name]));
  const proName = new Map(listProfessionals(tenantOf(auth)).map((p) => [p.id, p.name]));
  const accountName = (type: string | null, id: string | null) =>
    type === "agency"
      ? (agencyName.get(id ?? "") ?? "Agência (removida)")
      : type === "client"
        ? (clientName.get(id ?? "") ?? "(removido)")
        : type === "professional"
          ? (proName.get(id ?? "") ?? "(removido)")
          : "Admin / sistema";
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  return NextResponse.json({
    agencyFilter,
    // LGPD: sem LEGAL_NAME/DOCUMENT/EMAIL a política não identifica o controlador
    // e o cadastro público de agências fica fechado em produção.
    legal: { identityComplete: legalIdentityComplete(), agencySignupOpen: agencySelfSignupEnabled() },
    agencies: agencies.map((a) => {
      const { subscription, wallet } = viewAccount("agency", a.billingAccountId);
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        ownerUsername: a.ownerUsername,
        users: a.users,
        clients: a.clients,
        planId: subscription.planId,
        planName: getPlan(subscription.planId)?.name ?? subscription.planId,
        renewsAt: subscription.renewsAt,
        coins: wallet.coins,
        createdAt: a.createdAt,
        pagePublished: getAgencyPageConfig(a.id).published,
        pageIndexable: agencyPageIndexable(a.id),
      };
    }),
    onboarding: onboardingStats(),
    totals: {
      agencies: agencies.length,
      users: count(`SELECT COUNT(*) as c FROM users WHERE ${tenant.sql}`),
      clients: clients.length,
      professionals: professionals.length,
      generations: agencyStats.generations,
      paidProjects: agencyStats.paidProjects,
      trackedRevenue: sales.revenue,
    },
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      country: c.country,
      selfServe: c.selfServe,
      agencyId: c.agencyId,
      agencyName: agencyName.get(c.agencyId) ?? "",
    })),
    professionals: professionals.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      employmentType: p.employmentType,
      agencyId: p.agencyId,
      agencyName: p.agencyId ? (agencyName.get(p.agencyId) ?? "") : "Marketplace",
    })),
    users: listUsers({ agencyId: agencyFilter }).map((u) => ({
      ...u,
      agencyName: u.agencyId ? (agencyName.get(u.agencyId) ?? "") : "",
    })),
    invites: listInvites(scope).map((i) => ({
      token: i.token,
      role: i.role,
      status: i.status,
      note: i.note,
      createdAt: i.createdAt,
      agencyName: agencyName.get(i.agencyId) ?? "",
    })),
    billing: { enforced: isEnforced(), revenue: platformRevenue(agencyFilter) },
    ai: {
      spendTodayUsd: aiSpendTodayUsd(),
      dailyLimitUsd: aiDailyLimitUsd(),
      freeSpendTodayUsd: aiFreePoolSpendTodayUsd(),
      freeLimitUsd: aiFreePoolLimitUsd(),
      freeAccountLimitUsd: aiAccountLimitUsd("free"),
      paidAccountLimitUsd: aiAccountLimitUsd("paid"),
      byDay: spendByDay(14, agencyFilter),
      byAccount: usageByAccount(30, agencyFilter).map((row) => ({
        ...row,
        name: accountName(row.accountType, row.accountId),
        agencyName: row.agencyId ? (agencyName.get(row.agencyId) ?? "") : "",
      })),
      errors: recentAiErrors(20, agencyFilter),
      keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    inbox: inboxCounts(),
    leads: {
      total: count(`SELECT COUNT(*) as c FROM leads WHERE ${tenant.sql}`),
      last30: count(`SELECT COUNT(*) as c FROM leads WHERE createdAt >= ? AND ${tenant.sql}`, since30),
      recent: db
        .prepare(`SELECT id, agencyId, slug, name, need, budgetBand, createdAt FROM leads WHERE ${tenant.sql} ORDER BY createdAt DESC LIMIT 15`)
        .all(...tenant.params),
    },
    proposals: {
      byStatus: db.prepare(`SELECT status, COUNT(*) AS c FROM proposals WHERE ${tenant.sql} GROUP BY status`).all(...tenant.params),
      recent: db
        .prepare(
          `SELECT id, agencyId, prospectName, status, acceptedPackage, expiresAt, createdAt FROM proposals WHERE ${tenant.sql} ORDER BY createdAt DESC LIMIT 15`
        )
        .all(...tenant.params),
    },
    pulse: {
      responses: count(`SELECT COUNT(*) as c FROM client_pulses WHERE ${tenant.sql}`),
      avgScore: (db.prepare(`SELECT AVG(score) AS a FROM client_pulses WHERE ${tenant.sql}`).get(...tenant.params) as { a: number | null }).a,
      recent: db
        .prepare(
          `SELECT p.clientId, c.name AS clientName, p.score, p.createdAt FROM client_pulses p LEFT JOIN clients c ON c.id = p.clientId
           WHERE ${scopeWhere(scope, "p.agencyId").sql} ORDER BY p.createdAt DESC LIMIT 15`
        )
        .all(...tenant.params),
    },
  });
}
