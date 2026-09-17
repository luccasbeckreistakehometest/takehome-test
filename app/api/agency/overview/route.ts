import { NextResponse } from "next/server";
import { db, listClients } from "@/lib/db";
import {
  getAgencyStats,
  getClientStats,
  listActivities,
  listScheduledPosts,
} from "@/lib/marketplace-db";
import { agencyTier, clientTier } from "@/lib/ranking";
import { agencyOnly, isDenied } from "@/lib/guard";

// Home operacional da agência: "o que preciso fazer hoje" cross-contas
export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const pendingApplications = db
    .prepare(
      `SELECT a.id, a.projectId, p.title AS projectTitle, p.clientId, pr.name AS professionalName
       FROM applications a
       JOIN projects p ON p.id = a.projectId
       JOIN professionals pr ON pr.id = a.professionalId
       WHERE a.status = 'pending' ORDER BY a.createdAt DESC LIMIT 10`
    )
    .all();
  const inReview = db
    .prepare(
      `SELECT p.id, p.clientId, p.title, c.name AS clientName FROM projects p
       JOIN clients c ON c.id = p.clientId WHERE p.status = 'in_review' ORDER BY p.createdAt DESC`
    )
    .all();
  const awaitingClient = db
    .prepare(
      `SELECT p.id, p.clientId, p.title, c.name AS clientName FROM projects p
       JOIN clients c ON c.id = p.clientId WHERE p.status = 'client_approval' ORDER BY p.createdAt DESC`
    )
    .all();
  const unansweredClientMessages = db
    .prepare(
      `SELECT am.clientId, c.name AS clientName, COUNT(*) AS count FROM account_messages am
       JOIN clients c ON c.id = am.clientId
       WHERE am.sender = 'client' AND am.createdAt > COALESCE(
         (SELECT MAX(createdAt) FROM account_messages WHERE clientId = am.clientId AND sender = 'agency'), ''
       )
       GROUP BY am.clientId`
    )
    .all();
  const now = new Date().toISOString();
  const duePosts = listScheduledPosts().filter(
    (post) => post.status === "scheduled" && post.scheduledFor <= now
  );
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59);
  const meetingsToday = db
    .prepare(
      "SELECT m.*, c.name AS clientName FROM meetings m LEFT JOIN clients c ON c.id = m.clientId WHERE m.scheduledAt >= ? AND m.scheduledAt <= ? ORDER BY m.scheduledAt ASC"
    )
    .all(now.slice(0, 10), todayEnd.toISOString());
  const clients = listClients().map((client) => ({
    ...client,
    tier: clientTier(getClientStats(client.id)),
  }));
  const unread = listActivities({ audience: "agency" }).filter((a) => !a.readAt).length;
  const agencyStats = getAgencyStats();
  return NextResponse.json({
    agency: { tier: agencyTier(agencyStats), stats: agencyStats },
    pendingApplications,
    inReview,
    awaitingClient,
    unansweredClientMessages,
    duePosts,
    meetingsToday,
    clients,
    unread,
  });
}
