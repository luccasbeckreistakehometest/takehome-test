import { Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "Treinamento" };

const TRACKS = [
  {
    role: "🏢 Agência",
    steps: [
      "Cadastre o cliente com o briefing mais completo possível (aba Briefing) — ele alimenta toda a IA.",
      "Rode a Estratégia & Deep Dive: a IA pesquisa o mercado real e define personas, concorrentes, apostas e metas.",
      "Use o ✦ Kit completo para gerar estratégia → campanha → ROI → identidade → social → landing page em um clique.",
      "Rode o Radar de mercado com frequência (ideal: diário) — as próximas gerações se adaptam ao que mudou.",
      "Crie Demandas para produções (foto/design), rode o Match por IA e vincule o profissional com melhor fit.",
      "Reserve o pagamento (escrow) antes da produção — é a garantia das duas pontas.",
      "Revise entregas clicando na imagem para marcar ajustes e rode a análise de qualidade da IA (0-100).",
      "Aprove, libere o pagamento e gere o Relatório executivo para enviar ao cliente.",
      "Use a Prospecção para descobrir novos clientes reais e o Motor de ideias para nunca ficar sem próxima jogada.",
    ],
  },
  {
    role: "👤 Cliente",
    steps: [
      "Receba o link de cadastro da agência e preencha o briefing da sua empresa (5 minutos).",
      "Acesse seu portal para acompanhar produções, baixar arquivos e ler os relatórios executivos.",
      "Quanto mais contexto você der à agência (objetivos, verba, diferenciais), mais certeiras as entregas.",
    ],
  },
  {
    role: "📸 Profissional (fotógrafo/designer)",
    steps: [
      "Cadastre seu perfil com localização, skills, especialidades e portfolio — é isso que o match da IA usa.",
      "Acompanhe as Oportunidades abertas no seu portal e o chat de cada demanda vinculada.",
      "Envie entregas pela demanda; a revisão vem com marcações na imagem e notas objetivas da IA.",
      "Seu elo (Bronze → Prata → Ouro → Platina) sobe com demandas concluídas e nota média das entregas — quem entrega qualidade recebe mais matches.",
      "O pagamento fica reservado (escrow) antes de você produzir e é liberado na aprovação.",
    ],
  },
];

export default function TrainingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Treinamento
        </h1>
        <p className="mt-1 text-sm text-muted">
          O caminho feliz de cada papel dentro da plataforma — do briefing ao
          pagamento.
        </p>
      </div>
      {TRACKS.map((track) => (
        <Card key={track.role}>
          <SectionTitle>{track.role}</SectionTitle>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            {track.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}
