import { NextResponse } from "next/server";
import { guard, isDenied, notFound } from "@/lib/guard";
import { closeApprovalLink, getApprovalLink } from "@/lib/approval-links-db";
import { shareText, whatsappShareUrl } from "@/lib/approval-link-rules";
import { appBaseUrl } from "@/lib/legal";
import { getClient } from "@/lib/db";
import { getAgency } from "@/lib/agencies";

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const link = getApprovalLink(id);
  if (!link) return notFound("Link não encontrado");
  const auth = await guard(["agency", "admin"], { clientId: link.clientId });
  return isDenied(auth) ? auth : link;
}

// Reenviar: o mesmo texto do WhatsApp (o link continua o mesmo).
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const link = await authorize(id);
  if (link instanceof NextResponse) return link;
  const client = getClient(link.clientId)!;
  const url = `${appBaseUrl()}/aprovar/${link.token}`;
  const text = shareText({ clientName: client.name, agencyName: getAgency(client.agencyId)?.name ?? "", url, count: link.items.length, lang: client.language });
  return NextResponse.json({ url, text, whatsappUrl: whatsappShareUrl(text) });
}

// Encerrar o link (o cliente passa a ver "expirado").
export async function PATCH(_request: Request, { params }: Context) {
  const { id } = await params;
  const link = await authorize(id);
  if (link instanceof NextResponse) return link;
  closeApprovalLink(link.id);
  return NextResponse.json({ ok: true });
}
