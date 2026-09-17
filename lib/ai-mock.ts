import { getSettings } from "./settings";

// AI_MOCK=1 (testes/e2e) liga fixtures determinísticas em todas as features
// novas. `orNoKey` amplia o mock para quando não há chave da Anthropic — só
// para features onde um texto de exemplo é preferível a um erro (relatório
// mensal). Para respostas que saem para clientes finais (atendente) e para
// propostas comerciais, sem chave é erro, nunca fixture.
export function isAiMock(opts: { orNoKey?: boolean } = {}): boolean {
  if (process.env.AI_MOCK === "1") return true;
  if (!opts.orNoKey) return false;
  const hasKey = Boolean(getSettings().anthropicApiKey || process.env.ANTHROPIC_API_KEY);
  return !hasKey;
}
