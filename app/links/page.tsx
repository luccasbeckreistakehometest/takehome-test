import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { scopeForSession } from "@/lib/tenancy-rules";
import { agencyLinksOverview } from "@/lib/links-db";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links & bio" };

// Links & bio de todos os clientes: quem tem página no ar e quanto clicaram.
export default async function LinksOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "agency" && session.role !== "admin") redirect("/");
  const rows = agencyLinksOverview(scopeForSession(session).agencyId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="d3">Links & bio</h1>
        <p className="t3 measure-lede mt-2 text-text-muted">Links curtos com UTM automático e a página de link na bio de cada cliente. Os cliques entram no relatório mensal.</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-4 t3 text-text-muted">Cadastre um cliente para criar os primeiros links.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge bg-surface">
          <table className="w-full min-w-[520px] text-left t3" data-testid="links-overview">
            <thead className="t5 uppercase text-text-muted">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-right">Links</th>
                <th className="px-4 py-2 text-right">Cliques (30 dias)</th>
                <th className="px-4 py-2">Link na bio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.clientId}>
                  <td className="px-4 py-2">
                    <Link href={`/clients/${row.clientId}?tab=bio`} className="font-medium hover:text-text">
                      {row.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.links}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.clicks30}</td>
                  <td className="px-4 py-2 t5">
                    {row.bioSlug && row.bioPublished ? (
                      <a href={`/b/${row.bioSlug}`} target="_blank" rel="noreferrer" className="text-text hover:underline">
                        {`/b/${row.bioSlug}`}
                      </a>
                    ) : (
                      <span className="text-text-muted">não publicada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
