import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAnnotation,
  getDeliverable,
  listAnnotations,
} from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

const annotationSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  comment: z.string().trim().min(1),
  author: z.enum(["agency", "client", "professional"]).default("agency"),
  audience: z.enum(["agency", "client", "professional", "all"]).default("all"),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return NextResponse.json(listAnnotations(id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!getDeliverable(id)) {
    return NextResponse.json({ error: "Entrega não encontrada" }, { status: 404 });
  }
  const parsed = annotationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Anotação inválida" }, { status: 400 });
  }
  return NextResponse.json(
    createAnnotation({ deliverableId: id, ...parsed.data }),
    { status: 201 }
  );
}
