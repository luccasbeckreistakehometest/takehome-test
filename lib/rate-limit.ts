// Limites de uso em memória (janela deslizante). Um processo só (VPS com um
// container), então memória basta; um restart zera as contagens — aceitável
// nesta escala. Chaves por IP (primeiro X-Forwarded-For, que o Caddy define)
// e por conta.

export type RateLimitVerdict = { ok: boolean; remaining: number; retryAfterMs: number };

export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  const limit = Math.max(1, Math.floor(opts.limit));
  const windowMs = Math.max(1000, opts.windowMs);
  return {
    limit,
    windowMs,
    // Conta a tentativa quando permitida; recusadas não consomem cota.
    check(key: string, now: number = Date.now()): RateLimitVerdict {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        const oldest = Math.min(...recent);
        hits.set(key, recent);
        return { ok: false, remaining: 0, retryAfterMs: Math.max(0, oldest + windowMs - now) };
      }
      recent.push(now);
      hits.set(key, recent);
      // Limpeza oportunista para o mapa não crescer para sempre
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      return { ok: true, remaining: limit - recent.length, retryAfterMs: 0 };
    },
    // Sem chave: zera tudo. Com chave: esquece só aquela (ex.: login certo).
    reset(key?: string) {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export function envInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

// Limitadores nomeados, únicos por processo (sobrevivem ao HMR do dev).
const registry = (globalThis as unknown as { __marqaLimiters?: Map<string, RateLimiter> }).__marqaLimiters ??
  new Map<string, RateLimiter>();
(globalThis as unknown as { __marqaLimiters?: Map<string, RateLimiter> }).__marqaLimiters = registry;

export function namedLimiter(name: string, opts: { limit: number; windowMs: number }): RateLimiter {
  let limiter = registry.get(name);
  if (!limiter) {
    limiter = createRateLimiter(opts);
    registry.set(name, limiter);
  }
  return limiter;
}

const MINUTE = 60_000;

// Políticas (padrões de produção; env só para ajustar sem novo deploy).
export const LIMITS = {
  loginPerIp: () => ({ limit: envInt(process.env.LOGIN_RATE_LIMIT_PER_IP, 30), windowMs: 15 * MINUTE }),
  loginPerAccount: () => ({ limit: envInt(process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT, 8), windowMs: 15 * MINUTE }),
  registerPerIp: () => ({ limit: envInt(process.env.REGISTER_RATE_LIMIT_PER_HOUR, 5), windowMs: 60 * MINUTE }),
  contactPerIp: () => ({ limit: envInt(process.env.CONTACT_RATE_LIMIT_PER_HOUR, 5), windowMs: 60 * MINUTE }),
  aiPerAccount: () => ({ limit: envInt(process.env.AI_RATE_LIMIT_PER_10MIN, 40), windowMs: 10 * MINUTE }),
  aiPerIp: () => ({ limit: envInt(process.env.AI_RATE_LIMIT_PER_IP_10MIN, 80), windowMs: 10 * MINUTE }),
  ttsPerAccount: () => ({ limit: envInt(process.env.TTS_RATE_LIMIT_PER_10MIN, 30), windowMs: 10 * MINUTE }),
  ttsPerIp: () => ({ limit: envInt(process.env.TTS_RATE_LIMIT_PER_IP_10MIN, 60), windowMs: 10 * MINUTE }),
  passwordPerAccount: () => ({ limit: 10, windowMs: 15 * MINUTE }),
  checkoutPerAccount: () => ({ limit: 20, windowMs: 60 * MINUTE }),
  webhookPerIp: () => ({ limit: envInt(process.env.WEBHOOK_RATE_LIMIT_PER_MIN, 120), windowMs: MINUTE }),
  exportPerAccount: () => ({ limit: 5, windowMs: 60 * MINUTE }),
  // páginas públicas por token (aprovação, fatura) e decisões nelas
  publicDecisionPerIp: () => ({ limit: envInt(process.env.PUBLIC_DECISION_RATE_LIMIT_PER_10MIN, 30), windowMs: 10 * MINUTE }),
  analyticsPerIp: () => ({ limit: envInt(process.env.ANALYTICS_RATE_LIMIT_PER_MIN, 120), windowMs: MINUTE }),
  publicReadPerIp: () => ({ limit: envInt(process.env.PUBLIC_READ_RATE_LIMIT_PER_10MIN, 300), windowMs: 10 * MINUTE }),
};

export type LimitName = keyof typeof LIMITS;

export function limiterFor(name: LimitName): RateLimiter {
  return namedLimiter(name, LIMITS[name]());
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) || "local";
}

// Checa vários limites de uma vez; devolve o primeiro que estourou.
export function checkLimits(checks: [LimitName, string][]): RateLimitVerdict {
  for (const [name, key] of checks) {
    const verdict = limiterFor(name).check(key);
    if (!verdict.ok) return verdict;
  }
  return { ok: true, remaining: 1, retryAfterMs: 0 };
}

export function retryAfterHeader(verdict: RateLimitVerdict): Record<string, string> {
  return { "Retry-After": String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))) };
}
