"use client";

/**
 * Primitivas — docs/DESIGN.md §11.
 *
 * COMO USAR
 *
 * Tamanho de texto: as classes .d1–.d4 (display, com o eixo óptico já certo),
 * .t1–.t6 (texto/UI) e .n1–.n3 (número tabular) de globals.css. Nunca
 * `text-3xl`; para um tamanho fora da escala, `displayStyle(px)` de lib/type.ts.
 *
 * Densidade: é um token de CONTÊINER, não uma prop de componente. Envolva a
 * região em `<div data-density="compact">` e a mesma <Table>, o mesmo <Button>
 * e o mesmo <Input> encolhem juntos. `comfortable` é o padrão.
 *   compact     → workspace, produção, agenda, finance, admin, calendário
 *   comfortable → landing, funis, página pública, relatório, proposta, fatura
 *
 * Cor: UM elemento expressivo por tela (§5.5). A cor da agência aparece no
 * botão primário OU no marcador de navegação ativo OU na régua de capa do
 * documento — nunca nos três. Título de seção, número de KPI e eyebrow são
 * neutros. Cor semântica só descreve estado.
 *
 * Foco: o anel vem de :focus-visible no globals.css (2px em --brand-edge, com
 * variante clara no tema escuro). Nenhuma primitiva escreve outline-none.
 *
 * Ausência de dado: <Dash />, nunca 0.
 *
 * Os nomes antigos (Card, Tag, Label, Spinner, ErrorBox…) continuam exportados
 * com a mesma assinatura, agora desenhados no sistema novo — é o que permite
 * trocar a fundação sem reescrever 300 telas no mesmo commit.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";
import { EM_DASH } from "@/lib/type";

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

/* ========================================================================== */
/* Ação                                                                       */
/* ========================================================================== */

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
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

export function Button({
  children,
  variant = "primary",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: IconName;
}) {
  return (
    <button
      // `loading` troca o rótulo por um indicador MANTENDO a largura: o botão
      // não pode encolher debaixo do cursor de quem acabou de clicar.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(
        "t3 relative inline-flex h-[var(--ui-h)] min-h-10 items-center justify-center gap-2 rounded-sm px-4 font-medium",
        "transition-[background-color,border-color,color,filter] duration-[var(--dur-1)] ease-[var(--ease)]",
        // Sem opacidade global: opacidade quebra o contraste do rótulo.
        "disabled:cursor-not-allowed disabled:border-rule disabled:bg-surface-sunken disabled:text-text-faint disabled:hover:brightness-100",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <span className={cx("inline-flex items-center gap-2", loading && "invisible")}>
        {icon && <Icon name={icon} size={16} />}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
    </button>
  );
}

/** Quadrado, alvo mínimo de 40×40, aria-label obrigatório. */
export function IconButton({
  name,
  label,
  variant = "quiet",
  size = 20,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name: IconName;
  label: string;
  variant?: ButtonVariant;
  size?: 16 | 20 | 24;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "grid size-10 shrink-0 place-items-center rounded-sm",
        "transition-colors duration-[var(--dur-1)] ease-[var(--ease)]",
        "disabled:cursor-not-allowed disabled:text-text-faint",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

/** Régua interna de 1px, cantos externos r-sm. */
export function ButtonGroup({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-edge [&>button]:rounded-none [&>button]:border-0 [&>button:not(:first-child)]:border-l [&>button]:border-rule">
      {children}
    </div>
  );
}

/** Sublinhado sempre visível em prosa; só no hover dentro da UI. */
export function LinkText({
  children,
  quiet = false,
  className = "",
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { quiet?: boolean }) {
  return (
    <a
      className={cx(
        "text-brand-text underline-offset-2 rounded-xs",
        quiet ? "no-underline hover:underline" : "underline",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

/* ========================================================================== */
/* Entrada                                                                    */
/* ========================================================================== */

/** Label de formulário é t5 em CAIXA DE SENTENÇA — caixa alta é só do t6. */
export function Label({
  children,
  htmlFor,
  className = "",
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cx("t5 mb-1 block text-text", className)}>
      {children}
    </label>
  );
}

/**
 * Invólucro de campo. A instrução vai ACIMA do controle (dentro do placeholder
 * ela some no foco, que é exatamente quando é lida), o erro vai abaixo, e
 * "obrigatório" é palavra, não asterisco.
 *
 * `width` comunica o conteúdo esperado (§11.2) em vez de esticar tudo.
 */
export function Field({
  label,
  hint,
  error,
  required,
  counter,
  width = "full",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  counter?: string;
  width?: "pct" | "money" | "date" | "name" | "full";
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const described = [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;
  const widths = {
    pct: "max-w-[88px]",
    money: "max-w-[160px]",
    date: "max-w-[160px]",
    name: "max-w-[320px]",
    full: "",
  }[width];
  return (
    <div className={cx("min-w-0", widths)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="t5 text-text">
          {label}
          {required && <span className="ml-1 text-text-faint">obrigatório</span>}
        </label>
        {counter && <span className="t5 tnum text-text-faint">{counter}</span>}
      </div>
      {hint && (
        <p id={hintId} className="t5 mb-1.5 text-text-muted">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": described, "aria-invalid": error ? true : undefined })}
      {error && (
        <p id={errId} role="alert" className="t5 mt-1.5 flex items-start gap-1 text-negative">
          <Icon name="x" size={16} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL = cx(
  "t3 w-full rounded-sm border bg-surface px-3 text-text",
  "placeholder:text-text-faint",
  "transition-colors duration-[var(--dur-1)] ease-[var(--ease)]",
  "border-edge hover:border-text-faint",
  "aria-invalid:border-negative",
  "disabled:cursor-not-allowed disabled:border-rule disabled:bg-surface-sunken disabled:text-text-faint",
  "read-only:border-transparent read-only:bg-surface-sunken",
);

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, "h-[var(--ui-h)] min-h-10", className)} {...props} />;
}

/** Prefixo/sufixo colados ao campo (R$, %, @) sem entrar no valor digitado. */
export function InputAffix({
  prefix,
  suffix,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  return (
    <div
      className={cx(
        "t3 flex h-[var(--ui-h)] min-h-10 items-center rounded-sm border border-edge bg-surface",
        "focus-within:border-brand-edge",
        className,
      )}
    >
      {prefix && <span className="t5 pl-3 text-text-muted">{prefix}</span>}
      <input
        className="tnum min-w-0 flex-1 bg-transparent px-2 text-right text-text outline-none placeholder:text-text-faint"
        {...props}
      />
      {suffix && <span className="t5 pr-3 text-text-muted">{suffix}</span>}
    </div>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL, "min-h-24 resize-y py-2 leading-6", className)} {...props} />;
}

/**
 * Select com a moldura do sistema (altura, borda e seta nossas) em cima do
 * elemento nativo: `appearance: none` mata o widget cru do sistema operacional
 * e o teclado continua sendo o do navegador, que é melhor do que qualquer
 * listbox reescrita à mão.
 */
export function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cx(CONTROL, "h-[var(--ui-h)] min-h-10 appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <Icon
        name="chevron-down"
        size={16}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}

export function Checkbox({
  label,
  indeterminate,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <label className={cx("t3 flex min-h-10 cursor-pointer items-center gap-2.5 text-text", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="size-4 shrink-0 rounded-xs border-edge accent-[var(--brand-solid)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function Radio({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cx("t3 flex min-h-10 cursor-pointer items-center gap-2.5 text-text", className)}>
      <input type="radio" className="size-4 shrink-0 accent-[var(--brand-solid)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Só para efeito imediato — nunca dentro de um formulário com Salvar. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="t3 group flex min-h-10 items-center gap-2.5 text-text disabled:cursor-not-allowed disabled:text-text-faint"
    >
      <span
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-[var(--dur-1)] ease-[var(--ease)]",
          checked ? "border-transparent bg-brand-solid" : "border-edge bg-surface-sunken",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-3.5 rounded-full transition-[left] duration-[var(--dur-1)] ease-[var(--ease)]",
            checked ? "left-4 bg-brand-ink" : "left-0.5 bg-text-muted",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/** Selecionado = wash + borda da marca + aria-pressed. Nunca só cor de fundo. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (v: T[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx(
              "t5 inline-flex min-h-10 items-center gap-1.5 rounded-sm border px-3",
              "transition-colors duration-[var(--dur-1)] ease-[var(--ease)]",
              on
                ? "border-brand-edge bg-brand-wash text-text"
                : "border-edge bg-surface text-text-muted hover:text-text",
            )}
          >
            {on && <Icon name="check" size={16} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ========================================================================== */
/* Estrutura                                                                  */
/* ========================================================================== */

/**
 * O único "cartão" do sistema: surface, r-md, régua de 1px, SEM SOMBRA.
 * Um painel de conteúdo não flutua acima da página (§6).
 */
export function Panel({
  children,
  title,
  actions,
  flush = false,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      className={cx("rounded-md border border-rule bg-surface", className)}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-baseline justify-between gap-4 border-b border-rule px-[var(--pad-x)] py-[calc(var(--pad-y)*0.7)]">
          {typeof title === "string" ? <h3 className="d4">{title}</h3> : title}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-[var(--pad-x)]"}>{children}</div>
    </div>
  );
}

/** Nome legado de Panel — 30 telas ainda importam Card. */
export function Card({
  children,
  className = "",
  hover = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <Panel className={cx(hover && "card-hover", className)} {...rest}>
      {children}
    </Panel>
  );
}

/** Eyebrow: o único lugar com caixa alta, no máximo um por seção, e neutro. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="t6 mb-3 text-text-muted">{children}</h3>;
}

/** Uma metáfora só: sublinhado de 2px. Acabam as pílulas e os <select> de aba. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mb-px flex gap-1 overflow-x-auto border-b border-rule [scrollbar-width:none]"
    >
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              const i = tabs.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length].value);
              if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length].value);
            }}
            className={cx(
              "t3 relative inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 pb-2.5",
              "transition-colors duration-[var(--dur-1)] ease-[var(--ease)]",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:transition-transform after:duration-[var(--dur-2)] after:ease-[var(--ease)]",
              on
                ? "text-text after:scale-x-100 after:bg-brand-edge"
                : "text-text-muted hover:text-text after:scale-x-0 after:bg-transparent",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="t5 tnum text-text-faint">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Trilha" className="t5 flex flex-wrap items-center gap-1.5 text-text-muted">
      {items.map((it, i) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text-faint">/</span>}
          {it.href && i < items.length - 1 ? (
            <a href={it.href} className="rounded-xs hover:text-text">
              {it.label}
            </a>
          ) : (
            <span className="text-text">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Foco preso, Esc fecha, título d4, e2 — a única família que flutua. */
export function Dialog({
  open,
  onClose,
  title,
  size = 640,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 480 | 640 | 800;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const trap = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab" || !box.current) return;
      const f = box.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", trap);
    const t = setTimeout(() => box.current?.querySelector<HTMLElement>("button,input,a")?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", trap);
      clearTimeout(t);
    };
  }, [open, trap]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[rgba(16,15,14,.45)] p-4">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: size }}
        className="animate-pop-in w-full rounded-md border border-rule bg-surface shadow-e2"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-6 py-4">
          <h2 className="d4">{title}</h2>
          <IconButton name="x" label="Fechar" onClick={onClose} size={20} className="-mr-2" />
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-rule px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** Gaveta lateral, 420px, mesma regra de foco do diálogo. */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(16,15,14,.45)]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-[420px] flex-col border-l border-rule bg-surface shadow-e2"
      >
        <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <h2 className="d4">{title}</h2>
          <IconButton name="x" label="Fechar" onClick={onClose} size={20} className="-mr-2" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Retorno: banner, toast, tooltip                                            */
/* ========================================================================== */

export type Tone = "neutral" | "positive" | "caution" | "negative";

const TONES: Record<Tone, { box: string; ink: string; icon: IconName }> = {
  neutral: { box: "border-edge bg-surface-sunken", ink: "text-text", icon: "info" },
  positive: { box: "border-positive/40 bg-positive-wash", ink: "text-positive", icon: "check" },
  caution: { box: "border-caution/40 bg-caution-wash", ink: "text-caution", icon: "alert" },
  negative: { box: "border-negative/40 bg-negative-wash", ink: "text-negative", icon: "alert" },
};

/** Dentro do fluxo, com wash + edge — nunca só uma cor de fundo. */
export function Banner({
  tone = "neutral",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "negative" ? "alert" : undefined}
      className={cx("flex items-start gap-3 rounded-md border px-4 py-3", t.box)}
    >
      <Icon name={t.icon} size={20} className={cx("mt-px shrink-0", t.ink)} />
      <div className="min-w-0 flex-1">
        {title && <p className="t3 font-medium text-text">{title}</p>}
        {children && <div className="t3 measure-ui text-text-muted">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Nome legado: 18 telas importam ErrorBox. */
export function ErrorBox({ message }: { message: string }) {
  return <Banner tone="negative">{message}</Banner>;
}

/** Nunca a única via de desfazer: 5s, pausa no hover. */
export function Toast({
  tone = "neutral",
  children,
  onClose,
}: {
  tone?: Tone;
  children: ReactNode;
  onClose?: () => void;
}) {
  const t = TONES[tone];
  return (
    <div
      role="status"
      className="animate-pop-in fixed right-4 bottom-4 z-50 flex max-w-[380px] items-start gap-3 rounded-md border border-rule bg-surface px-4 py-3 shadow-e1"
    >
      <Icon name={t.icon} size={20} className={cx("mt-px shrink-0", t.ink)} />
      <div className="t3 min-w-0 flex-1 text-text">{children}</div>
      {onClose && <IconButton name="x" label="Fechar aviso" size={16} onClick={onClose} className="-my-2 -mr-2" />}
    </div>
  );
}

/** Texto curto, e nunca a única fonte de uma informação. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="t5 pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-sm border border-rule bg-surface px-2 py-1 text-text opacity-0 shadow-e1 transition-opacity duration-[var(--dur-2)] ease-[var(--ease)] group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="t5 inline-flex items-center gap-2 text-text-muted">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-rule border-t-text-muted"
      />
      {label}
    </span>
  );
}

/* ========================================================================== */
/* Dados                                                                      */
/* ========================================================================== */

/** Ausência de dado é travessão, nunca 0 (§9.2). */
export function Dash() {
  return (
    <span className="text-text-faint" aria-label="sem dado">
      {EM_DASH}
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <span className={cx("t5 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5", t.box, tone === "neutral" ? "text-text-muted" : t.ink)}>
      {children}
    </span>
  );
}

/** Nome legado: 17 telas importam Tag. */
export function Tag({ children }: { children: ReactNode }) {
  return <Badge>{children}</Badge>;
}

export function StatusDot({ tone = "neutral", label }: { tone?: Tone; label: string }) {
  const bg = {
    neutral: "bg-text-faint",
    positive: "bg-positive",
    caution: "bg-caution",
    negative: "bg-negative",
  }[tone];
  return (
    <span className="t5 inline-flex items-center gap-1.5 text-text-muted">
      <span aria-hidden className={cx("size-2 rounded-full", bg)} />
      {label}
    </span>
  );
}

/** +12,4% / −8,1% com a seta do sprite, SEM chip de fundo colorido. */
export function Delta({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) return <Dash />;
  const up = value >= 0;
  const abs = Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <span className={cx("t5 tnum inline-flex items-center gap-1", up ? "text-positive" : "text-negative")}>
      <Icon name={up ? "arrow-up" : "arrow-down"} size={16} />
      {up ? "+" : "−"}
      {abs}
      {suffix}
    </span>
  );
}

/**
 * Rótulo acima, valor na mesma linha de base, delta ao lado. Blocos lado a lado
 * alinham PELO VALOR, não pelo topo do cartão — daí o grid de duas fileiras.
 */
export function KPI({
  label,
  value,
  delta,
  note,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  note?: string;
}) {
  return (
    <div className="grid content-start gap-1">
      <p className="t5 text-text-muted">{label}</p>
      <p className="n1 flex items-baseline gap-2 text-text">
        {value}
        {delta !== undefined && <Delta value={delta ?? null} />}
      </p>
      {note && <p className="t5 text-text-faint">{note}</p>}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="grid gap-1.5">
      <div className="t5 flex items-baseline justify-between text-text-muted">
        <span>{label}</span>
        <span className="tnum text-text">{pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1 w-full overflow-hidden bg-rule"
      >
        <div className="h-full bg-brand-edge" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="t5 grid shrink-0 place-items-center rounded-full bg-surface-sunken text-text-muted"
    >
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabela (§9.1): sem cartão em volta, sem zebra, largura declarada            */
/* -------------------------------------------------------------------------- */

export type Column<R> = {
  key: string;
  header: string;
  /** Largura DECLARADA — table-layout: fixed. Nada de coluna automática. */
  width: string;
  align?: "left" | "right";
  cell: (row: R) => ReactNode;
};

export function Table<R>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  loading = false,
  total,
}: {
  columns: Array<Column<R>>;
  rows: R[];
  rowKey: (row: R) => string;
  caption: string;
  empty?: ReactNode;
  loading?: boolean;
  total?: ReactNode[];
}) {
  if (!loading && rows.length === 0 && empty) return <>{empty}</>;
  return (
    // Só a tabela rola, nunca a página.
    <div className="w-full overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                // O cabeçalho alinha IGUAL à célula: é o detalhe que mais
                // denuncia trabalho apressado.
                className={cx(
                  "t5 sticky top-0 z-10 whitespace-nowrap bg-surface px-[var(--pad-x)] py-2 font-medium text-text-muted",
                  "shadow-[inset_0_-1px_0_var(--edge)]",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    // O esqueleto usa AS MESMAS larguras de coluna.
                    <td key={c.key} className="px-[var(--pad-x)] py-2 shadow-[inset_0_-1px_0_var(--rule)]">
                      <Skeleton className="h-3 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((r) => (
                <tr key={rowKey(r)} className="transition-colors duration-[var(--dur-1)] hover:bg-surface-sunken">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cx(
                        "h-[var(--row-h)] px-[var(--pad-x)] shadow-[inset_0_-1px_0_var(--rule)]",
                        c.align === "right"
                          ? "n3 text-right text-text"
                          : "t4 truncate text-text",
                      )}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
        {total && (
          <tfoot>
            <tr>
              {total.map((cell, i) => (
                <td
                  key={columns[i]?.key ?? i}
                  className={cx(
                    "h-[var(--row-h)] px-[var(--pad-x)] font-semibold shadow-[inset_0_1px_0_var(--edge)]",
                    columns[i]?.align === "right" ? "n3 text-right" : "t4 text-left",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (p: number) => void;
}) {
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 pt-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <span className="t5 tnum text-text-muted">
        {page} de {pages}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}

/** Mesma caixa do conteúdo final; a pulsação só começa depois de 400ms. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

/**
 * Forma fixa (§9.4): ícone 24 · o que VAI aparecer aqui · uma ação · condição.
 * Nunca um parágrafo solto dentro de um cartão.
 */
export function EmptyState({
  icon = "layers",
  title,
  action,
  condition,
}: {
  icon?: IconName;
  title: string;
  action?: ReactNode;
  condition?: string;
}) {
  return (
    <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-rule bg-surface px-6 py-8 text-center">
      <div className="grid justify-items-center gap-2">
        <Icon name={icon} size={24} className="text-text-faint" />
        <p className="t3 measure-lede text-text">{title}</p>
        {condition && <p className="t5 measure-lede text-text-muted">{condition}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      icon={copied ? "check" : "copy"}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copiado" : label}
    </Button>
  );
}

/* ========================================================================== */
/* Densidade                                                                  */
/* ========================================================================== */

const DensityCtx = createContext<"comfortable" | "compact">("comfortable");
export const useDensity = () => useContext(DensityCtx);

/** Envolve uma região. A densidade é do contêiner, não do componente (§4.4). */
export function Density({
  value,
  children,
  className = "",
}: {
  value: "comfortable" | "compact";
  children: ReactNode;
  className?: string;
}) {
  return (
    <DensityCtx.Provider value={value}>
      <div data-density={value} className={className}>
        {children}
      </div>
    </DensityCtx.Provider>
  );
}
