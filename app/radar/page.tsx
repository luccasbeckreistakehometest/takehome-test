import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { scopeForSession } from "@/lib/tenancy-rules";
import { agencyRadarOverview } from "@/lib/ai-visibility-db";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Radar de IA" };

// Radar de IA de todos os clientes: um serviço para revender todo mês.
export default async function RadarOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "agency" && session.role !== "admin") redirect("/");
  const rows = agencyRadarOverview(scopeForSession(session).agencyId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          <Icon name="radar" size={24} className="text-text" /> Radar de IA
        </h1>
        <p className="mt-1 text-sm text-muted">
          Quando alguém pergunta para uma IA, seus clientes aparecem? Simulação com busca na web, uma vez por semana por cliente — um entregável para vender todo mês.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-4 text-sm text-muted">Cadastre um cliente para montar o primeiro radar.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge bg-surface">
          <table className="w-full min-w-[480px] text-left text-sm" data-testid="radar-overview">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-right">Perguntas</th>
                <th className="px-4 py-2 text-right">Participação</th>
                <th className="px-4 py-2">Última rodada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {rows.map((row) => (
                <tr key={row.clientId}>
                  <td className="px-4 py-2">
                    <Link href={`/clients/${row.clientId}?tab=ai_radar`} className="font-medium hover:text-text">
                      {row.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.questions}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.shareOfVoice === null ? "—" : `${row.shareOfVoice}%`}</td>
                  <td className="px-4 py-2 text-xs text-muted">{row.ranAt ? row.ranAt.slice(0, 10).split("-").reverse().join("/") : "nunca"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
