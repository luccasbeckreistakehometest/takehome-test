import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAnnotation,
  getDeliverable,
  getProject,
  listAnnotations,
  logActivity,
} from "@/lib/marketplace-db";
import { actorRole, guardDeliverable, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

const annotationSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  comment: z.string().trim().min(1).max(2000),
  author: z.enum(["agency", "client", "professional"]).default("agency"),
  audience: z.enum(["agency", "client", "professional", "all"]).default("all"),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "view");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listAnnotations(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardDeliverable(id, "portal");
  if (isDenied(auth)) return auth;
  const parsed = annotationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Anotação inválida" }, { status: 400 });
  }
  // A marca anota como marca (o autor vem da sessão).
  const data = auth.session.role === "client" ? { ...parsed.data, author: actorRole(auth.session) } : parsed.data;
  const annotation = createAnnotation({ deliverableId: id, ...data });
  const deliverable = getDeliverable(id)!;
  const project = getProject(deliverable.projectId);
  if (project) {
    const audience =
      parsed.data.audience === "all" ? "agency" : parsed.data.audience;
    logActivity({
      audience,
      clientId: project.clientId,
      professionalId: project.professionalId,
      projectId: project.id,
      text: `📌 Nova revisão em "${deliverable.title}": "${parsed.data.comment.slice(0, 60)}"`,
      href: `/clients/${project.clientId}?project=${project.id}`,
    });
  }
  return NextResponse.json(annotation, { status: 201 });
}
