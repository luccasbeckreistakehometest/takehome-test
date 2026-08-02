import { NextResponse } from "next/server";
import { db, listClients } from "@/lib/db";
import { getAgencyStats, listProfessionals } from "@/lib/marketplace-db";
import { agencySalesTotal } from "@/lib/integrations-db";
import { listUsers } from "@/lib/auth";
import { listInvites } from "@/lib/invites-db";

// Visão do admin da plataforma: controla agências, clientes, profissionais.
export async function GET() {
  const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
  const agencyStats = getAgencyStats();
  const sales = agencySalesTotal();
  const invites = listInvites();
  return NextResponse.json({
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
