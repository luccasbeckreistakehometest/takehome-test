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
  aiMode: z.enum(["economy", "balanced", "premium"]).default("balanced"),
  // Chaves: string vazia = manter a atual; "clear" = apagar
  anthropicApiKey: z.string().trim().default(""),
  googleAiApiKey: z.string().trim().default(""),
  togetherApiKey: z.string().trim().default(""),
  imageProvider: z.enum(["pollinations", "together"]).default("pollinations"),
  houseStyle: z.string().trim().default(""),
});

// As chaves nunca voltam ao navegador — só o status de configuração
function publicView() {
  const settings = getSettings();
  return {
    agencyName: settings.agencyName,
    tagline: settings.tagline,
    accentColor: settings.accentColor,
    landingPagesEnabled: settings.landingPagesEnabled,
    aiMode: settings.aiMode,
    houseStyle: settings.houseStyle,
    imageProvider: settings.imageProvider,
    logoMime: settings.logoMime,
    anthropicApiKey: "",
    googleAiApiKey: "",
    togetherApiKey: "",
    hasAnthropicKey: Boolean(settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY),
    hasGoogleAiKey: Boolean(settings.googleAiApiKey),
    hasTogetherKey: Boolean(settings.togetherApiKey),
  };
}

export async function GET() {
  return NextResponse.json(publicView());
}

export async function PUT(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const current = getSettings();
  const resolveKey = (incoming: string, existing: string) => {
    if (incoming === "") return existing; // em branco = mantém
    if (incoming.toLowerCase() === "clear") return ""; // "clear" = apaga
    return incoming;
  };
  saveSettings({
    agencyName: parsed.data.agencyName,
    tagline: parsed.data.tagline,
    accentColor: parsed.data.accentColor,
    landingPagesEnabled: parsed.data.landingPagesEnabled,
    aiMode: parsed.data.aiMode,
    houseStyle: parsed.data.houseStyle,
    imageProvider: parsed.data.imageProvider,
    logoMime: current.logoMime, // gerenciado pela rota /logo, preservado aqui
    anthropicApiKey: resolveKey(parsed.data.anthropicApiKey, current.anthropicApiKey),
    googleAiApiKey: resolveKey(parsed.data.googleAiApiKey, current.googleAiApiKey),
    togetherApiKey: resolveKey(parsed.data.togetherApiKey, current.togetherApiKey),
  });
  return NextResponse.json(publicView());
}
