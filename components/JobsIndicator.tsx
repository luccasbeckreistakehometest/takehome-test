"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/lib/marketplace-db";

// Indicador global de gerações de IA: sobrevive a refresh — mostra o que está
// rodando no servidor e avisa as páginas quando termina (evento jobs:changed)
export default function JobsIndicator() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const runningIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const list = await api<Job[]>("/api/jobs");
        const nowRunning = new Set(list.filter((j) => j.status === "running").map((j) => j.id));
        // Algum job que estava rodando terminou → páginas refazem o fetch
        for (const id of runningIds.current) {
          if (!nowRunning.has(id)) {
            window.dispatchEvent(new CustomEvent("jobs:changed"));
            break;
          }
        }
        runningIds.current = nowRunning;
        setJobs(list);
      } catch {
        // servidor fora — tenta de novo no próximo tick
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const running = jobs.filter((job) => job.status === "running");
  if (running.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 w-72 space-y-1.5">
      {running.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-2 rounded-xl border border-edge bg-surface/95 p-3 text-sm shadow-2xl backdrop-blur"
        >
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-edge border-t-accent" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{job.label}</span>
            <span className="text-xs text-muted">
              gerando há{" "}
              {Math.max(1, Math.round((Date.now() - new Date(job.createdAt).getTime()) / 60000))}{" "}
              min...
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
