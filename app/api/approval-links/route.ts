import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/db";
import { guard, isDenied } from "@/lib/guard";
import { approvalCandidates, createApprovalLink, listApprovalLinks } from "@/lib/approval-links-db";
import { shareText, whatsappShareUrl } from "@/lib/approval-link-rules";
import { appBaseUrl } from "@/lib/legal";
import { getAgency } from "@/lib/agencies";

// Links de aprovação de um cliente (agência): lista, candidatos e criação.
export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId") ?? "";
  const auth = await guard(["agency", "admin"], { clientId });
  if (isDenied(auth)) return auth;
  const base = appBaseUrl();
  return NextResponse.json({
    links: listApprovalLinks(clientId).map((link) => ({ ...link, url: `${base}/aprovar/${link.token}` })),
    candidates: approvalCandidates(clientId),
  });
}

const schema = z.object({
  clientId: z.string().min(1).max(100),
  items: z
    .array(z.object({ kind: z.enum(["post", "deliverable"]), id: z.string().min(1).max(100) }))
    .min(1)
    .max(30),
  days: z.number().int().min(1).max(60).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha pelo menos um item." }, { status: 400 });
  const auth = await guard(["agency", "admin"], { clientId: parsed.data.clientId });
  if (isDenied(auth)) return auth;
  const client = getClient(parsed.data.clientId);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  const result = createApprovalLink({ clientId: client.id, createdBy: auth.userId, items: parsed.data.items, days: parsed.data.days });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const url = `${appBaseUrl()}/aprovar/${result.link.token}`;
  const agencyName = getAgency(client.agencyId)?.name ?? "sua agência";
  const text = shareText({ clientName: client.name, agencyName, url, count: result.link.items.length, lang: client.language });
  return NextResponse.json(
    { link: result.link, url, text, whatsappUrl: whatsappShareUrl(text, parsed.data.phone) },
    { status: 201 }
  );
}
