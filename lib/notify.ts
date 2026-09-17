import { logActivity } from "./marketplace-db";
import { queueAgencyWhatsapp } from "./approvals-db";

// Aviso para a agência em dois canais: sempre no painel (sino) e, quando as
// regras de aprovação têm WhatsApp ligado + número + canal conectado, também
// na fila de WhatsApp. Reutilizado por aprovações e propostas aceitas.
export function notifyAgency(input: {
  agencyId: string;
  text: string;
  href?: string;
  clientId?: string | null;
  projectId?: string | null;
  whatsappBody?: string;
}): { whatsapp: { outboxId: string; to: string } | null } {
  logActivity({
    agencyId: input.agencyId,
    audience: "agency",
    text: input.text,
    href: input.href,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
  });
  const whatsapp = input.whatsappBody ? queueAgencyWhatsapp(input.agencyId, input.whatsappBody) : null;
  return { whatsapp };
}
