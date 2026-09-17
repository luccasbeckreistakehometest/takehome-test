import SectionTabs from "@/components/SectionTabs";
import { AGENDA_TABS } from "@/lib/nav";

// Agenda = calendário de conteúdo + reuniões (cada um no seu endereço).
export default function AgendaSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs tabs={AGENDA_TABS} label="Agenda" />
      {children}
    </>
  );
}
