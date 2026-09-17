// Fixture genérica para AI_MOCK=1 (testes e2e): monta um objeto que satisfaz
// o JSON Schema do structured output, sem chamar a API. Permite exercitar
// qualquer rota de IA (cobrança, permissões, fluxo de tela) de forma
// determinística. Nunca usado em produção (AI_MOCK não é definido lá).

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  minItems?: number;
  anyOf?: Schema[];
  oneOf?: Schema[];
};

function firstType(schema: Schema): string | undefined {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== "null") ?? schema.type[0];
  return schema.type;
}

export function mockFromSchema(schema: unknown, key = "item", depth = 0): unknown {
  const s = (schema ?? {}) as Schema;
  if (s.const !== undefined) return s.const;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
  if (s.anyOf?.length) return mockFromSchema(s.anyOf[0], key, depth);
  if (s.oneOf?.length) return mockFromSchema(s.oneOf[0], key, depth);
  const type = firstType(s) ?? (s.properties ? "object" : s.items ? "array" : "string");
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(s.properties ?? {})) {
        out[name] = mockFromSchema(child, name, depth + 1);
      }
      return out;
    }
    case "array": {
      if (depth > 6) return [];
      const count = Math.max(2, s.minItems ?? 0);
      return Array.from({ length: count }, (_, i) => mockFromSchema(s.items, `${key}${i + 1}`, depth + 1));
    }
    case "integer":
      return 3;
    case "number":
      return 72;
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      return `Exemplo de ${key} (modo de teste)`;
  }
}

export function mockLandingHtml(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Landing de teste</title></head><body><h1>Landing de teste</h1><p>Gerada no modo de teste.</p></body></html>`;
}
