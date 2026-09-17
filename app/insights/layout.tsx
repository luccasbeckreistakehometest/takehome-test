import SectionTabs from "@/components/SectionTabs";
import { RESULTS_TABS } from "@/lib/nav";

// Resultados = insights + horas & margem + cobranças (cada um no seu endereço).
export default function ResultsSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={RESULTS_TABS} label="Resultados" />
      {children}
    </>
  );
}
