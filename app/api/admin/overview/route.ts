import { NextResponse } from "next/server";
import { db, listClients } from "@/lib/db";
import { getAgencyStats, listProfessionals } from "@/lib/marketplace-db";
import { agencySalesTotal } from "@/lib/integrations-db";
import { listUsers } from "@/lib/auth";
import { listInvites } from "@/lib/invites-db";
import { onboardingStats } from "@/lib/onboarding-db";
import { getSession } from "@/lib/session";

// Visão do admin da plataforma: controla agências, clientes, profissionais.
export async function GET() {
  // Dados da plataforma inteira (usuários, convites, clientes de todas as
  // agências): só o admin da plataforma pode ler.
  const session = await getSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  const agencyStats = getAgencyStats();
  const sales = agencySalesTotal();
  const invites = listInvites();
  const onboarding = onboardingStats();
  return NextResponse.json({
    onboarding,
    totals: {
      users: count("SELECT COUNT(*) as c FROM users"),
      clients: count("SELECT COUNT(*) as c FROM clients"),
      professionals: count("SELECT COUNT(*) as c FROM professionals"),
      generations: agencyStats.generations,
      paidProjects: agencyStats.paidProjects,
      trackedRevenue: sales.revenue,
    },
    clients: listClients().map((c) => ({ id: c.id, name: c.name, industry: c.industry, country: c.country })),
    professionals: listProfessionals().map((p) => ({ id: p.id, name: p.name, role: p.role, employmentType: p.employmentType })),
    users: listUsers(),
    invites: invites.map((i) => ({ token: i.token, role: i.role, status: i.status, note: i.note, createdAt: i.createdAt })),
  });
}
