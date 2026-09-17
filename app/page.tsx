import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForUser } from "@/lib/auth";
import LandingPage from "@/components/landing/LandingPage";
import { GENERAL, landingFor } from "@/lib/landing-content";
import { subscriptionsAvailable } from "@/lib/mercadopago";
import AgencyHome from "@/components/AgencyHome";

export const dynamic = "force-dynamic";

// Raiz: anônimo → landing geral; agência → painel; demais → seu painel.
export default async function Home() {
  const session = await getSession();
  if (!session) {
    const card = subscriptionsAvailable();
    return <LandingPage config={landingFor(GENERAL, card)} cardSubscription={card} />;
  }
  if (session.role === "agency") return <AgencyHome />;
  redirect(homeForUser({ role: session.role, refId: session.refId }, { selfServe: session.selfServe }));
}
