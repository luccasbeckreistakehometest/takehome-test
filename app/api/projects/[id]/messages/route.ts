import { NextResponse } from "next/server";
import { z } from "zod";
import { createMessage, getProject, listMessages } from "@/lib/marketplace-db";
import { guardProject, isDenied } from "@/lib/guard";

type Context = { params: Promise<{ id: string }> };

const messageSchema = z.object({
  sender: z.enum(["agency", "professional"]),
  text: z.string().trim().min(1).max(4000),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "workspace");
  if (isDenied(auth)) return auth;
  return NextResponse.json(listMessages(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guardProject(id, "workspace");
  if (isDenied(auth)) return auth;
  if (!getProject(id)) {
    return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });
  }
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  }
  return NextResponse.json(
    createMessage({ projectId: id, ...parsed.data }),
    { status: 201 }
  );
}
