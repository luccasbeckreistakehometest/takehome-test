import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { invoicePageData } from "@/lib/invoices-db";
import { agencyLogoUrl } from "@/lib/branding";
import InvoicePayView from "@/components/InvoicePayView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const valid = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = valid(token) ? invoicePageData(token) : null;
  return { title: data ? `Fatura · ${data.agency.name}` : "Fatura", robots: { index: false, follow: false } };
}

// Fatura do fee: Pix copia e cola + QR gerados com a chave da agência. O
// dinheiro vai direto para a conta dela; a confirmação é manual.
export default async function InvoicePage({ params }: Props) {
  const { token } = await params;
  const data = valid(token) ? invoicePageData(token) : null;
  if (!data) notFound();
  const { invoice } = data;
  const qrSvg = invoice.pixPayload ? await QRCode.toString(invoice.pixPayload, { type: "svg", margin: 1, width: 240, errorCorrectionLevel: "M" }) : "";
  return (
    <InvoicePayView
      token={token}
      lang={data.lang === "en" ? "en" : "pt"}
      state={data.state}
      clientName={data.clientName}
      beneficiary={data.beneficiary}
      lateNote={data.lateNote}
      agency={{ name: data.agency.name, tagline: data.agency.tagline, accentColor: data.agency.accentColor, logoUrl: agencyLogoUrl({ id: data.agency.id, logoMime: data.agency.logoMime }) }}
      invoice={{ month: invoice.month, items: invoice.items, total: invoice.total, dueDate: invoice.dueDate, pixPayload: invoice.pixPayload, paidAt: invoice.paidAt }}
      qrSvg={qrSvg}
    />
  );
}
