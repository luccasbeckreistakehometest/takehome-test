import { NextResponse } from "next/server";
import { guard, isDenied } from "@/lib/guard";
import { dailyRows, funnelCounts, recentSignups, topSources, visitorsPerDay } from "@/lib/analytics-db";
import { AUDIENCES, eventsCsv, funnel, type Audience } from "@/lib/analytics-rules";

// Funil e origens (admin). ?days=7|30|90, ?audience=, ?source=, ?format=csv.
export async function GET(request: Request) {
  const auth = await guard(["admin"]);
  if (isDenied(auth)) return auth;
  const url = new URL(request.url);
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
  const audienceRaw = url.searchParams.get("audience") ?? "";
  const audience: Audience | "" = AUDIENCES.includes(audienceRaw as Audience) ? (audienceRaw as Audience) : "";
  const source = url.searchParams.get("source") ?? "";
  if (url.searchParams.get("format") === "csv") {
    return new NextResponse(`﻿${eventsCsv(dailyRows(days))}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="marqa-funil-${days}d.csv"` },
    });
  }
  const filter = { days, audience, source };
  return NextResponse.json({
    days,
    funnel: funnel(funnelCounts(filter)),
    visitors: visitorsPerDay(filter),
    sources: topSources(filter),
    signups: recentSignups(30),
  });
}
