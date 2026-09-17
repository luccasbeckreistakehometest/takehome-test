import { NextResponse } from "next/server";
import { guard, isDenied } from "@/lib/guard";
import { currentMonth, isValidMonth } from "@/lib/report-aggregate";
import { marginReport } from "@/lib/finance-db";
import { marginCsv } from "@/lib/finance-rules";

// Margem por cliente no mês: fee × horas × custo. ?format=csv baixa a planilha.
export async function GET(request: Request) {
  const auth = await guard(["agency", "admin"]);
  if (isDenied(auth)) return auth;
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? currentMonth();
  if (!isValidMonth(month)) return NextResponse.json({ error: "Mês inválido (use AAAA-MM)" }, { status: 400 });
  const report = marginReport(month);
  if (url.searchParams.get("format") === "csv") {
    const lang = url.searchParams.get("lang") === "en" ? "en" : "pt";
    return new NextResponse(`﻿${marginCsv(report.rows, month, lang)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="margem-${month}.csv"`,
      },
    });
  }
  return NextResponse.json(report);
}
