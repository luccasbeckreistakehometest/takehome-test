import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agencyOnly, isDenied } from "@/lib/guard";

// Busca global ⌘K: clientes, demandas, profissionais e entregáveis
export async function GET(request: Request) {
  const auth = await agencyOnly();
  if (isDenied(auth)) return auth;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  const like = `%${q}%`;
  const results: { type: string; label: string; sublabel: string; href: string }[] = [];
  for (const row of db
    .prepare("SELECT id, name, industry FROM clients WHERE name LIKE ? LIMIT 5")
    .all(like) as { id: string; name: string; industry: string }[]) {
    results.push({ type: "Cliente", label: row.name, sublabel: row.industry, href: `/clients/${row.id}` });
  }
  for (const row of db
    .prepare("SELECT id, clientId, title, status FROM projects WHERE title LIKE ? OR brief LIKE ? LIMIT 6")
    .all(like, like) as { id: string; clientId: string; title: string; status: string }[]) {
    results.push({ type: "Demanda", label: row.title, sublabel: row.status, href: `/clients/${row.clientId}?project=${row.id}` });
  }
  for (const row of db
    .prepare("SELECT id, name, role, location FROM professionals WHERE name LIKE ? OR skills LIKE ? LIMIT 5")
    .all(like, like) as { id: string; name: string; role: string; location: string }[]) {
    results.push({ type: "Profissional", label: row.name, sublabel: `${row.role} · ${row.location}`, href: `/professionals/${row.id}` });
  }
  for (const row of db
    .prepare("SELECT id, clientId, title, type FROM generations WHERE title LIKE ? LIMIT 5")
    .all(like) as { id: string; clientId: string; title: string; type: string }[]) {
    results.push({ type: "Entregável", label: row.title, sublabel: row.type, href: `/clients/${row.clientId}?tab=${row.type}` });
  }
  return NextResponse.json(results.slice(0, 15));
}
