"use client";

// Landing e funis — docs/DESIGN.md §4.1A (grade editorial) e §5.5 (orçamento de
// cor). O que mudou em relação à versão anterior, e por quê:
//
//  · A página era onze seções com a MESMA forma: título centrado + grade de
//    cartões iguais. Agora cada seção usa um split nomeado diferente do split
//    da seção anterior (lead 7+5, lead-rev 5+7, doc 8+4, prose 6, 12) — a regra
//    da §4.1 que impede a página de ter um ritmo só.
//  · A cor da marca aparece num papel só: o botão primário. Manchete, número,
//    eyebrow, ícone e régua são tinta neutra (§5.5).
//  · Saíram as manchas borradas de cor, o texto em gradiente, o cartão flutuante
//    de painel falso, o ícone de "IA" e o rounded-md — todos da lista proibida.
//  · O contador animado saiu: o número aparecia como 0 até o elemento entrar na
//    tela, e "0 não é vazio" (§9.2). O número agora é o número.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui";
import { MarqaWordmark } from "@/components/MarqaLogo";
import type { CSSProperties } from "react";
import type { LandingConfig, Lang } from "@/lib/landing-content";
import Pricing from "./Pricing";
import ShowcaseDemo from "./ShowcaseDemo";

/** SOFT do Fraunces: 0 no app e nos documentos, até 20 na peça pública (§3.1). */
const SOFT_12 = { "--soft": 12 } as CSSProperties;

const CHANNELS = ["Instagram", "WhatsApp", "TikTok", "Facebook", "YouTube", "E-commerce"];

/** Numeral de índice: dois dígitos, figura tabular, tinta fraca. */
const nn = (i: number) => String(i + 1).padStart(2, "0");

/** Olho de seção: t6 é o ÚNICO estilo em caixa alta, um por seção (§3.3.1). */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="t6 text-text-muted">{children}</p>;
}

function FaqItem({ q, a, n }: { q: string; a: string; n: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-rule">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-4 py-4 text-left"
      >
        <span className="idx t5 w-6 shrink-0">{nn(n)}</span>
        <span className="t2 flex-1 font-medium">{q}</span>
        <Icon
          name={open ? "minus" : "plus"}
          size={16}
          className="mt-1 shrink-0 text-text-muted"
        />
      </button>
      {open && <p className="t3 measure-prose pb-5 pl-10 text-text-muted">{a}</p>}
    </div>
  );
}

export default function LandingPage({
  config,
  cardSubscription = false,
}: {
  config: LandingConfig;
  cardSubscription?: boolean;
}) {
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
      { threshold: 0.12 },
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

  return (
    <div className="full-bleed">
      {/* ---------- HERO · split lead (7+5) ------------------------------- */}
      <section className="sec">
        <div className="ed">
          <div className="ed-grid">
            <div className="c7 reveal">
              <Eyebrow>{t.eyebrow}</Eyebrow>
              <h1 className="d1 mt-5" style={SOFT_12}>
                <span className="block">{t.h1a}</span>
                <span className="block text-text-muted">{t.h1b}</span>
              </h1>
              <p className="t1 measure-lede mt-7 text-text-muted">{t.sub}</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href={signupHref}
                  data-track="cta_click"
                  data-track-label="hero"
                  className={buttonClass("primary", "lg")}
                >
                  {t.ctaPrimary}
                </Link>
                <Link href={secondaryHref} className={buttonClass("secondary", "lg")}>
                  {t.ctaSecondary}
                </Link>
              </div>
              <p className="t5 mt-5 text-text-muted">{t.trust}</p>
            </div>

            {/* Sumário: o que a plataforma entrega, com anatomia de índice
                editorial — numeral tabular, régua entre linhas, sem cartão. */}
            <aside className="c5 reveal">
              <div className="flex items-baseline justify-between border-b border-edge pb-2">
                <Eyebrow>{lang === "pt" ? "No pacote" : "In the kit"}</Eyebrow>
                <span className="t5 idx">{nn(t.benefits.length - 1)}</span>
              </div>
              <ul>
                {t.benefits.slice(0, 7).map((b, i) => (
                  <li key={b.t} className="flex items-baseline gap-4 border-b border-rule py-3">
                    <span className="idx t5 w-6 shrink-0">{nn(i)}</span>
                    <span className="t3 flex-1">{b.t}</span>
                  </li>
                ))}
              </ul>
              <p className="t5 mt-3 text-text-muted">
                {lang === "pt"
                  ? "Cada item vira um entregável revisável, não um rascunho."
                  : "Every item becomes a reviewable deliverable, not a draft."}
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- CANAIS · faixa de 12, régua nas duas pontas ----------- */}
      <section className="sec-tight border-y border-rule">
        <div className="ed flex flex-wrap items-baseline gap-x-10 gap-y-3">
          <Eyebrow>{lang === "pt" ? "Gera conteúdo para" : "Creates content for"}</Eyebrow>
          {CHANNELS.map((c) => (
            <span key={c} className="t3 font-medium">
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- NÚMEROS · três figuras, tinta neutra, tabular --------- */}
      <section className="sec-tight">
        <div className="ed">
          <div className="ed-grid">
            {t.stats.map((s, i) => (
              <div key={i} className="c4 reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <p className="n1">
                  {s.n}
                  {s.suf}
                </p>
                <p className="t3 measure-lede mt-2 border-t border-rule pt-2 text-text-muted">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- VITRINE · linhas alternadas lead / lead-rev ----------- */}
      {t.showcase && (
        <section className="sec border-t border-rule" data-testid="landing-showcase">
          <div className="ed">
            <div className="ed-grid">
              <div className="c8 reveal">
                <h2 className="d2">{t.showcase.title}</h2>
              </div>
              <p className="c4 t3 measure-lede reveal text-text-muted md:pt-2">{t.showcase.sub}</p>
            </div>

            <div className="mt-14 border-t border-edge">
              {t.showcase.items.map((item, i) => (
                <Link
                  key={item.t}
                  href={item.href}
                  data-testid="showcase-card"
                  data-demo={item.demo}
                  data-track="cta_click"
                  data-track-label={`showcase-${item.demo}`}
                  className="group ed-grid border-b border-rule py-8 transition-colors duration-[var(--dur-1)] hover:bg-surface"
                >
                  <div className={i % 2 === 0 ? "c5" : "c-right5"}>
                    <div className="flex items-baseline gap-4">
                      <span className="idx t5 w-6 shrink-0">{nn(i)}</span>
                      <div className="min-w-0">
                        <h3 className="d4">{item.t}</h3>
                        <p className="t3 measure-lede mt-2 text-text-muted">{item.d}</p>
                        <span className="t5 mt-4 inline-flex items-center gap-1.5 font-medium underline-offset-4 group-hover:underline">
                          {item.cta}
                          <Icon name="arrow-right" size={16} />
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={i % 2 === 0 ? "c7" : "c-left7"}>
                    <ShowcaseDemo demo={item.demo} lang={lang} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- PROBLEMA → SOLUÇÃO · split lead-rev (5+7) ------------- */}
      <section className="sec border-t border-rule">
        <div className="ed">
          <div className="ed-grid">
            <div className="c5 reveal">
              <h2 className="d3">{t.problemTitle}</h2>
            </div>
            <div className="c7 reveal">
              <ul className="border-t border-edge">
                {t.problems.map((p) => (
                  <li key={p} className="t2 measure-prose border-b border-rule py-3 text-text-muted">
                    {p}
                  </li>
                ))}
              </ul>
              <p className="t1 measure-lede mt-8 border-l border-edge pl-5">{t.solution}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- BENEFÍCIOS · duas colunas de verbete (6+6) ------------ */}
      <section className="sec border-t border-rule">
        <div className="ed">
          <div className="ed-grid">
            <div className="c6 reveal">
              <h2 className="d3">{t.benefitsTitle}</h2>
              <p className="t2 measure-lede mt-4 text-text-muted">{t.benefitsSub}</p>
            </div>
          </div>
          <dl className="mt-12 grid gap-x-12 border-t border-edge md:grid-cols-2">
            {t.benefits.map((f, i) => (
              <div key={f.t} className="reveal flex items-baseline gap-4 border-b border-rule py-5">
                <span className="idx t5 w-6 shrink-0">{nn(i)}</span>
                <div className="min-w-0">
                  <dt className="t2 font-medium">{f.t}</dt>
                  <dd className="t3 measure-prose mt-1 text-text-muted">{f.d}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- UM MÊS · split doc (8+4) ------------------------------ */}
      {t.timeline && (
        <section className="sec border-t border-rule" data-testid="landing-timeline">
          <div className="ed">
            <div className="ed-grid">
              <div className="c8">
                <h2 className="d3 reveal">{t.timeline.title}</h2>
                <ol className="mt-10 border-t border-edge">
                  {t.timeline.steps.map((step, i) => (
                    <li
                      key={step.when}
                      className="reveal grid grid-cols-[1fr] items-baseline gap-1 border-b border-rule py-4 sm:grid-cols-[7.5rem_1fr] sm:gap-4"
                      style={{ transitionDelay: `${i * 50}ms` }}
                    >
                      <span className="t6 text-text-muted">{step.when}</span>
                      <span className="t2 measure-prose">{step.t}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <aside className="c4 reveal">
                <p className="t3 measure-lede text-text-muted md:border-l md:border-rule md:pl-6">
                  {t.timeline.sub}
                </p>
              </aside>
            </div>
          </div>
        </section>
      )}

      {/* ---------- COMO FUNCIONA · três linhas de largura total ---------- */}
      <section className="sec border-t border-rule">
        <div className="ed">
          <h2 className="d3 reveal">{t.howTitle}</h2>
          <div className="mt-10 border-t border-edge">
            {t.how.map((step, i) => (
              <div key={step.t} className="ed-grid reveal border-b border-rule py-7">
                <div className="c2">
                  <span className="idx" style={{ fontSize: 40, lineHeight: "40px" }}>
                    {nn(i)}
                  </span>
                </div>
                <h3 className="c4 d4">{step.t}</h3>
                <p className="c6 t2 measure-prose text-text-muted">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- COMPARAÇÃO · tabela sem cartão, sem zebra ------------- */}
      {t.compare && (
        <section className="sec border-t border-rule" data-testid="landing-compare">
          <div className="ed">
            <div className="reveal">
              <h2 className="d3">{t.compare.title}</h2>
              {/* M9: a 390 a coluna "Com a Marqa" ficava fora da tela sem
                  nenhum sinal de que havia mais. `.scroll-x` põe a sombra do
                  lado em que ainda há conteúdo. */}
              <div className="scroll-x mt-10">
                <table className="w-full min-w-[34rem] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[39%]" />
                    <col className="w-[39%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-edge">
                      {t.compare.head.map((h) => (
                        <th key={h} className="t5 pb-3 pr-4 text-text-muted">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.compare.rows.map(([task, today, marqa]) => (
                      <tr key={task} className="border-b border-rule align-baseline">
                        <td className="t4 py-4 pr-4 font-medium">{task}</td>
                        <td className="t4 py-4 pr-4 text-text-muted line-through decoration-rule">
                          {today}
                        </td>
                        <td className="t4 py-4 pr-4">{marqa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- PÚBLICOS · split lead (6+6), lista com régua ---------- */}
      {config.showAudienceCards && t.audiences && (
        <section id="publicos" className="sec border-t border-rule">
          <div className="ed">
            <div className="ed-grid">
              <div className="c5 reveal">
                <h2 className="d3">{t.audienceTitle}</h2>
              </div>
              <div className="c7 reveal border-t border-edge">
                {t.audiences.map((w, i) => (
                  <Link
                    key={w.t}
                    href={w.href}
                    className="group flex items-baseline gap-4 border-b border-rule py-6 transition-colors duration-[var(--dur-1)] hover:bg-surface"
                  >
                    <span className="idx t5 w-6 shrink-0">{nn(i)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="d4 block">{w.t}</span>
                      <span className="t3 measure-prose mt-1 block text-text-muted">{w.d}</span>
                      <span className="t5 mt-3 inline-flex items-center gap-1.5 font-medium underline-offset-4 group-hover:underline">
                        {w.cta}
                        <Icon name="arrow-right" size={16} />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- PLANOS ------------------------------------------------ */}
      {config.pricingType && (
        <Pricing accountType={config.pricingType} lang={lang} cardSubscription={cardSubscription} />
      )}

      {/* ---------- PERGUNTAS · coluna de prosa (6, deslocada) ------------ */}
      <section className="sec border-t border-rule">
        <div className="ed">
          <div className="ed-grid">
            <div className="c4 reveal">
              <h2 className="d3">{t.faqTitle}</h2>
            </div>
            <div className="c7 c-start6 reveal border-b border-rule">
              {t.faq.map((f, i) => (
                <FaqItem key={f.q} q={f.q} a={f.a} n={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FECHAMENTO · split lead-rev, régua da marca ----------- */}
      <section className="sec border-t border-edge">
        <div className="ed">
          <div className="ed-grid">
            <div className="c7 reveal">
              <Eyebrow>{t.finalEyebrow}</Eyebrow>
              <h2 className="d2 mt-4" style={SOFT_12}>
                {t.finalTitle}
              </h2>
              <p className="t1 measure-lede mt-5 text-text-muted">{t.finalSub}</p>
            </div>
            <div className="c4 c-start9 reveal flex flex-col gap-3 md:pt-10">
              <Link
                href={signupHref}
                data-track="cta_click"
                data-track-label="final"
                className={buttonClass("primary", "lg")}
              >
                {t.ctaFinal}
              </Link>
              <Link href="/login" className={buttonClass("secondary", "lg")}>
                {lang === "pt" ? "Entrar" : "Sign in"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- RODAPÉ DA PEÇA · marca, índice, idioma --------------- */}
      <footer className="border-t border-rule py-10">
        <div className="ed flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <MarqaWordmark size={26} />
          <nav className="grid gap-x-10 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
            {[
              [lang === "pt" ? "Agências" : "Agencies", "/para-agencias"],
              [lang === "pt" ? "Marcas" : "Brands", "/para-marcas"],
              [lang === "pt" ? "Profissionais" : "Professionals", "/para-profissionais"],
              [lang === "pt" ? "Entrar" : "Sign in", "/login"],
              [lang === "pt" ? "Termos" : "Terms", lang === "pt" ? "/termos" : "/terms"],
              [lang === "pt" ? "Privacidade" : "Privacy", lang === "pt" ? "/privacidade" : "/privacy"],
              [lang === "pt" ? "Reembolso" : "Refunds", lang === "pt" ? "/reembolso" : "/refunds"],
              [lang === "pt" ? "Contato" : "Contact", lang === "pt" ? "/contato" : "/contact"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="t4 py-1 text-text-muted underline-offset-4 hover:text-text hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-baseline gap-4">
            {(["pt", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                aria-pressed={lang === l}
                className={`t6 underline-offset-4 ${
                  lang === l ? "text-text underline" : "text-text-muted hover:text-text"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
