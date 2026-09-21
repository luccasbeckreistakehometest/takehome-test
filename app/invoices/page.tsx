import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listClients } from "@/lib/db";
import { scopeForSession } from "@/lib/tenancy-rules";
import InvoicesPanel from "@/components/InvoicesPanel";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cobranças" };

// Cobranças: faturas do fee de todos os clientes, Pix direto na conta da agência.
export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "agency" && session.role !== "admin") redirect("/");
  const clients = listClients(scopeForSession(session)).map((c) => ({ id: c.id, name: c.name }));
  return (
    <div>
      <PageHeader
        eyebrow="Resultados"
        title="Cobranças"
        lede="Fatura do fee com Pix copia e cola e QR. O dinheiro vai direto para a sua conta, sem taxa da Marqa."
      />
      <InvoicesPanel clients={clients} />
    </div>
  );
}
