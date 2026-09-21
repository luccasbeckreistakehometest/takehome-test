"use client";

import type { Generation } from "@/lib/types";
import { Button } from "./ui";

export default function LandingPreview({ generation }: { generation: Generation }) {
  const htmlUrl = `/api/generations/${generation.id}/html`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href={htmlUrl} target="_blank" rel="noreferrer">
          <Button variant="ghost">Abrir em nova aba</Button>
        </a>
        <a href={`${htmlUrl}?download=1`}>
          <Button variant="ghost">Baixar HTML </Button>
        </a>
      </div>
      <div className="overflow-hidden rounded-md border border-edge bg-white">
        <iframe
          src={htmlUrl}
          sandbox="allow-scripts"
          title={generation.title}
          className="h-[70vh] w-full"
        />
      </div>
    </div>
  );
}
