import { NextResponse } from "next/server";
import { db, listClients } from "@/lib/db";
import { getAgencyStats, getClientStats } from "@/lib/marketplace-db";
import { agencyTier, clientTier } from "@/lib/ranking";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/marketplace-types";

// Insights: painel de andamento geral. Agrega demandas por status (funil),
// carteira de clientes, campanhas e sinais de produção — tudo em uma request.
export async function GET() {
  const count = (sql: string, ...p: unknown[]) =>
    (db.prepare(sql).get(...p) as { c: number }).c;

  // Funil de demandas por status
  const rows = db
    .prepare("SELECT status, COUNT(*) as c FROM projects GROUP BY status")
    .all() as { status: ProjectStatus; c: number }[];
  const byStatus = Object.fromEntries(
    PROJECT_STATUSES.map((s) => [s, 0])
  ) as Record<ProjectStatus, number>;
  for (const row of rows) byStatus[row.status] = row.c;
  const totalProjects = Object.values(byStatus).reduce((a, b) => a + b, 0);

  // Entregáveis (campanhas etc.) por tipo
  const byType = db
    .prepare(
      "SELECT type, COUNT(*) as c FROM generations GROUP BY type ORDER BY c DESC"
    )
    .all() as { type: string; c: number }[];

  // Produção recente e gargalos
  const now = new Date().toISOString();
  const overdue = db
    .prepare(
      `SELECT p.id, p.title, p.deadline, c.name AS clientName FROM projects p
       JOIN clients c ON c.id = p.clientId
       WHERE p.deadline != '' AND p.deadline < ? AND p.status NOT IN ('approved','paid')
       ORDER BY p.deadline ASC LIMIT 8`
    )
    .all(now.slice(0, 10));

  // Ranking de clientes por elo + atividade
  const clients = listClients()
    .map((client) => {
      const stats = getClientStats(client.id);
      return {
        id: client.id,
        name: client.name,
        tier: clientTier(stats),
        paidProjects: stats.paidProjects,
        totalProjects: stats.totalProjects,
        generations: stats.generations,
      };
    })
    .sort((a, b) => b.tier.progress + b.paidProjects * 10 - (a.tier.progress + a.paidProjects * 10));

  // Top profissionais por entregas concluídas
  const topProfessionals = db
    .prepare(
      `SELECT pr.id, pr.name, pr.role,
        (SELECT COUNT(*) FROM projects WHERE professionalId = pr.id AND status IN ('approved','paid')) AS completed,
        (SELECT AVG(r.score) FROM art_reviews r JOIN deliverables d ON d.id = r.deliverableId JOIN projects p ON p.id = d.projectId WHERE p.professionalId = pr.id) AS avgScore
       FROM professionals pr ORDER BY completed DESC, avgScore DESC LIMIT 6`
    )
    .all() as { id: string; name: string; role: string; completed: number; avgScore: number | null }[];

  const agencyStats = getAgencyStats();

  // Ritmo semanal (atividades por dia dos últimos 7 dias)
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const activityByDay = db
    .prepare(
      `SELECT substr(createdAt,1,10) AS day, COUNT(*) AS c FROM activities
       WHERE substr(createdAt,1,10) >= ? GROUP BY day ORDER BY day ASC`
    )
    .all(weekAgo) as { day: string; c: number }[];

  return NextResponse.json({
    agency: { tier: agencyTier(agencyStats), stats: agencyStats },
    funnel: { byStatus, totalProjects },
    deliverables: {
      byType: byType.map((t) => ({ ...t, avgScore: null })),
      total: byType.reduce((a, b) => a + b.c, 0),
    },
    overdue,
    clients,
    topProfessionals: topProfessionals.map((p) => ({
      ...p,
      avgScore: p.avgScore !== null ? Math.round(p.avgScore) : null,
    })),
    activityByDay,
    counts: {
      openDemands: byStatus.open,
      inProduction: byStatus.in_progress + byStatus.in_review,
      awaitingApproval: byStatus.client_approval,
      meetingsUpcoming: count("SELECT COUNT(*) as c FROM meetings WHERE scheduledAt >= ?", now),
      scheduledPosts: count("SELECT COUNT(*) as c FROM scheduled_posts WHERE status = 'scheduled'"),
    },
  });
}
