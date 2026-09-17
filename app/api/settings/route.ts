import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, saveSettings } from "@/lib/settings";
import { guard, isDenied } from "@/lib/guard";
import type { SessionPayload } from "@/lib/auth-shared";

const settingsSchema = z.object({
  agencyName: z.string().trim().min(1, "Nome é obrigatório").max(80),
  tagline: z.string().trim().max(160).default(""),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor em formato #rrggbb"),
  houseStyle: z.string().trim().max(4000).default(""),
  imageProvider: z.enum(["huggingface", "together", "pollinations"]).default("pollinations"),
  // Só o admin da plataforma: custo e credenciais.
  landingPagesEnabled: z.boolean().optional(),
  aiMode: z.enum(["economy", "balanced", "premium"]).optional(),
  // Chaves: string vazia = manter a atual; "clear" = apagar
  anthropicApiKey: z.string().trim().max(400).default(""),
  googleAiApiKey: z.string().trim().max(400).default(""),
  togetherApiKey: z.string().trim().max(400).default(""),
  hfApiKey: z.string().trim().max(400).default(""),
});

// As chaves nunca voltam ao navegador; nem a presença delas, exceto para o admin.
function publicView(session: SessionPayload) {
  const settings = getSettings();
  const base = {
    agencyName: settings.agencyName,
    tagline: settings.tagline,
    accentColor: settings.accentColor,
    landingPagesEnabled: settings.landingPagesEnabled,
    aiMode: settings.aiMode,
    logoMime: settings.logoMime,
    canManagePlatform: session.role === "admin",
    viewerRole: session.role,
  };
  if (session.role !== "agency" && session.role !== "admin") return base;
  const view = { ...base, houseStyle: settings.houseStyle, imageProvider: settings.imageProvider };
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

export async function GET() {
  const auth = await guard(["agency", "admin", "client", "professional"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json(publicView(auth));
}

export async function PUT(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const current = getSettings();
  const isAdmin = auth.role === "admin";
  const resolveKey = (incoming: string, existing: string) => {
    if (!isAdmin || incoming === "") return existing; // em branco (ou não-admin) = mantém
    if (incoming.toLowerCase() === "clear") return ""; // "clear" = apaga
    return incoming;
  };
  saveSettings({
    agencyName: parsed.data.agencyName,
    tagline: parsed.data.tagline,
    accentColor: parsed.data.accentColor,
    houseStyle: parsed.data.houseStyle,
    imageProvider: parsed.data.imageProvider,
    landingPagesEnabled: isAdmin ? (parsed.data.landingPagesEnabled ?? current.landingPagesEnabled) : current.landingPagesEnabled,
    aiMode: isAdmin ? (parsed.data.aiMode ?? current.aiMode) : current.aiMode,
    logoMime: current.logoMime, // gerenciado pela rota /logo, preservado aqui
    anthropicApiKey: resolveKey(parsed.data.anthropicApiKey, current.anthropicApiKey),
    googleAiApiKey: resolveKey(parsed.data.googleAiApiKey, current.googleAiApiKey),
    togetherApiKey: resolveKey(parsed.data.togetherApiKey, current.togetherApiKey),
    hfApiKey: resolveKey(parsed.data.hfApiKey, current.hfApiKey),
  });
  return NextResponse.json(publicView(auth));
}
