"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtCurrency, useUiLang } from "@/lib/i18n";
import type { ProposalContent, ProposalState } from "@/lib/proposal-rules";
import { Button, Card, ErrorBox, Input, Label, Spinner } from "@/components/ui";

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
  agency: { name: string; tagline: string; accentColor: string; hasLogo: boolean };
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
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Proposta não encontrada</h1>
        <p className="mt-3 text-muted">O link pode estar errado ou a proposta foi removida.</p>
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
    <div className="mx-auto max-w-3xl space-y-8 py-6" style={{ ["--accent" as string]: agency.accentColor }} data-testid="proposal-page">
      <div className="flex items-center gap-3">
        {agency.hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/settings/logo" alt={agency.name} className="size-10 rounded-md object-contain" />
        ) : (
          <span className="grid size-10 place-items-center rounded-md bg-accent font-[family-name:var(--font-display)] text-lg font-bold text-accent-ink">
            {agency.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">{agency.name}</p>
          <p className="text-xs text-muted">{agency.tagline}</p>
        </div>
        <span className="ml-auto rounded-full border border-edge px-3 py-1 text-xs text-muted">{proposal.validity}</span>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-accent">Proposta para {proposal.prospectName}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight" data-testid="proposal-headline">
          {c.headline}
        </h1>
        <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-foreground/90">{c.pitch}</p>
      </div>

      {data.state === "expired" && (
        <Card className="border-amber-500/40">
          <p className="font-medium">Esta proposta expirou.</p>
          <p className="mt-1 text-sm text-muted">Fale com a agência para receber uma versão atualizada.</p>
        </Card>
      )}
      {data.state === "accepted" && !accepted && (
        <Card className="border-emerald-500/40">
          <p className="font-medium">Esta proposta já foi aceita.</p>
          <p className="mt-1 text-sm text-muted">
            <span>Pacote escolhido:</span> {proposal.acceptedPackage}
          </p>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">O que a gente viu</p>
          <ul className="space-y-1.5 text-sm">
            {c.painPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">O que está incluído</p>
          <ul className="space-y-1.5 text-sm">
            {c.scope.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Escolha o pacote</p>
        <div className="grid gap-3 md:grid-cols-3">
          {c.packages.map((pkg) => {
            const active = selected === pkg.name;
            return (
              <button
                key={pkg.name}
                type="button"
                disabled={data.state !== "open" || Boolean(accepted)}
                onClick={() => setSelected(pkg.name)}
                className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-accent bg-accent/10" : "border-edge bg-surface hover:border-muted"} disabled:cursor-default`}
                data-testid="proposal-package"
                data-name={pkg.name}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{pkg.name}</p>
                  {pkg.recommended && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-ink">Recomendado</span>}
                </div>
                <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold">
                  {money(pkg.price)}
                  <span className="text-sm font-normal text-muted"> / {pkg.period}</span>
                </p>
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {pkg.items.map((item, i) => (
                    <li key={i}>· {item}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {c.validityNote && <p className="mt-2 text-xs text-muted">{c.validityNote}</p>}
      </div>

      <Card>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Como vai acontecer</p>
        <div className="grid gap-3 md:grid-cols-3">
          {c.timeline.map((t, i) => (
            <div key={i} className="rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <p className="font-semibold">{t.phase}</p>
              <p className="text-xs text-accent">{t.weeks}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {t.deliverables.map((d, j) => (
                  <li key={j}>· {d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {accepted ? (
        <Card className="space-y-3 border-emerald-500/40" data-testid="proposal-accepted">
          <p className="font-[family-name:var(--font-display)] text-xl font-semibold">Proposta aceita! 🎉</p>
          <p className="text-sm text-muted">A agência já foi avisada e vai entrar em contato para o kickoff.</p>
          {accepted.login ? (
            <div className="rounded-md border border-edge bg-surface-2 p-3 text-sm">
              <p className="font-medium">Seu acesso ao portal do cliente</p>
              <p className="mt-1">
                <span className="text-muted">Usuário:</span> <code data-testid="proposal-username">{accepted.login.username}</code>
              </p>
              <p>
                <span className="text-muted">Senha:</span> <code>{accepted.login.password}</code>
              </p>
              <p className="mt-2 text-xs text-muted">Guarde estes dados — você pode trocar a senha depois de entrar.</p>
              <a href="/login" className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
                Entrar no portal →
              </a>
            </div>
          ) : (
            <a href="/login" className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
              Entrar no portal →
            </a>
          )}
        </Card>
      ) : (
        data.state === "open" && (
          <Card className="space-y-3">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">Aceitar a proposta</p>
            <p className="text-sm text-muted">
              <span>Pacote selecionado:</span> <strong>{selected}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Seu nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devemos te chamar" data-testid="proposal-name" />
              </div>
              <div>
                <Label>WhatsApp ou e-mail</Label>
                <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="(11) 99999-9999" data-testid="proposal-contact" />
              </div>
            </div>
            {error && <ErrorBox message={error} />}
            <Button onClick={accept} disabled={accepting || !selected || name.trim().length < 2 || contact.trim().length < 5} data-testid="proposal-accept">
              {accepting ? "Confirmando..." : "Aceitar proposta ✓"}
            </Button>
            <ul className="space-y-0.5 text-xs text-muted">
              {c.nextSteps.map((s, i) => (
                <li key={i}>→ {s}</li>
              ))}
            </ul>
          </Card>
        )
      )}
    </div>
  );
}
