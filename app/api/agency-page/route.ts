import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isDenied } from "@/lib/guard";
import {
  getAgencyPage,
  listLeads,
  listPortfolioCandidates,
  listShowcaseCandidates,
  saveAgencyPage,
  setPublicDeliverables,
  setShowcaseClients,
} from "@/lib/agency-page-db";
import { getSettings } from "@/lib/settings";

// Configuração da página pública da agência (Configurações → Página pública):
// slug, textos, serviços, depoimentos, peças do portfólio, clientes com
// consentimento e os leads recebidos.
function view() {
  const config = getAgencyPage();
  const settings = getSettings();
  return {
    config,
    agencyName: settings.agencyName,
    path: config.slug ? `/a/${config.slug}` : "",
    portfolio: listPortfolioCandidates(),
    clients: listShowcaseCandidates(),
    leads: listLeads(50),
  };
}

export async function GET() {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  return NextResponse.json(view());
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
  saveAgencyPage(parsed.data.config);
  if (parsed.data.portfolioIds) setPublicDeliverables(parsed.data.portfolioIds);
  if (parsed.data.showcaseClientIds) setShowcaseClients(parsed.data.showcaseClientIds);
  return NextResponse.json(view());
}
