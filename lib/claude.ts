import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "./settings";
import { aiBudgetBlock, currentAiContext, recordAiError, recordAiUsage, type AiContext } from "./ai-spend";
import { mockFromSchema, mockLandingHtml } from "./ai-schema-mock";

// Dois níveis de modelo para controle de custo:
// - premium: decisões críticas (estratégia, match, análise de arte, landing)
// - standard: entregáveis táticos — no modo econômico usa Sonnet (~3x mais barato)
export const PREMIUM_MODEL = "claude-opus-4-8";
export const STANDARD_MODEL = "claude-sonnet-5";
export type ModelTier = "premium" | "standard";

// O modo global (admin) é o teto; o plano de quem paga pode baixar mais.
const QUALITY_RANK = { economy: 0, balanced: 1, premium: 2 } as const;
export function pickModel(tier: ModelTier): string {
  const global = getSettings().aiMode;
  const plan = currentAiContext()?.quality ?? "premium";
  const mode = QUALITY_RANK[plan] < QUALITY_RANK[global] ? plan : global;
  if (mode === "economy") return STANDARD_MODEL;
  if (mode === "premium") return PREMIUM_MODEL;
  return tier === "standard" ? STANDARD_MODEL : PREMIUM_MODEL;
}

// Cliente por chamada: usa a chave salva nos Settings se existir; senão a do
// ambiente (.env.local ou perfil)
export function getAnthropicClient(): Anthropic {
  const key = getSettings().anthropicApiKey;
  return key ? new Anthropic({ apiKey: key }) : new Anthropic();
}

// Mensagens mostradas a quem usa: neutras e curtas (o dicionário da interface
// traduz para inglês). O detalhe técnico vai para o log e para o admin.
export const AI_UNAVAILABLE = "A IA está indisponível no momento. Tente de novo em alguns minutos.";
export const AI_BUSY = "A IA está com muita procura agora. Tente de novo em instantes.";
export const AI_PAUSED = "A IA está pausada por hoje. Volte amanhã ou fale com o suporte.";
export const AI_FREE_PAUSED = "A IA do plano grátis chegou ao limite de hoje. Volte amanhã ou escolha um plano para seguir agora.";
export const AI_ACCOUNT_PAUSED = "Sua conta chegou ao limite de uso de IA de hoje. Volte amanhã ou fale com o suporte.";
export const AI_BAD_OUTPUT = "A IA não conseguiu concluir desta vez. Tente de novo.";
export const AI_REFUSED = "A IA não pode atender este pedido. Ajuste o briefing e tente de novo.";

export class GenerationError extends Error {
  status: number;
  detail: string;
  constructor(message: string, status = 500, detail = "") {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "1";
}

// Disjuntores de gasto (global, bolso do grátis, teto da conta): passou de
// um deles, a chamada não sai. Sem `ctx`, usa o contexto da execução atual.
export function assertAiAvailable(ctx?: AiContext): void {
  const context = ctx ?? currentAiContext();
  const block = aiBudgetBlock(context);
  if (block === "global") {
    recordAiError("daily_ceiling", "teto diário global de gasto de IA atingido", context);
    throw new GenerationError(AI_PAUSED, 503, "daily_ceiling");
  }
  if (block === "free_pool") {
    recordAiError("free_daily_ceiling", "teto diário do plano grátis atingido", context);
    throw new GenerationError(AI_FREE_PAUSED, 503, "free_daily_ceiling");
  }
  if (block === "account") {
    recordAiError("account_daily_ceiling", "teto diário de gasto da conta atingido", context);
    throw new GenerationError(AI_ACCOUNT_PAUSED, 429, "account_daily_ceiling");
  }
}

// Modelo barato (classificação curta, sem pensamento estendido).
export const CHEAP_MODEL = "claude-haiku-4-5";

// Com AI_MOCK=1 nenhuma chamada sai, mas o caminho é o mesmo da produção:
// os tetos de gasto valem e o ledger ganha uma linha com um uso fictício
// pequeno (o admin e os testes enxergam o custo por conta/ação).
export const MOCK_USAGE = { input_tokens: 400, output_tokens: 150 } as const;
export function recordMockCall(opts: { tier?: ModelTier; model?: string; webSearches?: number } = {}): void {
  assertAiAvailable();
  const model = opts.model ?? pickModel(opts.tier ?? "premium");
  try {
    recordAiUsage(model, { ...MOCK_USAGE, server_tool_use: { web_search_requests: opts.webSearches ?? 0 } });
  } catch (error) {
    console.error("[ai] falha ao registrar uso (mock):", error);
  }
}

export const WEB_SEARCH_TOOL = {
  type: "web_search_20260209" as const,
  name: "web_search" as const,
  max_uses: 5,
};

function extractText(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    throw new GenerationError(AI_REFUSED, 422, "refusal");
  }
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) {
    throw new GenerationError(AI_BAD_OUTPUT, 502, "empty response");
  }
  return text;
}

export function translateError(error: unknown): never {
  if (error instanceof GenerationError) {
    if (error.detail !== "daily_ceiling") recordAiError("generation", error.detail || error.message);
    throw error;
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    recordAiError("auth", `chave da Anthropic inválida ou sem permissão: ${error.message}`);
    throw new GenerationError(AI_UNAVAILABLE, 503, "auth");
  }
  if (error instanceof Anthropic.RateLimitError) {
    recordAiError("rate_limit", error.message);
    throw new GenerationError(AI_BUSY, 429, "rate_limit");
  }
  if (error instanceof Anthropic.APIError) {
    recordAiError(`api_${error.status ?? "?"}`, error.message);
    throw new GenerationError(AI_UNAVAILABLE, 502, error.message);
  }
  const detail = error instanceof Error ? error.message : String(error);
  // Sem chave configurada o SDK falha antes de chamar a API.
  recordAiError(/api[_ ]?key|apiKey|authentication/i.test(detail) ? "auth" : "unexpected", detail);
  throw new GenerationError(AI_UNAVAILABLE, 503, detail);
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
  // modelo fixo (ex.: CHEAP_MODEL para classificação curta); ignora o tier
  model?: string;
  // localização aproximada para a busca na web (Radar de IA)
  webSearchUserLocation?: { city?: string; region?: string; country?: string; timezone?: string };
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

  const model = options.model ?? pickModel(options.tier ?? "premium");
  // Haiku 4.5 não tem pensamento adaptativo: vai sem o parâmetro.
  const thinking = model === CHEAP_MODEL ? {} : { thinking: { type: "adaptive" as const } };
  const location = options.webSearchUserLocation;
  const hasLocation = Boolean(location && (location.city || location.region || location.country || location.timezone));
  for (let attempt = 0; attempt < 6; attempt++) {
    assertAiAvailable();
    const message = await streamWithRetry({
      model,
      max_tokens: options.maxTokens,
      ...thinking,
      system: options.system,
      messages,
      ...(options.useWebSearch
        ? {
            tools: [
              {
                ...WEB_SEARCH_TOOL,
                max_uses: options.webSearchMaxUses ?? WEB_SEARCH_TOOL.max_uses,
                ...(hasLocation ? { user_location: { type: "approximate" as const, ...location } } : {}),
              },
            ],
          }
        : {}),
      ...(options.outputSchema
        ? {
            output_config: {
              format: { type: "json_schema" as const, schema: options.outputSchema },
            },
          }
        : {}),
    });
    try {
      recordAiUsage(model, message.usage);
    } catch (error) {
      console.error("[ai] falha ao registrar uso:", error);
    }
    if (message.stop_reason !== "pause_turn") return message;
    messages = [...messages, { role: "assistant", content: message.content }];
  }
  throw new GenerationError(AI_BAD_OUTPUT, 502, "pause_turn loop exceeded");
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
  model?: string;
  webSearchUserLocation?: RequestOptions["webSearchUserLocation"];
}): Promise<T> {
  if (aiMockEnabled()) {
    recordMockCall({ tier: options.tier, model: options.model, webSearches: options.useWebSearch ? 1 : 0 });
    return mockFromSchema(options.schema) as T;
  }
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
      model: options.model,
      webSearchUserLocation: options.webSearchUserLocation,
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
    throw new GenerationError(AI_BAD_OUTPUT, 502, "empty structured response");
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
  throw new GenerationError(AI_BAD_OUTPUT, 502, "structured output did not parse");
}

export async function generateHtml(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<string> {
  if (aiMockEnabled()) {
    recordMockCall({ tier: options.tier });
    return mockLandingHtml();
  }
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
