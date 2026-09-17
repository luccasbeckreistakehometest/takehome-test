import { NextResponse } from "next/server";
import { getClient } from "@/lib/db";
import { getMonthlyReportByToken } from "@/lib/reports-db";
import { getAgency } from "@/lib/agencies";
import { agencyLogoUrl } from "@/lib/branding";

type Context = { params: Promise<{ token: string }> };

// Leitura pública por token (link imprimível/compartilhável do relatório).
// Só devolve o que o cliente já vê no portal: números do mês + resumo.
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const report = getMonthlyReportByToken(token);
  if (!report) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  const client = getClient(report.clientId);
  // Marca da agência dona da marca do relatório.
  const agency = getAgency(client?.agencyId);
  return NextResponse.json({
    report,
    client: { name: client?.name ?? "", language: client?.language ?? "pt-BR" },
    agency: {
      name: agency?.name ?? "",
      accentColor: agency?.accentColor ?? "#f76b15",
      tagline: agency?.tagline ?? "",
      logoUrl: agency ? agencyLogoUrl(agency) : "",
    },
  });
}
