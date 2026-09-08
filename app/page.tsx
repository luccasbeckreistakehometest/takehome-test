import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForUser } from "@/lib/auth";
import Landing from "@/components/Landing";
import AgencyHome from "@/components/AgencyHome";

export const dynamic = "force-dynamic";

// Raiz do site:
// - visitante anônimo → landing pública (marketing)
// - agência logada → painel operacional
// - admin/cliente/profissional → seu painel específico
export default async function Home() {
  const session = await getSession();
  if (!session) return <Landing />;
  if (session.role === "agency") return <AgencyHome />;
  redirect(homeForUser({ role: session.role, refId: session.refId }));
}
