import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel da Marqa: agência, marca ou profissional.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginForm showDevAccounts={process.env.NODE_ENV !== "production"} />;
}
