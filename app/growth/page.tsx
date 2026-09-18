import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { scopeForSession } from "@/lib/tenancy-rules";
import { listProspects } from "@/lib/marketplace-db";
import { listRecentProposals } from "@/lib/proposals-db";
import { countLeads, getAgencyPage } from "@/lib/agency-page-db";
import { Icon } from "@/components/icons";
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="growth-hub">
        {GROWTH_CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            data-testid={`growth-${card.key}`}
            className="card-hover flex flex-col rounded-md border border-edge bg-surface p-5 shadow-sm"
          >
            <span className="flex items-center gap-2 font-medium">
              <Icon name={card.icon} size={18} className="text-text" /> {card.title}
            </span>
            <span className="mt-2 flex-1 t3 text-text-muted">{card.body}</span>
            <span className="mt-4 flex items-center justify-between t5">
              <span className="text-text-muted">{card.stat(stats)}</span>
              <span className="font-medium text-text">{card.cta} →</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
