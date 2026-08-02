import { NextResponse } from "next/server";
import { deleteMeeting } from "@/lib/marketplace-db";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!deleteMeeting(id)) {
    return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
