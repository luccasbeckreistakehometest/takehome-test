import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { activationCounts, funnelCounts, recentSignups, topSources, visitorsPerDay } from "@/lib/analytics-db";
import { AUDIENCES, funnel, type Audience } from "@/lib/analytics-rules";
import { appBaseUrl } from "@/lib/legal";
import UtmBuilder from "./UtmBuilder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const STEP_LABEL: Record<string, string> = {
  view: "Visitas",
  cta_click: "Clique no botão",
  signup_started: "Começou o cadastro",
  signup_completed: "Criou a conta",
  first_value: "Primeira entrega da IA",
  checkout_started: "Abriu o pagamento",
  payment_approved: "Pagou",
};
const AUDIENCE_LABEL: Record<string, string> = { "": "Todos", geral: "Home", agencia: "Agências", marca: "Marcas", profissional: "Profissionais" };

type Props = { searchParams: Promise<{ days?: string; audience?: string; source?: string }> };

// Funil próprio, sem cookie: de onde vêm as visitas e onde o cadastro e o
// pagamento travam. Tudo do banco, sem biblioteca de gráfico.
export default async function AnalyticsPage({ searchParams }: Props) {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/");
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const audience: Audience | "" = AUDIENCES.includes(params.audience as Audience) ? (params.audience as Audience) : "";
  const source = params.source ?? "";
  const filter = { days, audience, source };
  const rows = funnel(funnelCounts(filter));
  const visitors = visitorsPerDay(filter);
  const sources = topSources(filter);
  const signups = recentSignups(20);
  const activation = activationCounts(filter);
  const max = Math.max(1, ...visitors.map((v) => v.visitors));
  const top = Math.max(1, rows[0]?.count ?? 1);
  const qs = (patch: Record<string, string | number>) => {
    const next = new URLSearchParams({ days: String(days), audience, source, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    return `/admin/analytics?${next.toString()}`;
  };

  return (
    <div className="space-y-6" data-testid="admin-analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">
            <Link href="/admin" className="hover:text-accent">Admin</Link> / Analytics
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Funil e origens</h1>
          <p className="mt-1 text-sm text-muted">Sem cookie: um visitante é um hash que muda todo dia. Eventos crus ficam 90 dias; o resumo diário fica.</p>
        </div>
        <a href={`/api/admin/analytics?format=csv&days=${days}`} className="rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm hover:border-accent">
          Baixar CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={qs({ days: d })} className={`rounded-full border px-3 py-1 ${d === days ? "border-accent bg-accent text-accent-ink" : "border-edge"}`}>
            {`${d} dias`}
          </Link>
        ))}
        <span className="mx-1 w-px bg-edge" />
        {["", ...AUDIENCES].map((a) => (
          <Link key={a || "all"} href={qs({ audience: a })} className={`rounded-full border px-3 py-1 ${a === audience ? "border-accent bg-accent text-accent-ink" : "border-edge"}`}>
            {AUDIENCE_LABEL[a]}
          </Link>
        ))}
        {source && (
          <Link href={qs({ source: "" })} className="rounded-full border border-accent px-3 py-1">{`origem: ${source} ×`}</Link>
        )}
      </div>

      <section className="rounded-xl border border-edge bg-surface p-5" data-testid="analytics-funnel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Funil</h2>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.step} className="grid grid-cols-[150px_1fr_110px] items-center gap-3 text-sm" data-step={row.step} data-count={row.count}>
              <span>{STEP_LABEL[row.step]}</span>
              <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-3 w-full" aria-hidden>
                <rect x="0" y="0" width="100" height="8" rx="2" className="fill-surface-2" />
                <rect x="0" y="0" width={(row.count / top) * 100} height="8" rx="2" fill="var(--accent)" />
              </svg>
              <span className="text-right tabular-nums">
                {row.count}
                {row.rate !== null && <span className="ml-1 text-xs text-muted">{`${row.rate}%`}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-edge bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Visitantes por dia</h2>
          {visitors.length === 0 ? (
            <p className="text-sm text-muted">Sem visitas no período.</p>
          ) : (
            <svg viewBox={`0 0 ${visitors.length * 10} 60`} className="h-36 w-full" role="img" aria-label="Visitantes por dia">
              {visitors.map((v, i) => (
                <rect key={v.day} x={i * 10 + 1} y={60 - (v.visitors / max) * 56} width="8" height={(v.visitors / max) * 56} rx="1" fill="var(--accent)">
                  <title>{`${v.day}: ${v.visitors} visitantes, ${v.views} visitas`}</title>
                </rect>
              ))}
            </svg>
          )}
        </section>
        <section className="rounded-xl border border-edge bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Origens e campanhas</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm" data-testid="analytics-sources">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-1.5 pr-2">Origem</th>
                  <th className="py-1.5 pr-2">Campanha</th>
                  <th className="py-1.5 pr-2 text-right">Visitantes</th>
                  <th className="py-1.5 text-right">Cadastros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {sources.map((s) => (
                  <tr key={`${s.source}-${s.campaign}`}>
                    <td className="py-1.5 pr-2">
                      <Link href={qs({ source: s.source || "(direto)" })} className="hover:text-accent">{s.source || "(direto)"}</Link>
                    </td>
                    <td className="py-1.5 pr-2 text-muted">{s.campaign || "—"}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{s.visitors}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Cadastros recentes (1º toque)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm" data-testid="analytics-signups">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-1.5 pr-2">Conta</th>
                <th className="py-1.5 pr-2">Público</th>
                <th className="py-1.5 pr-2">Origem</th>
                <th className="py-1.5 pr-2">Campanha</th>
                <th className="py-1.5">Quando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {signups.map((s) => (
                <tr key={s.username}>
                  <td className="py-1.5 pr-2 font-mono text-xs">{s.username}</td>
                  <td className="py-1.5 pr-2">{AUDIENCE_LABEL[s.audience] ?? s.audience}</td>
                  <td className="py-1.5 pr-2">{s.utm.source || "(direto)"}</td>
                  <td className="py-1.5 pr-2 text-muted">{s.utm.campaign || "—"}</td>
                  <td className="py-1.5 text-xs text-muted">{s.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent">Primeiros passos concluídos</h2>
        <p className="mb-3 text-xs text-muted">Contas que concluíram cada passo do checklist no período (papel:passo).</p>
        {activation.length === 0 ? (
          <p className="text-sm text-muted">Nenhum passo concluído no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm" data-testid="analytics-activation">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-1.5 pr-2">Passo</th>
                  <th className="py-1.5 text-right">Contas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {activation.map((a) => (
                  <tr key={a.step}>
                    <td className="py-1.5 pr-2 font-mono text-xs">{a.step}</td>
                    <td className="py-1.5 text-right tabular-nums">{a.accounts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <UtmBuilder base={appBaseUrl()} />
    </div>
  );
}
