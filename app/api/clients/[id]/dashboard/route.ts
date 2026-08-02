import { NextResponse } from "next/server";
import { getClient, listGenerations } from "@/lib/db";
import {
  getClientStats,
  listClientMeetings,
  listProjects,
} from "@/lib/marketplace-db";
import { clientTier } from "@/lib/ranking";
import { GENERATION_TYPES } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const client = getClient(id);
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const generations = listGenerations(id);
  const byType = Object.fromEntries(
    GENERATION_TYPES.map((type) => {
      const ofType = generations.filter((g) => g.type === type);
      return [
        type,
        {
          count: ofType.length,
          latestAt: ofType[0]?.createdAt ?? null,
          latestTitle: ofType[0]?.title ?? null,
          latestId: ofType[0]?.id ?? null,
        },
      ];
    })
  );

  const projects = listProjects({ clientId: id });
  const stats = getClientStats(id);
  const upcoming = listClientMeetings(id).filter(
    (meeting) => new Date(meeting.scheduledAt) > new Date()
  );

  let pulseSummary: string | null = null;
  const latestPulse = generations.find((g) => g.type === "market_pulse");
  if (latestPulse) {
    try {
      pulseSummary = (JSON.parse(latestPulse.content) as { summary?: string }).summary ?? null;
    } catch {
      pulseSummary = null;
    }
  }

  return NextResponse.json({
    client,
    tier: clientTier(stats),
    stats,
    byType,
    projects: {
      total: projects.length,
      open: projects.filter((p) => p.status === "open").length,
      active: projects.filter((p) =>
        ["matched", "in_progress", "in_review"].includes(p.status)
      ).length,
      awaitingReview: projects.filter((p) => p.status === "in_review").length,
      paid: projects.filter((p) => p.status === "paid").length,
      recent: projects.slice(0, 5),
    },
    meetings: upcoming.slice(0, 5),
    pulseSummary,
  });
}
