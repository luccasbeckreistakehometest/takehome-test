import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { getBrandVoicePolicy, saveBrandVoicePolicy, voiceCacheStats } from "@/lib/brand-voice-db";

type Context = { params: Promise<{ id: string }> };

// Política da voz da marca por cliente (termos, CTA, hashtags, emojis, alegações).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json({ policy: getBrandVoicePolicy(id), tone: client.tone, stats: voiceCacheStats(id) });
}

const schema = z.object({
  bannedTerms: z.union([z.array(z.string()), z.string()]).optional(),
  requiredTerms: z.union([z.array(z.string()), z.string()]).optional(),
  requireCta: z.boolean().optional(),
  maxHashtags: z.number().int().min(0).max(30).optional(),
  maxEmojis: z.number().int().min(0).max(30).optional(),
  flagClaims: z.boolean().optional(),
  notes: z.string().max(1500).optional(),
});

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const auth = await guard(["agency", "admin", "client"], { clientId: id });
  if (isDenied(auth)) return auth;
  const client = getClient(id);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  return NextResponse.json({ policy: saveBrandVoicePolicy(id, parsed.data), tone: client.tone, stats: voiceCacheStats(id) });
}
