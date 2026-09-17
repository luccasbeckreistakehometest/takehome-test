import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agencyOnly, isDenied, tenantOf } from "@/lib/guard";
import { scopeWhere } from "@/lib/tenancy-rules";

// Busca global ⌘K: clientes, demandas, profissionais e entregáveis — só os da
// agência da sessão (admin: todas). Profissionais: os da agência, os do
// marketplace aberto e quem já trabalhou com ela.
export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  const like = `%${q}%`;
  const scope = tenantOf(auth, request);
  const tenant = scopeWhere(scope);
  const results: { type: string; label: string; sublabel: string; href: string }[] = [];
  for (const row of db
    .prepare(`SELECT id, name, industry FROM clients WHERE name LIKE ? AND ${tenant.sql} LIMIT 5`)
    .all(like, ...tenant.params) as { id: string; name: string; industry: string }[]) {
    results.push({ type: "Cliente", label: row.name, sublabel: row.industry, href: `/clients/${row.id}` });
  }
  for (const row of db
    .prepare(`SELECT id, clientId, title, status FROM projects WHERE (title LIKE ? OR brief LIKE ?) AND ${tenant.sql} LIMIT 6`)
    .all(like, like, ...tenant.params) as { id: string; clientId: string; title: string; status: string }[]) {
    results.push({ type: "Demanda", label: row.title, sublabel: row.status, href: `/clients/${row.clientId}?project=${row.id}` });
  }
  const proVisible =
    scope.agencyId === null
      ? "1=1"
      : `(pr.agencyId IS NULL OR pr.agencyId = @agency
          OR EXISTS (SELECT 1 FROM applications a WHERE a.professionalId = pr.id AND a.agencyId = @agency)
          OR EXISTS (SELECT 1 FROM projects p WHERE p.professionalId = pr.id AND p.agencyId = @agency))`;
  for (const row of db
    .prepare(`SELECT pr.id, pr.name, pr.role, pr.location FROM professionals pr WHERE (pr.name LIKE @like OR pr.skills LIKE @like) AND ${proVisible} LIMIT 5`)
    .all({ like, ...(scope.agencyId === null ? {} : { agency: scope.agencyId }) }) as {
    id: string;
    name: string;
    role: string;
    location: string;
  }[]) {
    results.push({ type: "Profissional", label: row.name, sublabel: `${row.role} · ${row.location}`, href: `/professionals/${row.id}` });
  }
  for (const row of db
    .prepare(`SELECT id, clientId, title, type FROM generations WHERE title LIKE ? AND ${tenant.sql} LIMIT 5`)
    .all(like, ...tenant.params) as { id: string; clientId: string; title: string; type: string }[]) {
    results.push({ type: "Entregável", label: row.title, sublabel: row.type, href: `/clients/${row.clientId}?tab=${row.type}` });
  }
  return NextResponse.json(results.slice(0, 15));
}
