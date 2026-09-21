import { Icon } from "@/components/icons";
import type { Lang, ShowcaseDemo as Demo } from "@/lib/landing-content";

// Mini-ilustrações da vitrine: desenhadas com a interface real da Marqa em
// mente (sem print pesado), com texto nos dois idiomas. Dados de exemplo.
const tx = (lang: Lang, pt: string, en: string) => (lang === "pt" ? pt : en);

function Frame({ children, lang }: { children: React.ReactNode; lang: Lang }) {
  return (
    <figure className="relative mt-0 rounded-md border border-rule bg-surface px-4 pb-4 pt-7" aria-hidden="true">
      <figcaption className="t6 absolute right-3 top-2 text-text-muted">{tx(lang, "exemplo", "example")}</figcaption>
      {children}
    </figure>
  );
}

function Bar({ label, value, max, accent = true }: { label: string; value: number; max: number; accent?: boolean }) {
  return (
    <div>
      <div className="t5 flex justify-between text-text-muted">
        <span>{label}</span>
        <span className="tnum">{`${value}/${max}`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-xs bg-surface-sunken">
        <div className={`h-full rounded-xs ${accent ? "bg-text" : "bg-text-faint"}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
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
        <p className="t5 text-text-muted">{tx(lang, "Café Aurora · 3 posts para aprovar", "Café Aurora · 3 posts to approve")}</p>
        <div className="mt-2 rounded-sm border border-edge bg-surface p-3">
          <p className="t3 font-semibold">{tx(lang, "Terça · Reels do bolo de cenoura", "Tuesday · Carrot cake Reel")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="t5 rounded-xs bg-text px-3 py-1 font-medium text-canvas">{tx(lang, "Aprovar", "Approve")}</span>
            <span className="t5 rounded-xs border border-edge px-3 py-1">{tx(lang, "Pedir ajuste", "Ask for changes")}</span>
          </div>
        </div>
        <p className="t5 mt-2 flex items-center gap-1.5 text-positive">
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
              className="absolute top-0 h-28 w-[5.5rem] rounded-sm border border-edge p-2 "
              style={{ left: `${i * 2.4}rem`, background: i === 0 ? "var(--surface-sunken)" : "var(--surface)", transform: `rotate(${(i - 1) * 4}deg)` }}
            >
              <div className={`h-1.5 w-10 rounded-xs ${i === 0 ? "bg-text" : "bg-rule"}`} />
              <div className={`mt-2 h-1.5 w-14 rounded-xs ${i === 0 ? "bg-text-text-muted" : "bg-rule"}`} />
              <div className={`mt-1 h-1.5 w-12 rounded-xs ${i === 0 ? "bg-text-text-muted" : "bg-rule"}`} />
              <p className="t5 tnum absolute bottom-1.5 right-2 text-text-muted">{`${i + 1}/6`}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 t5 text-text-muted">
          <Icon name="download" size={12} /> {tx(lang, "6 imagens 1080×1350 · ZIP", "6 images 1080×1350 · ZIP")}
        </p>
      </Frame>
    );
  }
  if (demo === "voice") {
    return (
      <Frame lang={lang}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-text text-canvas">
            <Icon name="mic" size={18} />
          </span>
          <div className="flex h-8 items-center gap-1">
            {[10, 22, 16, 28, 12, 24, 18, 8, 20, 14].map((h, i) => (
              <span key={i} className="w-1 rounded-xs bg-text-faint" style={{ height: h }} />
            ))}
          </div>
        </div>
        <p className="mt-3 rounded-sm bg-surface-sunken px-3 py-2 t5">{tx(lang, "“Quem mais compra com vocês hoje?”", "“Who buys from you the most today?”")}</p>
        <p className="mt-1.5 t5 text-text-muted">{tx(lang, "Público, tom e canais anotados ✓", "Audience, tone and channels noted ✓")}</p>
      </Frame>
    );
  }
  if (demo === "radar") {
    return (
      <Frame lang={lang}>
        <p className="n2">{tx(lang, "15,8%", "15.8%")}</p>
        <p className="t5 text-text-muted">{tx(lang, "das menções nas respostas da IA", "of mentions in AI answers")}</p>
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
        <p className="t5 mt-3 rounded-xs border border-rule bg-surface-sunken px-3 py-2">
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
            <p className="n2">R$ 2.400</p>
            <p className="t5 text-text-muted">{tx(lang, "fee de outubro · vence dia 10", "October fee · due on the 10th")}</p>
            <p className="mt-1.5 t5 font-medium text-text-muted">{tx(lang, "Pix copia e cola", "Pix copy and paste")}</p>
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
            <li key={pt} className="t5 flex items-center justify-between gap-2 border-b border-rule py-1.5">
              <span className="truncate">{tx(lang, pt, en)}</span>
              <span className="tnum shrink-0 text-text-muted">{tx(lang, `${n} cliques`, `${n} clicks`)}</span>
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
            <div key={String(letter)} className="flex items-center gap-2 t5">
              <span className={`t5 grid size-6 place-items-center rounded-full font-medium ${win ? "bg-text text-canvas" : "bg-surface-sunken"}`}>{String(letter)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-xs bg-surface-sunken">
                <div className={`h-full rounded-xs ${win ? "bg-text" : "bg-text-faint"}`} style={{ width: `${Number(score) * 10}%` }} />
              </div>
              <span className="tnum w-8 text-right">{lang === "pt" ? String(score).replace(".", ",") : String(score)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 t5 text-text-muted">{tx(lang, "Simulação com 4 personas da estratégia", "Simulation with 4 strategy personas")}</p>
      </Frame>
    );
  }
  if (demo === "portfolio") {
    return (
      <Frame lang={lang}>
        <div className="grid grid-cols-3 gap-2">
          {["var(--n-300)", "var(--n-200)", "var(--n-150)"].map((tone) => (
            <div key={tone} className="aspect-square rounded-xs" style={{ background: tone }} />
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 t5 text-text-muted">
          <Icon name="layers" size={16} /> {tx(lang, "3 trabalhos · lidos pelo match da IA", "3 pieces · read by the AI match")}
        </p>
      </Frame>
    );
  }
  if (demo === "markup") {
    return (
      <Frame lang={lang}>
        <div className="relative h-28 overflow-hidden rounded-xs border border-rule bg-surface-sunken">
          {[
            [22, 30, 1],
            [64, 58, 2],
          ].map(([x, y, n]) => (
            <span key={n} className="t5 tnum absolute grid size-6 place-items-center rounded-full bg-text font-medium text-canvas" style={{ left: `${x}%`, top: `${y}%` }}>
              {n}
            </span>
          ))}
        </div>
        <p className="mt-2 t5 text-text-muted">{tx(lang, "1 · Clarear o fundo   2 · Logo maior", "1 · Lighter background   2 · Bigger logo")}</p>
      </Frame>
    );
  }
  // tier
  return (
    <Frame lang={lang}>
      <div className="flex items-center justify-between gap-3">
        <span className="t6 rounded-xs bg-caution-wash px-2 py-1 text-caution">{tx(lang, "Ouro", "Gold")}</span>
        <span className="t5 text-text-muted">{tx(lang, "R$ 1.200 a receber", "R$ 1,200 to receive")}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-xs bg-surface-sunken">
        <div className="h-full w-3/4 rounded-xs bg-text" />
      </div>
      <p className="mt-2 t5 text-text-muted">{tx(lang, "Faltam 2 entregas bem avaliadas para Platina", "2 well-rated deliveries to Platinum")}</p>
    </Frame>
  );
}
