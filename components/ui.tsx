"use client";

import { useState } from "react";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-edge bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
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
      "bg-accent text-accent-ink hover:opacity-90 disabled:opacity-40 font-medium",
    ghost:
      "border border-edge bg-surface-2 text-foreground hover:border-muted disabled:opacity-40",
    danger:
      "border border-red-900/60 bg-red-950/40 text-red-300 hover:border-red-700 disabled:opacity-40",
  }[variant];
  return (
    <button
      className={`rounded-md px-3.5 py-2 text-sm transition-all disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
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
    <div className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
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
