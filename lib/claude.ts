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
  webSearchMaxUses?: number;
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
    const message = await streamWithRetry({
      model: pickModel(options.tier ?? "premium"),
      max_tokens: options.maxTokens,
      thinking: { type: "adaptive" },
      system: options.system,
      messages,
      ...(options.useWebSearch
        ? { tools: [{ ...WEB_SEARCH_TOOL, max_uses: options.webSearchMaxUses ?? WEB_SEARCH_TOOL.max_uses }] }
        : {}),
      ...(options.outputSchema
        ? {
            output_config: {
              format: { type: "json_schema" as const, schema: options.outputSchema },
            },
          }
        : {}),
    });
    if (message.stop_reason !== "pause_turn") return message;
    messages = [...messages, { role: "assistant", content: message.content }];
  }
  throw new GenerationError(
    "A pesquisa de mercado excedeu o limite de iterações. Tente novamente."
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sobrecarga (529 overloaded_error) e 5xx são transitórios: o servidor da
// Anthropic está com pico. Reexecutamos com backoff exponencial + jitter em
// vez de deixar a geração inteira falhar por um blip momentâneo.
function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    return status === 429 || status === 529 || status >= 500;
  }
  if (error instanceof Anthropic.APIConnectionError) return true;
  return false;
}

async function streamWithRetry(
  params: Anthropic.MessageStreamParams
): Promise<Anthropic.Message> {
  const maxRetries = 4;
  for (let attempt = 0; ; attempt++) {
    try {
      const stream = getAnthropicClient().messages.stream(params);
      return await stream.finalMessage();
    } catch (error) {
      if (attempt >= maxRetries || !isRetryable(error)) throw error;
      // 1.5s, 3s, 6s, 12s (+ jitter) — dá tempo do pico passar
      const backoff = 1500 * 2 ** attempt + Math.floor(Math.random() * 500);
      await sleep(backoff);
    }
  }
}

export async function generateStructured<T>(options: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  useWebSearch?: boolean;
  webSearchMaxUses?: number;
  images?: RequestOptions["images"];
  tier?: ModelTier;
}): Promise<T> {
  try {
    const message = await runMessage({
      system: options.system,
      prompt: options.prompt,
      maxTokens: options.maxTokens ?? 32000,
      useWebSearch: options.useWebSearch,
      webSearchMaxUses: options.webSearchMaxUses,
      outputSchema: options.schema,
      images: options.images,
      tier: options.tier,
    });
    return extractJson<T>(message);
  } catch (error) {
    translateError(error);
  }
}

// Com web search o modelo emite blocos de texto intermediários entre as
// buscas — só o último bloco carrega o JSON do structured output. Tenta do
// fim para o início e cai no join completo como último recurso.
function extractJson<T>(message: Anthropic.Message): T {
  const blocks = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text.trim())
    .filter(Boolean);
  if (blocks.length === 0) {
    throw new GenerationError("A IA retornou uma resposta vazia. Tente novamente.");
  }
  const candidates = [...blocks].reverse().concat(blocks.join(""));
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // tenta o próximo bloco
    }
  }
  throw new GenerationError(
    "A IA respondeu fora do formato esperado. Tente novamente."
  );
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
