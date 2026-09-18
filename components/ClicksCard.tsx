"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

type LinkRow = { code: string; label: string; destUrl: string; clicks30: number; uniques30: number };

// Dashboard: cliques dos links rastreáveis nos últimos 30 dias.
export default function ClicksCard({ clientId, onOpen }: { clientId: string; onOpen: () => void }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/clients/${clientId}/links`)
      .then((r) => (r.ok ? r.json() : { links: [] }))
      .then((j: { links: LinkRow[] }) => setLinks(j.links))
      .catch(() => setLinks([]));
  }, [clientId]);
  if (!links) return null;
  const total = links.reduce((sum, l) => sum + l.clicks30, 0);
  const top = [...links].sort((a, b) => b.clicks30 - a.clicks30).slice(0, 3).filter((l) => l.clicks30 > 0);
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 shadow-sm" data-testid="clicks-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <Icon name="link" size={16} className="text-text" /> Cliques (30 dias)
        </p>
        <button type="button" onClick={onOpen} className="t3 text-text hover:underline">
          {links.length ? "Links e bio" : "Criar link rastreável"}
        </button>
      </div>
      {links.length === 0 ? (
        <p className="t3 measure-lede mt-2 text-text-muted">Crie links com UTM automático e uma página de link na bio. Os cliques entram no relatório e no &quot;o que funciona&quot;.</p>
      ) : (
        <>
          <p className="d3 mt-1 text-text" data-testid="clicks-total">{total}</p>
          <ul className="mt-1 space-y-0.5 t5 text-text-muted">
            {top.map((l) => (
              <li key={l.code}>{`${l.label || l.destUrl}: ${l.clicks30}`}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
