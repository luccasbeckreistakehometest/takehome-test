// Classe de botão fora do módulo de cliente.
//
// components/ui.tsx é "use client" inteiro, e o layout (servidor) precisa da
// mesma aparência para o <Link> "Entrar". Uma função de string não é um
// componente de cliente: ela mora aqui e o ui.tsx reexporta, para que exista
// UMA fonte de estilo de botão e nenhuma tela precise saber disso.

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "ghost";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Um primary por região. É o único lugar da tela onde a marca é campo.
  primary:
    "bg-brand-solid text-brand-ink border border-transparent hover:brightness-95 active:brightness-90",
  secondary:
    "border border-edge bg-surface text-text hover:bg-surface-sunken active:bg-surface-sunken",
  quiet: "border border-transparent text-text hover:bg-surface-sunken",
  danger: "border border-negative/50 text-negative hover:bg-negative-wash",
  // legado: 79 chamadas escrevem variant="ghost"
  ghost:
    "border border-edge bg-surface text-text hover:bg-surface-sunken active:bg-surface-sunken",
};

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "lg" = "md") {
  return [
    "t3 relative inline-flex items-center justify-center gap-2 rounded-sm font-medium",
    size === "lg" ? "h-12 px-6 text-[15px]" : "h-[var(--ui-h)] px-4",
    "transition-[background-color,border-color,color,filter] duration-[var(--dur-1)] ease-[var(--ease)]",
    // §11.1: desabilitado é `text-muted` sobre `surface-sunken` com régua —
    // nunca opacidade global, que derruba o contraste do rótulo para 2,97:1.
    "disabled:cursor-not-allowed disabled:border-rule disabled:bg-surface-sunken disabled:text-text-muted disabled:hover:brightness-100",
    BUTTON_VARIANTS[variant],
  ].join(" ");
}
