import { getAgency } from "./agencies";
import { brandOf, type Brand } from "./branding";
import { getClient } from "./db";
import { routeArtefact } from "./doc-routes";
import { findPublishedPage } from "./agency-page-db";
import { getProposalByToken } from "./proposals-db";
import { getInvoiceByToken } from "./invoices-db";
import { getApprovalLinkByToken } from "./approval-links-db";
import { getMonthlyReportByToken } from "./reports-db";

// A marca de uma PEÇA vem do endereço, não da sessão: quem abre a proposta é o
// prospect (anônimo), quem abre a fatura é o cliente da agência, e os dois
// precisam ver a marca de quem mandou o link — não a da plataforma.
// Uma consulta por id; a peça em si carrega os dados completos.
function agencyIdOfClient(clientId: string | null | undefined): string | null {
  if (!clientId) return null;
  return getClient(clientId)?.agencyId ?? null;
}

export function agencyIdForRoute(pathname: string): string | null {
  const artefact = routeArtefact(pathname);
  if (!artefact) return null;
  switch (artefact.kind) {
    case "agency-page":
      return findPublishedPage(artefact.key)?.agencyId ?? null;
    case "proposal":
      return getProposalByToken(artefact.key)?.agencyId ?? null;
    case "invoice":
      return getInvoiceByToken(artefact.key)?.agencyId ?? null;
    case "approval": {
      const link = getApprovalLinkByToken(artefact.key);
      return link?.agencyId || agencyIdOfClient(link?.clientId);
    }
    case "report":
      return agencyIdOfClient(getMonthlyReportByToken(artefact.key)?.clientId);
    // /print/[id] roda dentro da sessão da agência: a marca já é a certa.
    case "print":
      return null;
  }
}

/** A marca da agência dona da peça, ou null quando a rota não é uma peça. */
export function brandForRoute(pathname: string): Brand | null {
  const agencyId = agencyIdForRoute(pathname);
  if (!agencyId) return null;
  const agency = getAgency(agencyId);
  return agency ? brandOf(agency) : null;
}
