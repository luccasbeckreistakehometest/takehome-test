import { redirect } from "next/navigation";

// O auto-cadastro público agora é feito em /criar-conta (via a rota pública
// /api/auth/register, com login automático). Mantemos /cadastro como
// atalho/redirecionamento para não quebrar links antigos.
export default function CadastroRedirect() {
  redirect("/criar-conta");
}
