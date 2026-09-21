import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { scopeForSession } from "@/lib/tenancy-rules";
import { listProspects } from "@/lib/marketplace-db";
import { listRecentProposals } from "@/lib/proposals-db";
import { countLeads, getAgencyPage } from "@/lib/agency-page-db";
import { GROWTH_CARDS, type GrowthStats } from "@/lib/growth-cards";
import { agencyLinksOverview } from "@/lib/links-db";
import { agencyRadarOverview } from "@/lib/ai-visibility-db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crescimento" };

// Crescimento: tudo o que traz cliente novo ou vende mais para quem já é
// cliente, num lugar só. Cada card leva para onde a ferramenta vive.
export default async function GrowthPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "agency" && session.role !== "admin") redirect("/");
  const scope = scopeForSession(session);
  const agencyId = session.agencyId ?? "agency";
  const proposals = listRecentProposals(scope, 200);
  const links = agencyLinksOverview(scope.agencyId);
  const stats: GrowthStats = {
    prospects: listProspects(scope).length,
    openProposals: proposals.filter((p) => p.state === "open").length,
    acceptedProposals: proposals.filter((p) => p.state === "accepted").length,
    leads: countLeads(scope),
    pagePublished: getAgencyPage(agencyId).published,
    clicks30: links.reduce((sum, r) => sum + r.clicks30, 0),
    bioPages: links.filter((r) => r.bioPublished).length,
    radarClients: agencyRadarOverview(scope.agencyId).filter((r) => r.ranAt).length,
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="d3">Crescimento</h1>
        <p className="t3 measure-lede mt-2 text-text-muted">Onde a agência encontra cliente novo e vende mais para quem já está com você.</p>
      </div>
      {/* Hub de destinos: lista numerada com o número do estado à direita, não
          cinco cartões iguais. O que diferencia os cinco é o texto, e o texto
          fica na medida de leitura. */}
      <div className="border-t border-edge" data-testid="growth-hub">
        {GROWTH_CARDS.map((card, i) => (
          <Link
            key={card.key}
            href={card.href}
            data-testid={`growth-${card.key}`}
            className="group flex items-baseline gap-4 border-b border-rule py-4 transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken"
          >
            <span className="idx t5 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1">
              <span className="t2 block font-medium underline-offset-4 group-hover:underline">
                {card.title}
              </span>
              <span className="t4 measure-prose mt-0.5 block text-text-muted">{card.body}</span>
            </span>
            <span className="t5 hidden shrink-0 text-text-muted sm:block">{card.stat(stats)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
