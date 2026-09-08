import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, homeForUser, type BrandSource } from "@/lib/auth";
import { SESSION_COOKIE, signSession } from "@/lib/auth-shared";
import { createClient } from "@/lib/db";
import { createProfessional } from "@/lib/marketplace-db";
import { consumeInvite, getInvite } from "@/lib/invites-db";

// Auto-cadastro (ou cadastro via convite) com login automático.
// - Sem token: brandSource = "platform" (vê a marca da plataforma).
// - Com token válido: papel e brandSource = "agency" (whitelabel da agência).
const schema = z.object({
  role: z.enum(["client", "professional", "agency"]).optional(),
  name: z.string().trim().min(1, "Informe o nome"),
  email: z.string().trim().default(""),
  password: z.string().min(4, "Senha muito curta"),
  token: z.string().trim().optional(),
  // campos opcionais de perfil
  industry: z.string().trim().default(""),
  country: z.string().trim().default("Brasil"),
  professionalRole: z.enum(["fotografo", "designer"]).optional(),
  location: z.string().trim().default(""),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Resolve papel e origem da marca a partir do convite (se houver)
  let role = data.role;
  let brandSource: BrandSource = "platform";
  if (data.token) {
    const invite = getInvite(data.token);
    if (!invite || invite.status !== "pending" || (invite.expiresAt && invite.expiresAt < new Date().toISOString())) {
      return NextResponse.json({ error: "Convite inválido ou expirado." }, { status: 400 });
    }
    role = invite.role;
    brandSource = "agency"; // convidado por uma agência = whitelabel dela
  }
  if (!role) {
    return NextResponse.json({ error: "Escolha o tipo de conta." }, { status: 400 });
  }

  let refId: string | null = null;
  // Marca autônoma quando se cadastra sozinha (sem agência convidando).
  const selfServe = role === "client" && brandSource === "platform";
  if (role === "client") {
    const client = createClient({
      name: data.name,
      industry: data.industry,
      description: "",
      audience: "",
      tone: "",
      goals: "",
      budget: "",
      channels: [],
      differentials: "",
      competitors: "",
      brandColors: "",
      website: "",
      instagram: "",
      notes: "",
      capabilities: "",
      language: "pt-BR",
      source: "self",
      country: data.country || "Brasil",
      selfServe, // autônoma quando não tem agência convidando
    });
    refId = client.id;
  } else if (role === "professional") {
    const professional = createProfessional({
      name: data.name,
      role: data.professionalRole ?? "fotografo",
      email: data.email,
      phone: "",
      location: data.location,
      skills: [],
      specialties: "",
      marketFocus: "",
      bio: "",
      portfolio: [],
      priceRange: "",
      availability: "",
      employmentType: "freelancer",
    });
    refId = professional.id;
  }
  // agency: sem entidade separada (compartilha o workspace); refId = null

  const created = createUser({
    password: data.password,
    role,
    refId,
    name: data.name,
    brandSource,
  });

  if (data.token) consumeInvite(data.token, refId ?? created.id);

  const token = await signSession({
    userId: created.id,
    role,
    refId,
    name: data.name,
    brandSource,
    selfServe,
  });
  // Marca que se cadastrou sozinha decide primeiro como quer trabalhar
  // (autônoma x com agência). Os demais vão direto pra sua home.
  const home =
    selfServe && refId
      ? `/portal/client/${refId}?welcome=1&choose=1`
      : homeForUser({ role, refId }, { selfServe });
  const response = NextResponse.json({ ok: true, home, username: created.username, role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
