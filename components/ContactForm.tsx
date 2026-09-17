"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, ErrorBox, Input, Label, Select, Textarea } from "./ui";

export type ContactKind = "contact" | "access_request";

const TOPICS: { value: string; label: string }[] = [
  { value: "duvida", label: "Dúvida sobre o produto" },
  { value: "pagamento", label: "Pagamento, plano ou reembolso" },
  { value: "acesso", label: "Não consigo entrar" },
  { value: "privacidade", label: "Privacidade e meus dados (LGPD)" },
  { value: "parceria", label: "Parceria" },
  { value: "outro", label: "Outro assunto" },
];

// Formulário de contato (e, com kind="access_request", pedido de acesso de
// agência). A mensagem fica guardada e o admin responde por e-mail.
export default function ContactForm({
  kind = "contact",
  initialTopic = "duvida",
  defaultEmail = "",
}: {
  kind?: ContactKind;
  initialTopic?: string;
  defaultEmail?: string;
}) {
  const [form, setForm] = useState({
    name: "",
    email: defaultEmail,
    topic: TOPICS.some((t) => t.value === initialTopic) ? initialTopic : "duvida",
    message: "",
    company: "",
    website: "",
    fax: "",
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const access = kind === "access_request";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/contact", { method: "POST", body: JSON.stringify({ kind, ...form }) });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar agora.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm" data-testid="contact-sent">
        <p className="font-semibold text-foreground">{access ? "Pedido recebido." : "Mensagem recebida."}</p>
        <p className="mt-1 text-muted">
          {access
            ? "Vamos avaliar e responder no e-mail informado com o convite de acesso."
            : "Respondemos no e-mail informado, normalmente em até 2 dias úteis."}
        </p>
      </div>
    );
  }

  const id = (name: string) => `${kind}-${name}`;
  return (
    <form className="space-y-3" onSubmit={submit} aria-label={access ? "Pedir acesso" : "Fale com a gente"}>
      {access && (
        <p className="text-sm text-muted">
          O cadastro de agências está por convite enquanto preparamos os espaços separados por agência. Conte sobre a sua e
          liberamos o acesso.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={id("name")}>Seu nome</Label>
          <Input id={id("name")} autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={id("email")}>E-mail para resposta</Label>
          <Input id={id("email")} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      {access ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={id("company")}>Nome da agência</Label>
            <Input id={id("company")} autoComplete="organization" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={id("website")}>Site ou Instagram</Label>
            <Input id={id("website")} autoComplete="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor={id("topic")}>Assunto</Label>
          <Select id={id("topic")} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor={id("message")}>{access ? "Quantos clientes você atende e o que quer resolver?" : "Mensagem"}</Label>
        <Textarea id={id("message")} required minLength={10} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={id("fax")}>Fax</label>
        <input id={id("fax")} tabIndex={-1} autoComplete="off" value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} />
      </div>
      <p className="text-xs text-muted">
        Usamos estes dados só para responder você (veja a <a href="/privacidade" className="text-accent hover:underline">Política de Privacidade</a>).
      </p>
      {error && <ErrorBox message={error} />}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto" data-testid="contact-submit">
        {busy ? "Enviando..." : access ? "Pedir acesso" : "Enviar mensagem"}
      </Button>
    </form>
  );
}
