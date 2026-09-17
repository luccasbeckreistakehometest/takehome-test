import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, saveSettings } from "@/lib/settings";
import { actingAgencyId, guard, isDenied } from "@/lib/guard";
import { getAgency, updateAgencyBranding } from "@/lib/agencies";
import { agencyLogoUrl, PLATFORM_BRAND } from "@/lib/branding";
import type { SessionPayload } from "@/lib/auth-shared";

// Whitelabel (nome, slogan, cor, estilo da casa) é de CADA agência. Custo e
// credenciais de IA, teto de qualidade, provedor de imagem e flags são da
// PLATAFORMA: só o admin muda.
const settingsSchema = z.object({
  agencyName: z.string().trim().min(1, "Nome é obrigatório").max(80),
  tagline: z.string().trim().max(160).default(""),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor em formato #rrggbb"),
  houseStyle: z.string().trim().max(4000).default(""),
  // Só o admin da plataforma: custo e credenciais.
  imageProvider: z.enum(["huggingface", "together", "pollinations"]).optional(),
  landingPagesEnabled: z.boolean().optional(),
  aiMode: z.enum(["economy", "balanced", "premium"]).optional(),
  // Chaves: string vazia = manter a atual; "clear" = apagar
  anthropicApiKey: z.string().trim().max(400).default(""),
  googleAiApiKey: z.string().trim().max(400).default(""),
  togetherApiKey: z.string().trim().max(400).default(""),
  hfApiKey: z.string().trim().max(400).default(""),
});

// Marca que a sessão enxerga: a da própria agência (ou a do ?agency= para o
// admin); convidado vê a da agência dele; auto-cadastrado, a da plataforma.
function brandFor(session: SessionPayload, request: Request) {
  const agencyId =
    session.role === "admin"
      ? actingAgencyId(session, request)
      : session.role === "agency" || session.brandSource !== "platform"
        ? session.agencyId
        : null;
  const agency = getAgency(agencyId);
  if (!agency) {
    return {
      agencyId: null,
      agencySlug: null,
      agencyName: PLATFORM_BRAND.name,
      tagline: PLATFORM_BRAND.tagline,
      accentColor: PLATFORM_BRAND.accentColor,
      logoMime: "",
      logoUrl: "",
      houseStyle: "",
    };
  }
  return {
    agencyId: agency.id,
    agencySlug: agency.slug,
    agencyName: agency.name,
    tagline: agency.tagline,
    accentColor: agency.accentColor,
    logoMime: agency.logoMime,
    logoUrl: agencyLogoUrl(agency),
    houseStyle: agency.houseStyle,
  };
}

// As chaves nunca voltam ao navegador; nem a presença delas, exceto para o admin.
function publicView(session: SessionPayload, request: Request) {
  const settings = getSettings();
  const { houseStyle, ...brand } = brandFor(session, request);
  const base = {
    ...brand,
    landingPagesEnabled: settings.landingPagesEnabled,
    aiMode: settings.aiMode,
    canManagePlatform: session.role === "admin",
    viewerRole: session.role,
  };
  if (session.role !== "agency" && session.role !== "admin") return base;
  const view = { ...base, houseStyle, imageProvider: settings.imageProvider };
  if (session.role !== "admin") return view;
  return {
    ...view,
    anthropicApiKey: "",
    googleAiApiKey: "",
    togetherApiKey: "",
    hfApiKey: "",
    hasAnthropicKey: Boolean(settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
    anthropicKeySource: settings.anthropicApiKey ? "database" : process.env.ANTHROPIC_API_KEY ? "env" : "none",
    hasGoogleAiKey: Boolean(settings.googleAiApiKey),
    hasTogetherKey: Boolean(settings.togetherApiKey),
    hasHfKey: Boolean(settings.hfApiKey),
  };
}

export async function GET(request: Request) {
  const auth = await guard(["agency", "admin", "client", "professional"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json(publicView(auth, request));
}

export async function PUT(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const agencyId = actingAgencyId(auth, request);
  const updated = updateAgencyBranding(agencyId, {
    name: parsed.data.agencyName,
    tagline: parsed.data.tagline,
    accentColor: parsed.data.accentColor,
    houseStyle: parsed.data.houseStyle,
  });
  if (!updated) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  if (auth.role === "admin") {
    const current = getSettings();
    const resolveKey = (incoming: string, existing: string) => {
      if (incoming === "") return existing; // em branco = mantém
      if (incoming.toLowerCase() === "clear") return ""; // "clear" = apaga
      return incoming;
    };
    saveSettings({
      imageProvider: parsed.data.imageProvider ?? current.imageProvider,
      landingPagesEnabled: parsed.data.landingPagesEnabled ?? current.landingPagesEnabled,
      aiMode: parsed.data.aiMode ?? current.aiMode,
      anthropicApiKey: resolveKey(parsed.data.anthropicApiKey, current.anthropicApiKey),
      googleAiApiKey: resolveKey(parsed.data.googleAiApiKey, current.googleAiApiKey),
      togetherApiKey: resolveKey(parsed.data.togetherApiKey, current.togetherApiKey),
      hfApiKey: resolveKey(parsed.data.hfApiKey, current.hfApiKey),
    });
  }
  return NextResponse.json(publicView(auth, request));
}
