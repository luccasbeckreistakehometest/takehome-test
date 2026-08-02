import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "./settings";

// Dois níveis de modelo para controle de custo:
// - premium: decisões críticas (estratégia, match, análise de arte, landing)
// - standard: entregáveis táticos — no modo econômico usa Sonnet (~3x mais barato)
export const PREMIUM_MODEL = "claude-opus-4-8";
export const STANDARD_MODEL = "claude-sonnet-5";
export type ModelTier = "premium" | "standard";

export function pickModel(tier: ModelTier): string {
  const mode = getSettings().aiMode;
  if (mode === "economy") return STANDARD_MODEL;
  if (mode === "premium") return PREMIUM_MODEL;
  return tier === "standard" ? STANDARD_MODEL : PREMIUM_MODEL;
}

// Cliente por chamada: usa a chave salva nos Settings se existir; senão a do
// ambiente (.env.local ou perfil)
function getAnthropicClient(): Anthropic {
  const key = getSettings().anthropicApiKey;
  return key ? new Anthropic({ apiKey: key }) : new Anthropic();
}

export class GenerationError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export const WEB_SEARCH_TOOL = {
  type: "web_search_20260209" as const,
  name: "web_search" as const,
  max_uses: 5,
};

function extractText(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    throw new GenerationError(
      "A IA recusou esta solicitação. Ajuste o briefing ou os parâmetros e tente novamente.",
      422
    );
  }
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) {
    throw new GenerationError("A IA retornou uma resposta vazia. Tente novamente.");
  }
  return text;
}

function translateError(error: unknown): never {
  if (error instanceof GenerationError) throw error;
  if (error instanceof Anthropic.AuthenticationError) {
    throw new GenerationError(
      "Chave da API inválida ou ausente. Defina ANTHROPIC_API_KEY em .env.local (veja .env.example).",
      401
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    throw new GenerationError(
      "Limite de requisições da API atingido. Aguarde alguns instantes e tente novamente.",
      429
    );
  }
  if (error instanceof Anthropic.APIError) {
    throw new GenerationError(`Erro na API da Claude: ${error.message}`);
  }
  throw new GenerationError(
    error instanceof Error ? error.message : "Erro inesperado ao gerar conteúdo."
  );
}

type RequestOptions = {
  system: string;
  prompt: string;
  maxTokens: number;
  useWebSearch?: boolean;
  outputSchema?: Record<string, unknown>;
  images?: {
    base64: string;
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    label?: string;
  }[];
  tier?: ModelTier;
};

// Roda a request com streaming (respostas longas) e retoma automaticamente
// quando o loop de web search do servidor pausa com stop_reason "pause_turn".
async function runMessage(options: RequestOptions): Promise<Anthropic.Message> {
  let content: Anthropic.MessageParam["content"] = options.prompt;
  if (options.images?.length) {
    const blocks: Anthropic.ContentBlockParam[] = [];
    options.images.forEach((image, index) => {
      blocks.push({
        type: "text",
        text: `Imagem ${index + 1}${image.label ? ` — ${image.label}` : ""}:`,
      });
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.base64,
        },
      });
    });
    blocks.push({ type: "text", text: options.prompt });
    content = blocks;
  }
  let messages: Anthropic.MessageParam[] = [{ role: "user", content }];

  for (let attempt = 0; attempt < 6; attempt++) {
    const stream = getAnthropicClient().messages.stream({
      model: pickModel(options.tier ?? "premium"),
      max_tokens: options.maxTokens,
      thinking: { type: "adaptive" },
      system: options.system,
      messages,
      ...(options.useWebSearch ? { tools: [WEB_SEARCH_TOOL] } : {}),
      ...(options.outputSchema
        ? {
            output_config: {
              format: { type: "json_schema" as const, schema: options.outputSchema },
            },
          }
        : {}),
    });
    const message = await stream.finalMessage();
    if (message.stop_reason !== "pause_turn") return message;
    messages = [...messages, { role: "assistant", content: message.content }];
  }
  throw new GenerationError(
    "A pesquisa de mercado excedeu o limite de iterações. Tente novamente."
  );
}

export async function generateStructured<T>(options: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  useWebSearch?: boolean;
  images?: RequestOptions["images"];
  tier?: ModelTier;
}): Promise<T> {
  try {
    const message = await runMessage({
      system: options.system,
      prompt: options.prompt,
      maxTokens: options.maxTokens ?? 32000,
      useWebSearch: options.useWebSearch,
      outputSchema: options.schema,
      images: options.images,
      tier: options.tier,
    });
    return JSON.parse(extractText(message)) as T;
  } catch (error) {
    translateError(error);
  }
}

export async function generateHtml(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<string> {
  try {
    const message = await runMessage({
      system: options.system,
      prompt: options.prompt,
      maxTokens: options.maxTokens ?? 64000,
      tier: options.tier,
    });
    let html = extractText(message).trim();
    // Defensivo: remove cercas de markdown caso o modelo envolva o documento
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
    const doctypeIndex = html.search(/<!doctype html/i);
    if (doctypeIndex > 0) html = html.slice(doctypeIndex);
    return html;
  } catch (error) {
    translateError(error);
  }
}
