import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, saveSettings } from "@/lib/settings";

const settingsSchema = z.object({
  agencyName: z.string().trim().min(1, "Nome é obrigatório"),
  tagline: z.string().trim().default(""),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor em formato #rrggbb"),
  landingPagesEnabled: z.boolean().default(false),
  economyMode: z.boolean().default(true),
});

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  return NextResponse.json(saveSettings(parsed.data));
}
