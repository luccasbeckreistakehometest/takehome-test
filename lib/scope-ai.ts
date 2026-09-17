import { CHEAP_MODEL, generateStructured, recordMockCall } from "./claude";
import { aiUsable, isAiMock } from "./ai-mock";
import { aiHash, readAiCache, writeAiCache } from "./ai-cache";
import { guessItem, type ClientPackage } from "./scope-rules";

// Classifica um pedido do portal num item do pacote (modelo barato, saída
// curta, cache por texto + pacote). Sem chave: o cliente escolhe no menu.

export type ScopeGuess = { itemKey: string; qty: number; confidence: number; reasoning: string; source: "ai" | "rules"; cached: boolean };

export function scopeAiAvailable(): boolean {
  return aiUsable();
}

export function scopeCacheKey(text: string, pkg: ClientPackage): string {
  return aiHash("scope_classify", { text: text.trim().toLowerCase(), items: pkg.items.map((i) => [i.key, i.unit, i.label]) });
}

export function cachedScopeGuess(text: string, pkg: ClientPackage): ScopeGuess | null {
  const hit = readAiCache<Omit<ScopeGuess, "cached">>(scopeCacheKey(text, pkg));
  return hit ? { ...hit, cached: true } : null;
}

export async function classifyScopeRequest(clientId: string, text: string, pkg: ClientPackage, lang: "pt-BR" | "en"): Promise<ScopeGuess> {
  const keys = pkg.items.map((i) => i.key);
  let result: Omit<ScopeGuess, "cached">;
  if (isAiMock()) {
    recordMockCall({ model: CHEAP_MODEL });
    const g = guessItem(text, pkg);
    result = { ...g, reasoning: lang === "en" ? "Example classification (test mode)." : "Classificação de exemplo (modo de teste).", source: "ai" };
  } else {
    const out = await generateStructured<{ itemKey: string; qty: number; confidence: number; reasoning: string }>({
      model: CHEAP_MODEL,
      maxTokens: 300,
      system: `You map a client's request to one item of their marketing agency package. Pick the single best itemKey from the list; qty is how many units they ask for (default 1). confidence is 0-1. reasoning: one short sentence in ${lang === "en" ? "English" : "Brazilian Portuguese"}.`,
      prompt: `<package>\n${pkg.items.map((i) => `- itemKey=${i.key} · ${i.label} (${i.unit})`).join("\n")}\n</package>\n<request>\n${text.slice(0, 1500)}\n</request>`,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["itemKey", "qty", "confidence", "reasoning"],
        properties: {
          itemKey: { type: "string", enum: keys },
          qty: { type: "integer" },
          confidence: { type: "number" },
          reasoning: { type: "string" },
        },
      },
    });
    const itemKey = keys.includes(out.itemKey) ? out.itemKey : guessItem(text, pkg).itemKey;
    result = {
      itemKey,
      qty: Math.max(1, Math.min(50, Math.floor(out.qty || 1))),
      confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0)),
      reasoning: String(out.reasoning ?? "").slice(0, 300),
      source: "ai",
    };
  }
  writeAiCache(scopeCacheKey(text, pkg), "scope_classify", clientId, result);
  return { ...result, cached: false };
}
