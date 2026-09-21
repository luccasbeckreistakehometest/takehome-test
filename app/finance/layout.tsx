import SectionTabs from "@/components/SectionTabs";
import { Density } from "@/components/ui";
import { RESULTS_TABS } from "@/lib/nav";

// Resultados = insights + horas & margem + cobranças (cada um no seu endereço).
// Densidade `compact` (§4.4): ferramenta é para operar, não para contemplar —
// linha de 32px, respiro de 12px e controle de 32px. O token é do CONTÊINER, e
// é por isso que ele entra aqui e não em cada componente.
export default function ResultsSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <Density value="compact" className="flex min-w-0 flex-col gap-4">
      <SectionTabs tabs={RESULTS_TABS} label="Resultados" />
      {children}
    </Density>
  );
}
