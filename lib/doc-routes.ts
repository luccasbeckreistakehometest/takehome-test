// Que peça está neste endereço — e se a casca da plataforma entra.
//
// docs/DESIGN.md §10: relatório, proposta, fatura, aprovação e a página
// pública são o que a AGÊNCIA mostra ao cliente DELA. Até aqui o layout raiz
// emoldurava as cinco com o logo da Marqa, o "Entrar" laranja da plataforma e
// o rodapé institucional da plataforma — na proposta, o "Entrar" ficava mais
// alto que "Aceitar proposta". Módulo puro de propósito: o layout e os testes
// unitários leem a mesma regra.

export type RouteArtefact =
  /** /a/[slug] — a página pública da agência (site dela, não do produto) */
  | { kind: "agency-page"; key: string }
  /** /proposta/[token] */
  | { kind: "proposal"; key: string }
  /** /fatura/[token] */
  | { kind: "invoice"; key: string }
  /** /aprovar/[token] */
  | { kind: "approval"; key: string }
  /** /print/report/[token] */
  | { kind: "report"; key: string }
  /** /print/[id] — impressão de entregáveis, já dentro da sessão da agência */
  | { kind: "print"; key: string };

const SEGMENT = /^[A-Za-z0-9._~-]{1,128}$/;

function one(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).replace(/\/+$/, "");
  return rest && SEGMENT.test(rest) ? rest : null;
}

export function routeArtefact(pathname: string): RouteArtefact | null {
  const path = pathname.split("?")[0];
  const report = one(path, "/print/report/");
  if (report) return { kind: "report", key: report };
  const print = one(path, "/print/");
  if (print) return { kind: "print", key: print };
  const slug = one(path, "/a/");
  if (slug) return { kind: "agency-page", key: slug };
  const proposal = one(path, "/proposta/");
  if (proposal) return { kind: "proposal", key: proposal };
  const invoice = one(path, "/fatura/");
  if (invoice) return { kind: "invoice", key: invoice };
  const approval = one(path, "/aprovar/");
  if (approval) return { kind: "approval", key: approval };
  return null;
}

/**
 * A peça é servida SEM a casca do produto: sem trilho, sem barra superior com
 * o logo da plataforma, sem "Entrar", sem rodapé institucional e sem o FAB do
 * assistente. Cada uma dessas telas já traz o próprio cabeçalho com a marca da
 * agência e o próprio rodapé.
 */
export function isChromelessRoute(pathname: string): boolean {
  return routeArtefact(pathname) !== null;
}
