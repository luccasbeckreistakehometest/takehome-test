export type ProfessionalRole = "fotografo" | "designer";

export type Professional = {
  id: string;
  name: string;
  role: ProfessionalRole;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  specialties: string;
  marketFocus: string;
  bio: string;
  portfolio: { title: string; url: string }[];
  priceRange: string;
  availability: string; // disponibilidade (dias/horários livres)
  // freelancer = vê o marketplace aberto e se candidata; employee = full-time
  // da agência, vê as demandas dos clientes da agência (inclui internas).
  employmentType: "freelancer" | "employee";
  createdAt: string;
};

export type ProfessionalInput = Omit<Professional, "id" | "createdAt">;

export const ROLE_LABELS: Record<ProfessionalRole, string> = {
  fotografo: "Fotógrafo(a)",
  designer: "Designer",
};

export const SKILL_OPTIONS = [
  "Fotografia de produto",
  "Fotografia gastronômica",
  "Retrato/Corporativo",
  "Eventos",
  "Vídeo/Reels",
  "Drone",
  "Identidade visual",
  "Social media design",
  "Motion design",
  "UI/Web design",
  "Ilustração",
  "Edição/Retoque",
] as const;

export const PROJECT_STATUSES = [
  "open",
  "matched",
  "in_progress",
  "in_review",
  "client_approval",
  "approved",
  "paid",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  open: "Aberta",
  matched: "Profissional vinculado",
  in_progress: "Em produção",
  in_review: "Em revisão",
  client_approval: "Aguardando aprovação do cliente",
  approved: "Aprovada",
  paid: "Paga & concluída",
};

export type EscrowStatus = "none" | "held" | "released";

export const ESCROW_LABELS: Record<EscrowStatus, string> = {
  none: "Pagamento não reservado",
  held: "Pagamento reservado (garantido)",
  released: "Pagamento liberado ao profissional",
};

export type Project = {
  id: string;
  clientId: string;
  professionalId: string | null;
  title: string;
  brief: string;
  skillsNeeded: string[];
  location: string;
  budget: string;
  deadline: string;
  status: ProjectStatus;
  escrow: EscrowStatus;
  matchResult: string; // JSON do último match da IA (ou "")
  sketch: string; // JSON {svg, rationale} do sketch de referência da IA (ou "")
  // marketplace = com freelas da plataforma; internal = executada pelo
  // time interno da agência (sem match/escrow)
  mode: "marketplace" | "internal";
  createdAt: string;
};

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Aguardando análise",
  accepted: "Aceita",
  rejected: "Recusada",
};

// Candidatura de um profissional a uma demanda aberta. A agência pode aceitar
// mais de uma (pagando ambas) e depois definir o preferido no projeto.
export type Application = {
  id: string;
  projectId: string;
  professionalId: string;
  message: string;
  status: ApplicationStatus;
  createdAt: string;
};

export type ProjectMessage = {
  id: string;
  projectId: string;
  sender: "agency" | "professional";
  text: string;
  createdAt: string;
};

export type Deliverable = {
  id: string;
  projectId: string;
  title: string;
  mime: string;
  // delivery = entrega do profissional; reference = foto base enviada pela
  // agência (modelo, produto, equipe...) usada no sketch e no brief
  kind: "delivery" | "reference";
  meaning: string; // significado da referência (ex.: "modelo", "produto")
  createdAt: string;
};

export const REFERENCE_MEANINGS = [
  "Modelo",
  "Produto/Peça",
  "Equipe/Pessoas",
  "Local/Cenário",
  "Referência de estilo",
  "Outro",
] as const;

export type ReviewRole = "agency" | "client" | "professional";

export const REVIEW_ROLE_LABELS: Record<ReviewRole, string> = {
  agency: "Agência",
  client: "Cliente",
  professional: "Profissional",
};

export type Annotation = {
  id: string;
  deliverableId: string;
  x: number; // % da largura
  y: number; // % da altura
  comment: string;
  resolved: boolean;
  author: ReviewRole; // quem fez o comentário de revisão
  audience: ReviewRole | "all"; // para quem o comentário é dirigido
  createdAt: string;
};

// Arquivos da conta do cliente: identidade visual importada, projetos
// Photoshop/Illustrator, materiais da marca
export type ClientAsset = {
  id: string;
  clientId: string;
  title: string;
  ext: string;
  mime: string;
  kind: "brand" | "project" | "other";
  createdAt: string;
};

export const ASSET_KIND_LABELS: Record<ClientAsset["kind"], string> = {
  brand: "Identidade visual",
  project: "Projeto (PSD/AI)",
  other: "Outro",
};

export type ArtReview = {
  id: string;
  deliverableId: string;
  score: number;
  content: string; // JSON da análise completa
  createdAt: string;
};

export type ProspectStatus = "new" | "contacted" | "converted" | "discarded";

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  converted: "Convertido em cliente",
  discarded: "Descartado",
};

export type Prospect = {
  id: string;
  searchQuery: string;
  name: string;
  segment: string;
  location: string;
  website: string;
  instagram: string;
  whyFit: string;
  marketingMaturity: string;
  suggestedApproach: string;
  status: ProspectStatus;
  clientId: string | null;
  createdAt: string;
};
