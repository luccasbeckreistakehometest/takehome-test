import { NextResponse } from "next/server";
import { z } from "zod";
import { actingAgencyId, guard, isDenied } from "@/lib/guard";
import { getAgency } from "@/lib/agencies";
import { agencyScope } from "@/lib/tenancy-rules";
import {
  getAgencyPage,
  listLeads,
  listPortfolioCandidates,
  listShowcaseCandidates,
  saveAgencyPage,
  setPublicDeliverables,
  setShowcaseClients,
} from "@/lib/agency-page-db";

// Configuração da página pública da agência (Configurações → Página pública):
// slug, textos, serviços, depoimentos, peças do portfólio, clientes com
// consentimento e os leads recebidos.
// Cada agência tem a sua (admin: a do ?agency=, ou a da casa).
function view(agencyId: string) {
  const config = getAgencyPage(agencyId);
  return {
    config,
    agencyName: getAgency(agencyId)?.name ?? "",
    path: config.slug ? `/a/${config.slug}` : "",
    portfolio: listPortfolioCandidates(agencyId),
    clients: listShowcaseCandidates(agencyId),
    leads: listLeads(agencyScope(agencyId), 50),
  };
}

export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const agencyId = actingAgencyId(auth, request);
  if (!getAgency(agencyId)) return NextResponse.json({ error: "Agência não encontrada" }, { status: 404 });
  return NextResponse.json(view(agencyId));
}

const schema = z.object({
  config: z
    .object({
      slug: z.string().max(80).optional(),
      published: z.boolean().optional(),
      headline: z.string().max(200).optional(),
      about: z.string().max(2000).optional(),
      services: z.array(z.string().max(120)).max(20).optional(),
      testimonials: z.array(z.object({ author: z.string().max(120), role: z.string().max(120).default(""), text: z.string().max(1000) })).max(12).optional(),
      showClients: z.boolean().optional(),
      ctaTitle: z.string().max(120).optional(),
      whatsapp: z.string().max(30).optional(),
    })
    .default({}),
  portfolioIds: z.array(z.string()).max(200).optional(),
  showcaseClientIds: z.array(z.string()).max(500).optional(),
});

export async function PUT(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const agencyId = actingAgencyId(auth, request);
  const saved = saveAgencyPage(agencyId, parsed.data.config);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 409 });
  if (parsed.data.portfolioIds) setPublicDeliverables(agencyId, parsed.data.portfolioIds);
  if (parsed.data.showcaseClientIds) setShowcaseClients(agencyId, parsed.data.showcaseClientIds);
  return NextResponse.json(view(agencyId));
}
