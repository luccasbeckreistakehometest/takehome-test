// Custo estimado de uma chamada à API da Anthropic (puro, sem banco).

// US$ por milhão de tokens (preço de tabela da Anthropic). Modelo
// desconhecido cai no mais caro, para o teto errar para o lado seguro.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};
const FALLBACK_PRICE = { input: 5, output: 25 };
const WEB_SEARCH_USD = 10 / 1000; // US$ 10 por mil buscas

export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICES[model] ?? FALLBACK_PRICE;
  const input = Number(usage.input_tokens ?? 0);
  const output = Number(usage.output_tokens ?? 0);
  const cacheRead = Number(usage.cache_read_input_tokens ?? 0);
  const cacheWrite = Number(usage.cache_creation_input_tokens ?? 0);
  const searches = Number(usage.server_tool_use?.web_search_requests ?? 0);
  return (
    (input * price.input + output * price.output + cacheRead * price.input * 0.1 + cacheWrite * price.input * 1.25) /
      1_000_000 +
    searches * WEB_SEARCH_USD
  );
}

