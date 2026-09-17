import { NextResponse } from "next/server";
import { z } from "zod";
import { createMeeting, getProject, listMeetings } from "@/lib/marketplace-db";
import { guardProject, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

const meetingSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório"),
  scheduledAt: z.string().trim().min(1, "Data/hora é obrigatória"),
  link: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listMeetings(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "workspace");
  if (isDenied(auth)) return auth;
  const project = getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const parsed = meetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  return NextResponse.json(
    createMeeting({ agencyId: project.agencyId, projectId: id, clientId: project.clientId, ...parsed.data }),
    { status: 201 }
  );
}
