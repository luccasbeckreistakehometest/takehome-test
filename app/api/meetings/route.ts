import { NextResponse } from "next/server";
import { z } from "zod";
import { createMeeting, getProject, listAllMeetings } from "@/lib/marketplace-db";
import { getClient } from "@/lib/db";
import { actingAgencyId, agencyOnly, guard, isDenied, tenantOf } from "@/lib/guard";

const meetingSchema = z.object({
  clientId: z.string().nullable().default(null),
  projectId: z.string().nullable().default(null),
  title: z.string().trim().min(1),
  scheduledAt: z.string().trim().min(1),
  link: z.string().trim().default(""),
  notes: z.string().trim().default(""),
  reasoning: z.string().trim().default(""),
});

export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  return NextResponse.json(listAllMeetings(tenantOf(auth, request)));
}

export async function POST(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const parsed = meetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const { clientId, projectId } = parsed.data;
  // Marca e demanda precisam ser da agência (e a demanda, da marca).
  if (clientId) {
    const owner = await guard(["agency", "admin"], { clientId });
    if (isDenied(owner)) return owner;
    if (!getClient(clientId)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  if (projectId) {
    const project = getProject(projectId);
    const owner = project ? await guard(["agency", "admin"], { clientId: project.clientId }) : null;
    if (!project || !owner || isDenied(owner) || (clientId && project.clientId !== clientId)) {
      return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
    }
  }
  return NextResponse.json(createMeeting({ ...parsed.data, agencyId: actingAgencyId(auth, request) }), { status: 201 });
}
