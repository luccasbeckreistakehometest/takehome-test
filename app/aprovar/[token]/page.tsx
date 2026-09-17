import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { linkPageData, markLinkViewed } from "@/lib/approval-links-db";
import { isApprovalToken } from "@/lib/approval-link-rules";
import ApprovalLinkView from "@/components/ApprovalLinkView";
import { recordEvent } from "@/lib/analytics-db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = isApprovalToken(token) ? linkPageData(token) : null;
  return {
    title: data ? `Aprovação · ${data.clientName}` : "Aprovação",
    robots: { index: false, follow: false },
  };
}

// Aprovação por link: o cliente abre no celular, sem login, e decide cada
// post/entrega. A marca exibida é a da agência que mandou o link.
export default async function ApprovalLinkPage({ params }: Props) {
  const { token } = await params;
  const data = isApprovalToken(token) ? linkPageData(token) : null;
  if (!data) notFound();
  if (data.state === "open") {
    markLinkViewed(data.link.id);
    recordEvent({ name: "approval_link_opened", path: "/aprovar/:token", audience: "geral", meta: { items: data.items.length } });
  }
  return (
    <ApprovalLinkView
      token={token}
      state={data.state}
      lang={data.lang === "en" ? "en" : "pt"}
      clientName={data.clientName}
      agency={data.agency}
      expiresAt={data.link.expiresAt}
      initialItems={data.items}
    />
  );
}
