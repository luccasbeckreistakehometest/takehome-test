import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getApplication,
  getProject,
  logActivity,
  setApplicationStatus,
  updateProject,
} from "@/lib/marketplace-db";
import { guardApplication, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

// A agência analisa candidaturas: pode aceitar mais de uma (pagando ambas)
// e depois definir o preferido no projeto.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardApplication(id, "workspace");
  if (isDenied(auth)) return auth;
  const application = getApplication(id)!;
  const parsed = z
    .object({ status: z.enum(["accepted", "rejected", "pending"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  setApplicationStatus(id, parsed.data.status);
  if (parsed.data.status === "accepted" || parsed.data.status === "rejected") {
    const project = getProject(application.projectId);
    logActivity({
      audience: "professional",
      professionalId: application.professionalId,
      projectId: application.projectId,
      text:
        parsed.data.status === "accepted"
          ? `🎉 Sua candidatura à demanda "${project?.title ?? ""}" foi aceita!`
          : `Sua candidatura à demanda "${project?.title ?? ""}" foi recusada.`,
      href: `/professionals/${application.professionalId}`,
    });
  }
  // Primeira aceitação tira a demanda de "aberta"
  if (parsed.data.status === "accepted") {
    const project = getProject(application.projectId);
    if (project && project.status === "open") {
      updateProject(project.id, { status: "matched" });
    }
  }
  return NextResponse.json({ ok: true });
}
