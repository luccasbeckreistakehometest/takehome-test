"use client";

import { useState } from "react";

export function Card({
  children,
  className = "",
  hover = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-edge bg-surface p-5 shadow-sm ${
        hover ? "card-hover" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// Placeholder animado enquanto dados carregam — leitura mais profissional
// que um spinner solitário.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-accent">
      {children}
    </h3>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-edge bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles = {
    primary:
      "bg-accent text-accent-ink hover:opacity-90 hover:-translate-y-px active:translate-y-0 disabled:opacity-40 font-medium shadow-sm",
    ghost:
      "border border-edge bg-surface-2 text-foreground hover:border-muted hover:-translate-y-px active:translate-y-0 disabled:opacity-40",
    danger:
      "border border-red-500/40 bg-red-500/10 text-red-500 hover:border-red-500/70 disabled:opacity-40",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm transition-all duration-150 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-edge bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} min-h-20 resize-y`} {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClass} {...props} />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-edge border-t-accent" />
      {label}
    </span>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded border border-edge bg-surface-2 px-2 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
