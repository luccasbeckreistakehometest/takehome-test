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
  "approved",
  "paid",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  open: "Aberta",
  matched: "Profissional vinculado",
  in_progress: "Em produção",
  in_review: "Em revisão",
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
  createdAt: string;
};

export type Annotation = {
  id: string;
  deliverableId: string;
  x: number; // % da largura
  y: number; // % da altura
  comment: string;
  resolved: boolean;
  createdAt: string;
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
