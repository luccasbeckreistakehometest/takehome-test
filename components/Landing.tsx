"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { MarqaWordmark } from "./MarqaLogo";

type Lang = "pt" | "en";

// ---------- Conteúdo (PT / EN) ----------
const T = {
  pt: {
    eyebrow: "Central de marketing com IA",
    h1a: "Semanas de marketing,",
    h1b: "entregues em minutos.",
    sub: "A Marqa conecta agência, cliente e profissionais em uma plataforma whitelabel — e gera estratégia, campanhas, identidade e conteúdo com IA e pesquisa real de mercado.",
    ctaPrimary: "Criar conta grátis",
    ctaSecondary: "Entrar",
    trust: "Feita para quem vive de resultado.",
    worksWith: "Gera conteúdo para",
    stats: [
      { n: 9, suf: "", label: "entregáveis de IA por cliente" },
      { n: 3, suf: "", label: "lados conectados numa plataforma" },
      { n: 10, suf: "+", label: "ferramentas num só lugar" },
    ],
    howTitle: "Do briefing ao pronto, em 3 passos",
    how: [
      { icon: "clipboard" as IconName, t: "1. Conte o briefing", d: "Uma vez só. É o que alimenta toda a IA da plataforma." },
      { icon: "sparkle" as IconName, t: "2. A IA cria", d: "Estratégia, campanha, identidade e social — com pesquisa real e atual do seu mercado." },
      { icon: "check" as IconName, t: "3. Aprove e publique", d: "Revise, ajuste e coloque no ar. Conecte profissionais e meça o retorno." },
    ],
    featTitle: "Tudo que uma operação de marketing precisa",
    featSub: "Um kit completo por cliente, mais o ecossistema para produzir e vender.",
    features: [
      { icon: "radar" as IconName, t: "Estratégia com pesquisa real", d: "Deep dive de mercado: tendências atuais, personas, concorrentes e metas." },
      { icon: "megaphone" as IconName, t: "Campanhas prontas", d: "Plano acionável com canais, mensagens e influenciadores reais." },
      { icon: "palette" as IconName, t: "Identidade visual", d: "Conceitos de marca, paleta e direção de arte no tom do cliente." },
      { icon: "calendar" as IconName, t: "Social & posts", d: "Calendário completo e posts prontos: feed, Stories, Reels, carrossel." },
      { icon: "users" as IconName, t: "Marketplace de profissionais", d: "Match por IA de fotógrafos e designers, com pagamento garantido (escrow)." },
      { icon: "message" as IconName, t: "Mensagens WhatsApp & IG", d: "Listas de transmissão, agendamento e rascunho por IA." },
      { icon: "chart" as IconName, t: "Insights & vendas", d: "Funil, receita e conexão com GA4, Meta Ads e suas vendas reais." },
      { icon: "sparkle" as IconName, t: "100% Whitelabel", d: "A plataforma com a sua marca: logo, cores e domínio próprios." },
    ],
    whoTitle: "Feita para os três lados",
    who: [
      { icon: "briefcase" as IconName, t: "Agências", d: "Escale o número de clientes sem inflar a equipe. Mais entregas, mais margem, mais retenção.", cta: "Começar como agência" },
      { icon: "target" as IconName, t: "Marcas & empresas", d: "Marketing de agência, sem o custo de uma agência. Estratégia e conteúdo sob medida.", cta: "Começar minha marca" },
      { icon: "user" as IconName, t: "Profissionais", d: "Fotógrafos e designers: receba demandas reais com match por IA e pagamento seguro.", cta: "Criar meu perfil" },
    ],
    bandTitle: "De semanas para minutos.",
    bandSub: "O que custava dias de um estrategista sênior, entregue com consistência e fontes reais — no seu idioma e na sua marca.",
    pricingTitle: "Comece grátis. Evolua quando crescer.",
    pricingSub: "Planos mensais a anuais (com desconto) e créditos avulsos. Sem cartão para começar.",
    finalTitle: "Pronto para acelerar seu marketing?",
    finalSub: "Crie sua conta em segundos e gere seu primeiro kit hoje.",
    footer: "sua marca, acelerada por IA",
  },
  en: {
    eyebrow: "AI marketing hub",
    h1a: "Weeks of marketing,",
    h1b: "delivered in minutes.",
    sub: "Marqa connects agency, client and freelancers in one whitelabel platform — and generates strategy, campaigns, identity and content with AI and real market research.",
    ctaPrimary: "Start for free",
    ctaSecondary: "Sign in",
    trust: "Built for people who live on results.",
    worksWith: "Creates content for",
    stats: [
      { n: 9, suf: "", label: "AI deliverables per client" },
      { n: 3, suf: "", label: "sides connected in one platform" },
      { n: 10, suf: "+", label: "tools in a single place" },
    ],
    howTitle: "From brief to done, in 3 steps",
    how: [
      { icon: "clipboard" as IconName, t: "1. Share the brief", d: "Just once. It powers all the AI in the platform." },
      { icon: "sparkle" as IconName, t: "2. AI creates", d: "Strategy, campaign, identity and social — with real, current research on your market." },
      { icon: "check" as IconName, t: "3. Approve & publish", d: "Review, tweak and go live. Connect professionals and measure the return." },
    ],
    featTitle: "Everything a marketing operation needs",
    featSub: "A full kit per client, plus the ecosystem to produce and sell.",
    features: [
      { icon: "radar" as IconName, t: "Strategy with real research", d: "Market deep dive: current trends, personas, competitors and goals." },
      { icon: "megaphone" as IconName, t: "Ready campaigns", d: "Actionable plan with channels, messaging and real influencers." },
      { icon: "palette" as IconName, t: "Visual identity", d: "Brand concepts, palette and art direction in the client's tone." },
      { icon: "calendar" as IconName, t: "Social & posts", d: "Full calendar and ready posts: feed, Stories, Reels, carousel." },
      { icon: "users" as IconName, t: "Professionals marketplace", d: "AI match of photographers and designers, with guaranteed payment (escrow)." },
      { icon: "message" as IconName, t: "WhatsApp & IG messaging", d: "Broadcast lists, scheduling and AI-drafted messages." },
      { icon: "chart" as IconName, t: "Insights & sales", d: "Funnel, revenue and connection to GA4, Meta Ads and your real sales." },
      { icon: "sparkle" as IconName, t: "100% Whitelabel", d: "The platform with your brand: your logo, colors and domain." },
    ],
    whoTitle: "Built for all three sides",
    who: [
      { icon: "briefcase" as IconName, t: "Agencies", d: "Scale clients without scaling the team. More output, more margin, more retention.", cta: "Start as an agency" },
      { icon: "target" as IconName, t: "Brands & businesses", d: "Agency-grade marketing without the agency cost. Tailored strategy and content.", cta: "Start my brand" },
      { icon: "user" as IconName, t: "Professionals", d: "Photographers and designers: get real work via AI match and secure payment.", cta: "Create my profile" },
    ],
    bandTitle: "From weeks to minutes.",
    bandSub: "What used to take days of a senior strategist, delivered consistently and with real sources — in your language and your brand.",
    pricingTitle: "Start free. Grow when you grow.",
    pricingSub: "Monthly to annual plans (with discounts) and pay-as-you-go credits. No card to start.",
    finalTitle: "Ready to accelerate your marketing?",
    finalSub: "Create your account in seconds and generate your first kit today.",
    footer: "your brand, powered by AI",
  },
};

const CHANNELS = ["Instagram", "WhatsApp", "TikTok", "Facebook", "YouTube", "E-commerce"];

// Números que sobem quando entram na tela
function CountUp({ to, suffix, duration = 1500 }: { to: number; suffix: string; duration?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(Math.round(to * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>("pt");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("uiLang");
      if (saved === "en") setLang("en");
    } catch {}
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  function switchLang(l: Lang) {
    setLang(l);
    try {
      localStorage.setItem("uiLang", l);
    } catch {}
  }

  const t = T[lang];

  return (
    <div className="-mx-4 -my-8 overflow-hidden">
      {/* ================= HERO ================= */}
      <section className="relative px-4 pb-20 pt-16 sm:pt-24">
        {/* glows de fundo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="glow-pulse absolute -top-32 right-[8%] size-[38rem] rounded-full bg-accent/20 blur-[120px]" />
          <div className="glow-pulse absolute top-40 -left-24 size-[30rem] rounded-full bg-sky-500/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          {/* toggle de idioma da landing */}
          <div className="mb-8 flex justify-end">
            <div className="inline-flex rounded-full border border-edge bg-surface-2 p-0.5 text-xs">
              {(["pt", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => switchLang(l)}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    lang === l ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Coluna texto */}
            <div className="reveal">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                <Icon name="sparkle" size={13} /> {t.eyebrow}
              </span>
              <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                {t.h1a}
                <br />
                <span className="hero-gradient-text">{t.h1b}</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t.sub}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/criar-conta"
                  className="group inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-semibold text-accent-ink shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
                >
                  {t.ctaPrimary}
                  <Icon name="send" size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-6 py-3.5 font-semibold transition-colors hover:border-accent"
                >
                  {t.ctaSecondary}
                </Link>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-muted">
                <Icon name="check" size={15} className="text-accent" /> {t.trust}
              </p>
            </div>

            {/* Coluna visual */}
            <div className="reveal relative">
              <HeroVisual lang={lang} />
            </div>
          </div>

          {/* Canais */}
          <div className="reveal mt-16">
            <p className="text-center text-xs uppercase tracking-widest text-muted">{t.worksWith}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-70">
              {CHANNELS.map((c) => (
                <span key={c} className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="border-y border-edge bg-surface/40 px-4 py-14">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          {t.stats.map((s, i) => (
            <div key={i} className="reveal text-center" style={{ transitionDelay: `${i * 90}ms` }}>
              <p className="font-[family-name:var(--font-display)] text-6xl font-extrabold text-accent">
                <CountUp to={s.n} suffix={s.suf} />
              </p>
              <p className="mt-2 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= COMO FUNCIONA ================= */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="reveal text-center font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
            {t.howTitle}
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {t.how.map((step, i) => (
              <div
                key={i}
                className="reveal card-hover relative rounded-2xl border border-edge bg-surface p-7"
                style={{ transitionDelay: `${i * 110}ms` }}
              >
                <span className="grid size-12 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Icon name={step.icon} size={24} />
                </span>
                <h3 className="mt-5 text-xl font-bold">{step.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="border-t border-edge px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
              {t.featTitle}
            </h2>
            <p className="mt-4 text-muted">{t.featSub}</p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.map((f, i) => (
              <div
                key={i}
                className="reveal card-hover group rounded-2xl border border-edge bg-surface p-6"
                style={{ transitionDelay: `${(i % 4) * 80}ms` }}
              >
                <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                  <Icon name={f.icon} size={22} />
                </span>
                <h3 className="mt-4 font-bold">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= BAND (impacto) ================= */}
      <section className="relative overflow-hidden px-4 py-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="glow-pulse absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[120px]" />
        </div>
        <div className="reveal relative mx-auto max-w-3xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-tight sm:text-6xl">
            {t.bandTitle}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">{t.bandSub}</p>
        </div>
      </section>

      {/* ================= PARA QUEM É ================= */}
      <section className="border-t border-edge px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="reveal text-center font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
            {t.whoTitle}
          </h2>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {t.who.map((w, i) => (
              <div
                key={i}
                className="reveal card-hover flex flex-col rounded-2xl border border-edge bg-surface p-8"
                style={{ transitionDelay: `${i * 110}ms` }}
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
                  <Icon name={w.icon} size={28} />
                </span>
                <h3 className="mt-5 text-2xl font-bold">{w.t}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-muted">{w.d}</p>
                <Link
                  href="/criar-conta"
                  className="mt-6 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                >
                  {w.cta} <Icon name="send" size={15} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRICING + FINAL CTA ================= */}
      <section className="relative overflow-hidden border-t border-edge px-4 py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <div className="glow-pulse absolute -bottom-40 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-accent/15 blur-[130px]" />
        </div>
        <div className="reveal relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t.pricingTitle}</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-tight">
            {t.finalTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">{t.finalSub}</p>
          <p className="mt-2 text-sm text-muted">{t.pricingSub}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/criar-conta"
              className="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-4 text-lg font-semibold text-accent-ink shadow-xl shadow-accent/25 transition-transform hover:-translate-y-0.5"
            >
              {t.ctaPrimary}
              <Icon name="send" size={18} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-8 py-4 text-lg font-semibold transition-colors hover:border-accent"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>

        <div className="relative mx-auto mt-24 max-w-6xl border-t border-edge pt-8 text-center">
          <div className="flex justify-center">
            <MarqaWordmark size={30} />
          </div>
          <p className="mt-2 text-sm text-muted">{t.footer}</p>
        </div>
      </section>
    </div>
  );
}

// Composição visual do hero (mock do "kit sendo gerado" + chips flutuantes)
function HeroVisual({ lang }: { lang: Lang }) {
  const chips: { icon: IconName; label: Record<Lang, string> }[] = [
    { icon: "radar", label: { pt: "Estratégia", en: "Strategy" } },
    { icon: "megaphone", label: { pt: "Campanha", en: "Campaign" } },
    { icon: "palette", label: { pt: "Identidade", en: "Identity" } },
    { icon: "calendar", label: { pt: "Social", en: "Social" } },
  ];
  return (
    <div className="relative mx-auto max-w-md">
      {/* card principal */}
      <div className="relative rounded-3xl border border-edge bg-surface/80 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-ink">
            <Icon name="sparkle" size={18} />
          </span>
          <div>
            <p className="text-sm font-bold">Ateliê Amora</p>
            <p className="text-[11px] text-muted">{lang === "pt" ? "gerando kit completo…" : "generating full kit…"}</p>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {[90, 75, 60, 82, 45].map((w, i) => (
            <div key={i} className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="skeleton h-full rounded-full"
                style={{ width: `${w}%`, opacity: 1 - i * 0.14 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-3 py-2">
          <span className="text-xs font-semibold text-accent">
            {lang === "pt" ? "9 entregáveis prontos" : "9 deliverables ready"}
          </span>
          <Icon name="check" size={15} className="text-accent" />
        </div>
      </div>

      {/* chips flutuantes (afastados do card para não cobrir o texto) */}
      <div className="float-slow absolute -left-10 -top-5 hidden rounded-xl border border-edge bg-surface px-3 py-2 shadow-xl lg:flex items-center gap-1.5">
        <Icon name={chips[0].icon} size={15} className="text-accent" />
        <span className="text-xs font-semibold">{chips[0].label[lang]}</span>
      </div>
      <div className="float-slow delay absolute -right-10 top-16 hidden rounded-xl border border-edge bg-surface px-3 py-2 shadow-xl lg:flex items-center gap-1.5">
        <Icon name={chips[1].icon} size={15} className="text-accent" />
        <span className="text-xs font-semibold">{chips[1].label[lang]}</span>
      </div>
      <div className="float-slow absolute -left-10 bottom-24 hidden rounded-xl border border-edge bg-surface px-3 py-2 shadow-xl lg:flex items-center gap-1.5">
        <Icon name={chips[2].icon} size={15} className="text-accent" />
        <span className="text-xs font-semibold">{chips[2].label[lang]}</span>
      </div>
      <div className="float-slow delay absolute -right-12 -bottom-4 hidden rounded-xl border border-edge bg-surface px-3 py-2 shadow-xl lg:flex items-center gap-1.5">
        <Icon name={chips[3].icon} size={15} className="text-accent" />
        <span className="text-xs font-semibold">{chips[3].label[lang]}</span>
      </div>
    </div>
  );
}
