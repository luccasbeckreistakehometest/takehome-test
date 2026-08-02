import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getApplication,
  getProject,
  setApplicationStatus,
  updateProject,
} from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

// A agência analisa candidaturas: pode aceitar mais de uma (pagando ambas)
// e depois definir o preferido no projeto.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const application = getApplication(id);
  if (!application) {
    return NextResponse.json({ error: "Candidatura não encontrada" }, { status: 404 });
  }
  const parsed = z
    .object({ status: z.enum(["accepted", "rejected", "pending"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  setApplicationStatus(id, parsed.data.status);
  // Primeira aceitação tira a demanda de "aberta"
  if (parsed.data.status === "accepted") {
    const project = getProject(application.projectId);
    if (project && project.status === "open") {
      updateProject(project.id, { status: "matched" });
    }
  }
  return NextResponse.json({ ok: true });
}
