// Junta parâmetros de query a um caminho que pode já ter "?" (evita
// "/x?a=1?b=2"). Usado nos redirecionamentos pós-cadastro.
export function withQuery(path: string, params: Record<string, string>): string {
  const [base, existing = ""] = path.split("?", 2);
  const search = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(params)) search.set(key, value);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
