import { NextResponse } from "next/server";
import { z } from "zod";
import { createMeeting, listAllMeetings } from "@/lib/marketplace-db";
import { getClient } from "@/lib/db";
import { agencyOnly, isDenied } from "@/lib/guard";

const meetingSchema = z.object({
  clientId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  title: z.string().trim().min(1),
  scheduledAt: z.string().trim().min(1),
  link: z.string().trim().default(""),
  notes: z.string().trim().default(""),
  reasoning: z.string().trim().default(""),
});

export async function GET() {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json(listAllMeetings());
}

export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = meetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (parsed.data.clientId && !getClient(parsed.data.clientId)) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(createMeeting(parsed.data), { status: 201 });
}
