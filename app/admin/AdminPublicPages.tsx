"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, SectionTitle, Tag } from "@/components/ui";

type Bio = { clientId: string; clientName: string; slug: string; published: boolean; indexable: boolean; approved: boolean; indexed: boolean; updatedAt: string };
type Link = { code: string; destUrl: string; label: string; clientId: string; clientName: string; clicks: number; createdAt: string; archivedAt: string | null };

const when = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

// Moderação do que a plataforma publica no próprio domínio: páginas de bio
// (/b/slug) e links curtos (/l/código) de qualquer conta.
export default function AdminPublicPages() {
  const [bios, setBios] = useState<Bio[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ bios: Bio[]; links: Link[] }>("/api/admin/public")
      .then((r) => {
        setBios(r.bios);
        setLinks(r.links);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/public", { method: "POST", body: JSON.stringify(body) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="admin-public">
      {error && <ErrorBox message={error} />}
      <Card>
        <SectionTitle>Páginas de links (/b)</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          Só conta paga (ou liberada aqui) entra no Google. Tirar do ar remove a página pública na hora.
        </p>
        <ul className="space-y-2 text-sm">
          {bios.map((b) => (
            <li key={b.clientId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge px-3 py-2" data-testid="admin-bio-row" data-slug={b.slug}>
              <span className="min-w-0">
                <a href={`/b/${b.slug}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">{`/b/${b.slug}`}</a>
                <span className="ml-2 text-muted">{b.clientName}</span>
                <span className="ml-2 text-xs text-muted">{when(b.updatedAt)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Tag>{b.published ? "no ar" : "fora do ar"}</Tag>
                {b.indexable && <Tag>{b.indexed ? "no Google" : "pediu Google"}</Tag>}
                <Button variant="ghost" className="!px-2.5 !py-1 text-xs" disabled={busy} onClick={() => act({ action: b.published ? "unpublish_bio" : "publish_bio", clientId: b.clientId })} data-testid="admin-bio-toggle">
                  {b.published ? "Tirar do ar" : "Publicar"}
                </Button>
                <Button variant="ghost" className="!px-2.5 !py-1 text-xs" disabled={busy} onClick={() => act({ action: "allow_index", clientId: b.clientId, on: !b.approved })} data-testid="admin-bio-index">
                  {b.approved ? "Negar Google" : "Liberar Google"}
                </Button>
              </span>
            </li>
          ))}
          {bios.length === 0 && <li className="text-muted">Nenhuma página de links ainda.</li>}
        </ul>
      </Card>
      <Card>
        <SectionTitle>Links curtos (/l)</SectionTitle>
        <ul className="space-y-2 text-sm">
          {links.map((l) => (
            <li key={l.code} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-edge px-3 py-2" data-testid="admin-link-row" data-code={l.code}>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{`/l/${l.code}`}</span>
                <span className="ml-2 break-all text-muted">{l.destUrl}</span>
                <span className="ml-2 text-xs text-muted">{`${l.clientName} · ${l.clicks} cliques · ${when(l.createdAt)}`}</span>
              </span>
              <Button variant="ghost" className="!px-2.5 !py-1 text-xs" disabled={busy} onClick={() => act({ action: l.archivedAt ? "restore_link" : "archive_link", code: l.code })} data-testid="admin-link-toggle">
                {l.archivedAt ? "Reativar" : "Arquivar"}
              </Button>
            </li>
          ))}
          {links.length === 0 && <li className="text-muted">Nenhum link curto ainda.</li>}
        </ul>
      </Card>
    </div>
  );
}
