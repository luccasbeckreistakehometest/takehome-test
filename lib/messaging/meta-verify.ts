// Confirma, antes de salvar, que quem conecta um número de WhatsApp ou uma
// conta do Instagram tem acesso a ela: o token informado precisa enxergar o id
// na Graph API da Meta. Sem isso, uma agência poderia salvar o id de outra e
// receber as mensagens dela (o webhook roteia pelo id).
//
// META_GRAPH_VERIFY=off desliga a checagem (só para o e2e, que não fala com a
// Meta). Nunca use em produção.

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaVerifyResult = { ok: true } | { ok: false; status: number; error: string };

export const META_NOT_CONFIRMED =
  "A Meta não confirmou que este token tem acesso a essa conta. Confira o ID e o token.";
export const META_UNREACHABLE = "Não deu para confirmar a conta na Meta agora. Tente de novo em instantes.";
export const META_TOKEN_REQUIRED = "Informe o token da conta para confirmarmos que ela é sua.";
export const META_ACCOUNT_TAKEN = "Essa conta já está conectada em outra agência. Se ela é sua, fale com o suporte.";

export async function verifyMetaAccount(
  accountId: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<MetaVerifyResult> {
  const id = accountId.trim();
  if (!id) return { ok: true };
  if (process.env.META_GRAPH_VERIFY === "off") return { ok: true };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: META_NOT_CONFIRMED };
  if (!token.trim()) return { ok: false, status: 400, error: META_TOKEN_REQUIRED };
  try {
    const res = await fetchImpl(`${GRAPH}/${encodeURIComponent(id)}?fields=id`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // 5xx da Meta = indisponível; 4xx = token sem acesso / id inexistente
      return res.status >= 500
        ? { ok: false, status: 502, error: META_UNREACHABLE }
        : { ok: false, status: 400, error: META_NOT_CONFIRMED };
    }
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    if (!body || String(body.id ?? "") !== id) return { ok: false, status: 400, error: META_NOT_CONFIRMED };
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: META_UNREACHABLE };
  }
}
