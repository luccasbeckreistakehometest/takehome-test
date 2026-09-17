import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import { createProspect } from "@/lib/marketplace-db";

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome"),
  segment: z.string().trim().default(""),
  location: z.string().trim().default(""),
  website: z.string().trim().default(""),
  instagram: z.string().trim().default(""),
  notes: z.string().trim().default(""),
});

// Prospect cadastrado à mão (indicação, evento, DM): entra na mesma lista da
// prospecção por IA e pode receber uma proposta pública.
export async function POST(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const prospect = createProspect({
    searchQuery: "manual",
    name: parsed.data.name,
    segment: parsed.data.segment,
    location: parsed.data.location,
    website: parsed.data.website,
    instagram: parsed.data.instagram,
    whyFit: parsed.data.notes,
    marketingMaturity: "",
    suggestedApproach: "",
  });
  return NextResponse.json(prospect, { status: 201 });
}
