import SectionTabs from "@/components/SectionTabs";
import { RESULTS_TABS } from "@/lib/nav";

export default function InvoicesSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={RESULTS_TABS} label="Resultados" />
      {children}
    </>
  );
}
