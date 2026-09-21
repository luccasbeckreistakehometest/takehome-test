// Logo do Marqa — mark (badge com "M" geométrico) + wordmark com ponto accent.
// Usa as CSS vars da marca (var(--accent) / var(--accent-ink)), então acompanha
// o tema e o whitelabel automaticamente.

export function MarqaMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="marqa-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="url(#marqa-grad)" />
      {/* "M" — dois picos ascendentes (momentum + marca) */}
      <path
        d="M8 22.5 V11 L16 18 L24 11 V22.5"
        stroke="var(--accent-ink)"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* spark de IA */}
      <circle cx="24.5" cy="8" r="1.6" fill="var(--accent-ink)" />
    </svg>
  );
}

export function MarqaWordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <MarqaMark size={size} />
      <span className="d4">
        Marqa<span style={{ color: "var(--accent)" }}>.</span>
      </span>
    </span>
  );
}
