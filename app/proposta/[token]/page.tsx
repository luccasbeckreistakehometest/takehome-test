"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtCurrency, useUiLang } from "@/lib/i18n";
import type { ProposalContent, ProposalState } from "@/lib/proposal-rules";
import { Button, ErrorBox, Input, Label, Spinner } from "@/components/ui";
import { buttonClass } from "@/lib/button-class";
import { brandStyle } from "@/lib/brand-ramp";

/** SOFT do Fraunces na capa de peça pública (§3.1). */
const SOFT_20 = { "--soft": 20 } as React.CSSProperties;

type Payload = {
  state: ProposalState;
  proposal: {
    prospectName: string;
    lang: "pt-BR" | "en";
    currency: string;
    content: ProposalContent;
    expiresAt: string;
    validity: string;
    acceptedPackage: string;
    createdAt: string;
  };
  agency: { name: string; tagline: string; accentColor: string; hasLogo: boolean; logoUrl: string };
};

type Accepted = { clientId: string; login: { username: string; password: string } | null; portalUrl: string };

// Proposta comercial pública: abre pelo token, sem login. O prospect escolhe
// o pacote e aceita — vira cliente na hora, com acesso ao portal.
export default function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const lang = useUiLang();
  const [data, setData] = useState<Payload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState<Accepted | null>(null);

  useEffect(() => {
    api<Payload>(`/api/proposals/${token}`)
      .then((p) => {
        setData(p);
        // registra a primeira abertura (o GET não grava nada)
        if (p.state === "open") fetch(`/api/proposals/${token}`, { method: "POST" }).catch(() => {});
        const recommended = p.proposal.content.packages.find((x) => x.recommended) ?? p.proposal.content.packages[0];
        if (recommended) setSelected(recommended.name);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  async function accept() {
    if (!selected) return;
    setAccepting(true);
    setError("");
    try {
      const result = await api<Accepted>(`/api/proposals/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({ packageName: selected, name, contact }),
      });
      setAccepted(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "expired" ? "Esta proposta expirou." : msg === "accepted" ? "Esta proposta já foi aceita." : msg || "Erro ao aceitar");
    } finally {
      setAccepting(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="d3">Proposta não encontrada</h1>
        <p className="t3 mt-3 text-text-muted">O link pode estar errado ou a proposta foi removida.</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner label="Abrindo a proposta..." />
      </div>
    );
  }
  const { proposal, agency } = data;
  const c = proposal.content;
  const money = (v: number) => fmtCurrency(v, proposal.currency, lang);

  return (
    // A proposta é uma PEÇA, não um formulário com cartões: capa, régua da
    // marca, seções numeradas e tabela de pacote na mancha de 160mm — a mesma
    // do relatório e da fatura, para as três se reconhecerem como do mesmo
    // estúdio.
    <article
      className="doc my-8 px-8 py-10 sm:px-12"
      style={brandStyle(agency.accentColor) as React.CSSProperties}
      data-testid="proposal-page"
    >
      <header className="doc-cover">
        <div className="doc-rule" />
        <div className="mt-4 flex items-center gap-3">
          {agency.hasLogo && agency.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agency.logoUrl} alt={agency.name} className="size-8 rounded-xs object-contain" />
          ) : null}
          <p className="t6 text-n-500">{agency.name}</p>
          <span className="t5 ml-auto text-n-500">{proposal.validity}</span>
        </div>
        <p className="t5 mt-8 text-n-500">Proposta para {proposal.prospectName}</p>
        <h1 className="d2 mt-2" style={SOFT_20} data-testid="proposal-headline">
          {c.headline}
        </h1>
        <p className="t1 prose-doc mt-5 whitespace-pre-line">{c.pitch}</p>
      </header>

      {data.state === "expired" && (
        <p className="t3 mt-8 border-l-2 border-caution bg-caution-wash px-4 py-3">
          Esta proposta expirou. Fale com a agência para receber uma versão atualizada.
        </p>
      )}
      {data.state === "accepted" && !accepted && (
        <p className="t3 mt-8 border-l-2 border-positive bg-positive-wash px-4 py-3">
          Esta proposta já foi aceita. Pacote escolhido: {proposal.acceptedPackage}.
        </p>
      )}

      <section className="doc-figure mt-12 border-t border-edge pt-4">
        <div className="flex items-baseline gap-3">
          <span className="idx t5 w-8 shrink-0">01</span>
          <h2 className="d4">O que a gente viu</h2>
        </div>
        <ul className="mt-3 sm:pl-11">
          {c.painPoints.map((p, i) => (
            <li key={i} className="t2 prose-doc border-b border-rule py-2">
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="doc-figure mt-10 border-t border-edge pt-4">
        <div className="flex items-baseline gap-3">
          <span className="idx t5 w-8 shrink-0">02</span>
          <h2 className="d4">O que está incluído</h2>
        </div>
        <ul className="mt-3 sm:pl-11">
          {c.scope.map((item, i) => (
            <li key={i} className="t2 prose-doc border-b border-rule py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="doc-figure mt-10 border-t border-edge pt-4">
        <div className="flex items-baseline gap-3">
          <span className="idx t5 w-8 shrink-0">03</span>
          <h2 className="d4">Escolha o pacote</h2>
        </div>
        <div className="mt-4 grid border-t border-edge sm:pl-11 md:grid-cols-3">
          {c.packages.map((pkg) => {
            const active = selected === pkg.name;
            return (
              <button
                key={pkg.name}
                type="button"
                disabled={data.state !== "open" || Boolean(accepted)}
                onClick={() => setSelected(pkg.name)}
                aria-pressed={active}
                className={`flex flex-col border-b border-rule py-4 pr-6 text-left transition-colors duration-[var(--dur-1)] disabled:cursor-default ${
                  active ? "bg-surface-sunken pl-4" : "hover:bg-surface-sunken"
                }`}
                data-testid="proposal-package"
                data-name={pkg.name}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="t5 font-medium">{pkg.name}</span>
                  {pkg.recommended && <span className="t6 text-n-500">Recomendado</span>}
                </span>
                <span className="n2 mt-3">
                  {money(pkg.price)}
                  <span className="t5 font-normal text-n-500"> / {pkg.period}</span>
                </span>
                <ul className="mt-3">
                  {pkg.items.map((item, i) => (
                    <li key={i} className="t5 border-b border-rule py-1 text-n-500">
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {c.validityNote && <p className="t5 mt-2 text-n-500 sm:pl-11">{c.validityNote}</p>}
      </section>

      <section className="doc-figure mt-10 border-t border-edge pt-4">
        <div className="flex items-baseline gap-3">
          <span className="idx t5 w-8 shrink-0">04</span>
          <h2 className="d4">Como vai acontecer</h2>
        </div>
        <div className="mt-3 sm:pl-11">
          {c.timeline.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr] gap-1 border-b border-rule py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <div>
                <p className="t3 font-medium">{t.phase}</p>
                <p className="t5 tnum text-n-500">{t.weeks}</p>
              </div>
              <ul>
                {t.deliverables.map((d, j) => (
                  <li key={j} className="t4 measure-prose text-n-500">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {accepted ? (
        <section className="doc-figure mt-10 border-t border-edge pt-4" data-testid="proposal-accepted">
          <h2 className="d4">Proposta aceita</h2>
          <p className="t2 prose-doc mt-2">
            A agência já foi avisada e vai entrar em contato para o kickoff.
          </p>
          {accepted.login ? (
            <div className="mt-4 border border-edge p-4">
              <p className="t6 text-n-500">Seu acesso ao portal do cliente</p>
              <dl className="mt-2">
                <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
                  <dt className="t5 text-n-500">Usuário</dt>
                  <dd className="t4 font-mono" data-testid="proposal-username">
                    {accepted.login.username}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5">
                  <dt className="t5 text-n-500">Senha</dt>
                  <dd className="t4 font-mono">{accepted.login.password}</dd>
                </div>
              </dl>
              <p className="t5 mt-2 text-n-500">
                Guarde estes dados — você pode trocar a senha depois de entrar.
              </p>
              <a href="/login" className={`${buttonClass("primary")} mt-4`}>
                Entrar no portal
              </a>
            </div>
          ) : (
            <a href="/login" className={`${buttonClass("primary")} mt-4`}>
              Entrar no portal
            </a>
          )}
        </section>
      ) : (
        data.state === "open" && (
          <section className="doc-figure mt-10 border-t border-edge pt-4">
            <div className="flex items-baseline gap-3">
              <span className="idx t5 w-8 shrink-0">05</span>
              <h2 className="d4">Aceitar a proposta</h2>
            </div>
            <div className="mt-3 sm:pl-11">
              <p className="t3 text-n-500">
                Pacote selecionado: <strong className="font-medium text-n-900">{selected}</strong>
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Seu nome</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como devemos te chamar"
                    data-testid="proposal-name"
                  />
                </div>
                <div>
                  <Label>WhatsApp ou e-mail</Label>
                  <Input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="(11) 99999-9999"
                    data-testid="proposal-contact"
                  />
                </div>
              </div>
              {error && (
                <div className="mt-3">
                  <ErrorBox message={error} />
                </div>
              )}
              <div className="mt-4">
                <Button
                  onClick={accept}
                  disabled={
                    accepting || !selected || name.trim().length < 2 || contact.trim().length < 5
                  }
                  data-testid="proposal-accept"
                >
                  {accepting ? "Confirmando..." : "Aceitar proposta"}
                </Button>
              </div>
              <ol className="mt-5">
                {c.nextSteps.map((s, i) => (
                  <li key={i} className="t5 flex items-baseline gap-3 border-b border-rule py-1.5 text-n-500">
                    <span className="idx w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )
      )}

      <footer className="mt-12 border-t border-edge pt-3">
        <p className="t5 text-n-500">
          {agency.name}
          {agency.tagline ? ` — ${agency.tagline}` : ""}
        </p>
      </footer>
    </article>
  );
}
