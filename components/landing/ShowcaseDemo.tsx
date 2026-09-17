import { Icon } from "@/components/icons";
import type { Lang, ShowcaseDemo as Demo } from "@/lib/landing-content";

// Mini-ilustrações da vitrine: desenhadas com a interface real da Marqa em
// mente (sem print pesado), com texto nos dois idiomas. Dados de exemplo.
const tx = (lang: Lang, pt: string, en: string) => (lang === "pt" ? pt : en);

function Frame({ children, lang }: { children: React.ReactNode; lang: Lang }) {
  return (
    <div className="relative mt-5 rounded-xl border border-edge bg-background/60 px-4 pb-4 pt-7" aria-hidden="true">
      <span className="absolute right-3 top-2 text-[10px] uppercase tracking-widest text-muted">{tx(lang, "exemplo", "example")}</span>
      {children}
    </div>
  );
}

function Bar({ label, value, max, accent = true }: { label: string; value: number; max: number; accent?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{`${value}/${max}`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${accent ? "bg-accent" : "bg-red-500"}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

// QR decorativo (padrão fixo, não é um código válido)
const QR_BITS = "1111111010010111111110000010110101000001101110101001010111011011101001110101110110111010111001011101100000100101010000011111111010101011111110000000011010000000011101011100110101111000110010101100110001";

export default function ShowcaseDemo({ demo, lang }: { demo: Demo; lang: Lang }) {
  if (demo === "approval") {
    return (
      <Frame lang={lang}>
        <p className="text-xs text-muted">{tx(lang, "Café Aurora · 3 posts para aprovar", "Café Aurora · 3 posts to approve")}</p>
        <div className="mt-2 rounded-lg border border-edge bg-surface p-3">
          <p className="text-sm font-semibold">{tx(lang, "Terça · Reels do bolo de cenoura", "Tuesday · Carrot cake Reel")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">{tx(lang, "Aprovar", "Approve")}</span>
            <span className="rounded-md border border-edge px-3 py-1 text-xs">{tx(lang, "Pedir ajuste", "Ask for changes")}</span>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-500">
          <Icon name="check" size={12} /> {tx(lang, "Aprovado por Ana · agendado", "Approved by Ana · scheduled")}
        </p>
      </Frame>
    );
  }
  if (demo === "carousel") {
    return (
      <Frame lang={lang}>
        <div className="relative h-28">
          {[2, 1, 0].map((i) => (
            <div
              key={i}
              className="absolute top-0 h-28 w-[5.5rem] rounded-lg border border-edge p-2 shadow-lg"
              style={{ left: `${i * 2.4}rem`, background: i === 0 ? "var(--accent)" : "var(--surface)", transform: `rotate(${(i - 1) * 4}deg)` }}
            >
              <div className={`h-1.5 w-10 rounded-full ${i === 0 ? "bg-accent-ink/80" : "bg-edge"}`} />
              <div className={`mt-2 h-1.5 w-14 rounded-full ${i === 0 ? "bg-accent-ink/60" : "bg-edge"}`} />
              <div className={`mt-1 h-1.5 w-12 rounded-full ${i === 0 ? "bg-accent-ink/60" : "bg-edge"}`} />
              <p className={`absolute bottom-1.5 right-2 text-[10px] font-bold ${i === 0 ? "text-accent-ink" : "text-muted"}`}>{`${i + 1}/6`}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Icon name="download" size={12} /> {tx(lang, "6 imagens 1080×1350 · ZIP", "6 images 1080×1350 · ZIP")}
        </p>
      </Frame>
    );
  }
  if (demo === "voice") {
    return (
      <Frame lang={lang}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
            <Icon name="mic" size={18} />
          </span>
          <div className="flex h-8 items-center gap-1">
            {[10, 22, 16, 28, 12, 24, 18, 8, 20, 14].map((h, i) => (
              <span key={i} className="w-1 animate-pulse rounded-full bg-accent/70" style={{ height: h, animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">{tx(lang, "“Quem mais compra com vocês hoje?”", "“Who buys from you the most today?”")}</p>
        <p className="mt-1.5 text-[11px] text-muted">{tx(lang, "Público, tom e canais anotados ✓", "Audience, tone and channels noted ✓")}</p>
      </Frame>
    );
  }
  if (demo === "radar") {
    return (
      <Frame lang={lang}>
        <p className="font-[family-name:var(--font-display)] text-4xl font-extrabold text-accent">{tx(lang, "15,8%", "15.8%")}</p>
        <p className="text-[11px] text-muted">{tx(lang, "das menções nas respostas da IA", "of mentions in AI answers")}</p>
        <div className="mt-3 space-y-2">
          <Bar label={tx(lang, "Concorrente A", "Competitor A")} value={7} max={19} accent={false} />
          <Bar label={tx(lang, "Sua marca", "Your brand")} value={3} max={19} />
        </div>
      </Frame>
    );
  }
  if (demo === "scope") {
    return (
      <Frame lang={lang}>
        <div className="space-y-2">
          <Bar label={tx(lang, "Posts no feed", "Feed posts")} value={10} max={12} />
          <Bar label="Stories" value={8} max={8} />
        </div>
        <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          {tx(lang, "Extra: +2 Stories · R$ 120 — aprovado pelo cliente", "Extra: +2 Stories · R$ 120 — approved by the client")}
        </p>
      </Frame>
    );
  }
  if (demo === "invoice") {
    return (
      <Frame lang={lang}>
        <div className="flex items-center gap-4">
          <div className="grid shrink-0 grid-cols-[repeat(14,minmax(0,1fr))] gap-px rounded-md bg-white p-1.5" style={{ width: 84, height: 84 }}>
            {QR_BITS.slice(0, 196).split("").map((b, i) => (
              <span key={i} className={b === "1" ? "bg-black" : "bg-white"} />
            ))}
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold">R$ 2.400</p>
            <p className="text-[11px] text-muted">{tx(lang, "fee de outubro · vence dia 10", "October fee · due on the 10th")}</p>
            <p className="mt-1.5 text-[11px] font-medium text-accent">{tx(lang, "Pix copia e cola", "Pix copy and paste")}</p>
          </div>
        </div>
      </Frame>
    );
  }
  if (demo === "bio") {
    const rows: [string, string, number][] = [
      ["Cardápio da semana", "This week's menu", 128],
      ["Encomendas no WhatsApp", "Orders on WhatsApp", 94],
      ["Post de terça", "Tuesday's post", 41],
    ];
    return (
      <Frame lang={lang}>
        <ul className="space-y-1.5">
          {rows.map(([pt, en, n]) => (
            <li key={pt} className="flex items-center justify-between gap-2 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs">
              <span className="truncate">{tx(lang, pt, en)}</span>
              <span className="shrink-0 tabular-nums text-muted">{tx(lang, `${n} cliques`, `${n} clicks`)}</span>
            </li>
          ))}
        </ul>
      </Frame>
    );
  }
  if (demo === "panel") {
    return (
      <Frame lang={lang}>
        <div className="space-y-2">
          {[
            ["A", 5.4, false],
            ["B", 8.3, true],
          ].map(([letter, score, win]) => (
            <div key={String(letter)} className="flex items-center gap-2 text-xs">
              <span className={`grid size-6 place-items-center rounded-full font-bold ${win ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>{String(letter)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${win ? "bg-accent" : "bg-edge"}`} style={{ width: `${Number(score) * 10}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums">{lang === "pt" ? String(score).replace(".", ",") : String(score)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">{tx(lang, "Simulação com 4 personas da estratégia", "Simulation with 4 strategy personas")}</p>
      </Frame>
    );
  }
  if (demo === "portfolio") {
    return (
      <Frame lang={lang}>
        <div className="grid grid-cols-3 gap-2">
          {["from-accent/60 to-accent/10", "from-sky-400/50 to-surface-2", "from-emerald-400/50 to-surface-2"].map((g) => (
            <div key={g} className={`aspect-square rounded-lg bg-gradient-to-br ${g}`} />
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Icon name="sparkle" size={12} className="text-accent" /> {tx(lang, "3 trabalhos · lidos pelo match da IA", "3 pieces · read by the AI match")}
        </p>
      </Frame>
    );
  }
  if (demo === "markup") {
    return (
      <Frame lang={lang}>
        <div className="relative h-28 overflow-hidden rounded-lg bg-gradient-to-br from-accent/40 via-surface-2 to-surface">
          {[
            [22, 30, 1],
            [64, 58, 2],
          ].map(([x, y, n]) => (
            <span key={n} className="absolute grid size-6 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink shadow" style={{ left: `${x}%`, top: `${y}%` }}>
              {n}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">{tx(lang, "1 · Clarear o fundo   2 · Logo maior", "1 · Lighter background   2 · Bigger logo")}</p>
      </Frame>
    );
  }
  // tier
  return (
    <Frame lang={lang}>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-500">{tx(lang, "Ouro", "Gold")}</span>
        <span className="text-xs text-muted">{tx(lang, "R$ 1.200 a receber", "R$ 1,200 to receive")}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-3/4 rounded-full bg-accent" />
      </div>
      <p className="mt-2 text-[11px] text-muted">{tx(lang, "Faltam 2 entregas bem avaliadas para Platina", "2 well-rated deliveries to Platinum")}</p>
    </Frame>
  );
}
