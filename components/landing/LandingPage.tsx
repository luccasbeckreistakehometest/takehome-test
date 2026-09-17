"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { MarqaWordmark } from "@/components/MarqaLogo";
import type { LandingConfig, Lang } from "@/lib/landing-content";
import Pricing from "./Pricing";
import ShowcaseDemo from "./ShowcaseDemo";

const CHANNELS = ["Instagram", "WhatsApp", "TikTok", "Facebook", "YouTube", "E-commerce"];

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
            setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="reveal rounded-xl border border-edge bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
      >
        {q}
        <Icon name={open ? "x" : "plus"} size={18} className="shrink-0 text-accent" />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

function HeroVisual({ lang }: { lang: Lang }) {
  const chips: { icon: IconName; label: Record<Lang, string> }[] = [
    { icon: "radar", label: { pt: "Estratégia", en: "Strategy" } },
    { icon: "megaphone", label: { pt: "Campanha", en: "Campaign" } },
    { icon: "palette", label: { pt: "Identidade", en: "Identity" } },
    { icon: "calendar", label: { pt: "Social", en: "Social" } },
  ];
  return (
    <div className="relative mx-auto max-w-md">
      <div className="relative rounded-3xl border border-edge bg-surface/80 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-ink">
            <Icon name="sparkle" size={18} />
          </span>
          <div>
            <p className="text-sm font-bold">Ateliê Amora</p>
            <p className="text-[11px] text-muted">
              {lang === "pt" ? "gerando kit completo…" : "generating full kit…"}
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {[90, 75, 60, 82, 45].map((w, i) => (
            <div key={i} className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="skeleton h-full rounded-full" style={{ width: `${w}%`, opacity: 1 - i * 0.14 }} />
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
      {chips.map((c, i) => {
        const pos = [
          "-left-10 -top-5",
          "-right-10 top-16 delay",
          "-left-10 bottom-24",
          "-right-12 -bottom-4 delay",
        ][i];
        return (
          <div
            key={i}
            className={`float-slow ${pos} absolute hidden items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2 shadow-xl lg:flex`}
          >
            <Icon name={c.icon} size={15} className="text-accent" />
            <span className="text-xs font-semibold">{c.label[lang]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage({ config, cardSubscription = false }: { config: LandingConfig; cardSubscription?: boolean }) {
  const [lang, setLang] = useState<Lang>("pt");

  useEffect(() => {
    try {
      if (localStorage.getItem("uiLang") === "en") setLang("en");
    } catch {}
  }, []);
  useEffect(() => {
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
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  function switchLang(l: Lang) {
    setLang(l);
    try {
      localStorage.setItem("uiLang", l);
    } catch {}
  }

  const t = config.content[lang];
  const signupHref = `/criar-conta${config.signupType ? `?type=${config.signupType}` : ""}`;
  const secondaryHref = config.pricingType ? "#planos" : config.showAudienceCards ? "#publicos" : "/login";

  const CtaPrimary = ({ label, big }: { label: string; big?: boolean }) => (
    <Link
      href={signupHref}
      data-track="cta_click"
      data-track-label="hero"
      className={`group inline-flex items-center gap-2 rounded-xl bg-accent font-semibold text-accent-ink shadow-lg shadow-accent/25 transition-transform hover:-translate-y-0.5 ${
        big ? "px-8 py-4 text-lg" : "px-6 py-3.5"
      }`}
    >
      {label}
      <Icon name="send" size={big ? 18 : 16} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );

  return (
    <div className="-mx-4 -my-8 overflow-hidden">
      {/* HERO */}
      <section className="relative px-4 pb-20 pt-14 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="glow-pulse absolute -top-32 right-[6%] size-[40rem] rounded-full bg-accent/25 blur-[130px]" />
          <div className="glow-pulse absolute top-40 -left-24 size-[30rem] rounded-full bg-[var(--accent-2)]/10 blur-[130px]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
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
                <CtaPrimary label={t.ctaPrimary} />
                <Link
                  href={secondaryHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-6 py-3.5 font-semibold transition-colors hover:border-accent"
                >
                  {t.ctaSecondary}
                </Link>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-muted">
                <Icon name="check" size={15} className="text-accent" /> {t.trust}
              </p>
            </div>
            <div className="reveal">
              <HeroVisual lang={lang} />
            </div>
          </div>
          <div className="reveal mt-16">
            <p className="text-center text-xs uppercase tracking-widest text-muted">
              {lang === "pt" ? "Gera conteúdo para" : "Creates content for"}
            </p>
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

      {/* STATS */}
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

      {/* VITRINE: o que só a Marqa faz */}
      {t.showcase && (
        <section className="px-4 py-24" data-testid="landing-showcase">
          <div className="mx-auto max-w-6xl">
            <div className="reveal mx-auto max-w-2xl text-center">
              <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">{t.showcase.title}</h2>
              <p className="mt-4 text-muted">{t.showcase.sub}</p>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {t.showcase.items.map((item, i) => {
                // bento: o 1º e o 4º ocupam duas colunas no desktop
                const wide = t.showcase!.items.length === 4 && (i === 0 || i === 3);
                return (
                  <Link
                    key={item.t}
                    href={item.href}
                    data-testid="showcase-card"
                    data-demo={item.demo}
                    data-track="cta_click"
                    data-track-label={`showcase-${item.demo}`}
                    className={`reveal card-hover group flex flex-col rounded-2xl border border-edge bg-surface p-6 ${wide ? "lg:col-span-2" : ""}`}
                    style={{ transitionDelay: `${(i % 3) * 80}ms` }}
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                      <Icon name={item.icon} size={22} />
                    </span>
                    <h3 className="mt-4 text-lg font-bold">{item.t}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.d}</p>
                    <div className="flex-1">
                      <ShowcaseDemo demo={item.demo} lang={lang} />
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                      {item.cta} <Icon name="send" size={14} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* PROBLEMA -> SOLUÇÃO */}
      <section className="px-4 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div className="reveal">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {t.problemTitle}
            </h2>
            <ul className="mt-7 space-y-3">
              {t.problems.map((p) => (
                <li key={p} className="flex items-start gap-3 text-muted">
                  <Icon name="x" size={18} className="mt-0.5 shrink-0 text-red-500" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal rounded-2xl border border-accent/30 bg-accent/[0.06] p-8">
            <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-ink">
              <Icon name="sparkle" size={24} />
            </span>
            <p className="mt-5 text-lg leading-relaxed">{t.solution}</p>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="border-t border-edge px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
              {t.benefitsTitle}
            </h2>
            <p className="mt-4 text-muted">{t.benefitsSub}</p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.benefits.map((f, i) => (
              <div
                key={f.t}
                className="reveal card-hover group rounded-2xl border border-edge bg-surface p-6"
                style={{ transitionDelay: `${(i % 3) * 80}ms` }}
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

      {/* UM MÊS COM A MARQA (agências) */}
      {t.timeline && (
        <section className="border-t border-edge px-4 py-24" data-testid="landing-timeline">
          <div className="mx-auto max-w-4xl">
            <div className="reveal text-center">
              <h2 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">{t.timeline.title}</h2>
              <p className="mt-4 text-muted">{t.timeline.sub}</p>
            </div>
            <ol className="relative mt-12 space-y-5 border-l border-edge pl-6 sm:pl-8">
              {t.timeline.steps.map((step, i) => (
                <li key={step.when} className="reveal relative" style={{ transitionDelay: `${i * 70}ms` }}>
                  <span className="absolute -left-[1.95rem] top-1 grid size-4 place-items-center rounded-full border-2 border-accent bg-background sm:-left-[2.45rem]" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">{step.when}</p>
                  <p className="mt-1 text-lg font-semibold leading-snug">{step.t}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* COMO FUNCIONA */}
      <section className="border-t border-edge px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="reveal text-center font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
            {t.howTitle}
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {t.how.map((step, i) => (
              <div key={step.t} className="reveal relative rounded-2xl border border-edge bg-surface p-7" style={{ transitionDelay: `${i * 110}ms` }}>
                <span className="absolute right-5 top-5 font-[family-name:var(--font-display)] text-4xl font-extrabold text-edge">
                  {i + 1}
                </span>
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

      {/* DO JEITO DE HOJE × COM A MARQA */}
      {t.compare && (
        <section className="border-t border-edge px-4 py-24" data-testid="landing-compare">
          <div className="mx-auto max-w-4xl">
            <h2 className="reveal text-center font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">{t.compare.title}</h2>
            <div className="reveal mt-12 overflow-x-auto rounded-2xl border border-edge bg-surface">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-edge text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-3 font-semibold">{t.compare.head[0]}</th>
                    <th className="px-4 py-3 font-semibold">{t.compare.head[1]}</th>
                    <th className="px-4 py-3 font-semibold text-accent">{t.compare.head[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {t.compare.rows.map(([task, today, marqa]) => (
                    <tr key={task}>
                      <td className="px-4 py-3 font-semibold">{task}</td>
                      <td className="px-4 py-3 text-muted">
                        <span className="inline-flex items-start gap-1.5">
                          <Icon name="x" size={14} className="mt-0.5 shrink-0 text-red-500" />
                          {today}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-start gap-1.5">
                          <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />
                          {marqa}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* PÚBLICOS (só na geral) */}
      {config.showAudienceCards && t.audiences && (
        <section id="publicos" className="border-t border-edge px-4 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="reveal text-center font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
              {t.audienceTitle}
            </h2>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {t.audiences.map((w, i) => (
                <Link
                  key={w.t}
                  href={w.href}
                  className="reveal card-hover flex flex-col rounded-2xl border border-edge bg-surface p-8"
                  style={{ transitionDelay: `${i * 110}ms` }}
                >
                  <span className="grid size-14 place-items-center rounded-2xl bg-accent/10 text-accent">
                    <Icon name={w.icon} size={28} />
                  </span>
                  <h3 className="mt-5 text-2xl font-bold">{w.t}</h3>
                  <p className="mt-2 flex-1 leading-relaxed text-muted">{w.d}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 font-semibold text-accent">
                    {w.cta} <Icon name="send" size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PREÇOS (nos funis específicos) */}
      {config.pricingType && <Pricing accountType={config.pricingType} lang={lang} cardSubscription={cardSubscription} />}

      {/* FAQ */}
      <section className="border-t border-edge px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="reveal text-center font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
            {t.faqTitle}
          </h2>
          <div className="mt-12 space-y-3">
            {t.faq.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden border-t border-edge px-4 py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <div className="glow-pulse absolute -bottom-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />
        </div>
        <div className="reveal relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t.finalEyebrow}</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-tight">
            {t.finalTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">{t.finalSub}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <CtaPrimary label={t.ctaFinal} big />
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-8 py-4 text-lg font-semibold transition-colors hover:border-accent"
            >
              {lang === "pt" ? "Entrar" : "Sign in"}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto mt-24 flex max-w-6xl flex-col items-center gap-3 border-t border-edge pt-8 text-center sm:flex-row sm:justify-between">
          <MarqaWordmark size={30} />
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-muted">
            <Link href="/para-agencias" className="hover:text-foreground">{lang === "pt" ? "Agências" : "Agencies"}</Link>
            <Link href="/para-marcas" className="hover:text-foreground">{lang === "pt" ? "Marcas" : "Brands"}</Link>
            <Link href="/para-profissionais" className="hover:text-foreground">{lang === "pt" ? "Profissionais" : "Professionals"}</Link>
            <Link href="/login" className="hover:text-foreground">{lang === "pt" ? "Entrar" : "Sign in"}</Link>
            <Link href={lang === "pt" ? "/termos" : "/terms"} className="hover:text-foreground">{lang === "pt" ? "Termos" : "Terms"}</Link>
            <Link href={lang === "pt" ? "/privacidade" : "/privacy"} className="hover:text-foreground">{lang === "pt" ? "Privacidade" : "Privacy"}</Link>
            <Link href={lang === "pt" ? "/reembolso" : "/refunds"} className="hover:text-foreground">{lang === "pt" ? "Reembolso" : "Refunds"}</Link>
            <Link href={lang === "pt" ? "/contato" : "/contact"} className="hover:text-foreground">{lang === "pt" ? "Contato" : "Contact"}</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
