import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Cabeçalhos de segurança aplicados a todas as respostas. Em produção o Caddy
// do repo `stack` define os mesmos (com `defer`, o valor dele prevalece), então
// os valores aqui são IDÊNTICOS aos de lá — mudar um exige mudar o outro.
// O HSTS só faz sentido atrás de HTTPS; em dev ele ficaria preso no localhost.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SAMEORIGIN (e não DENY): a pré-visualização da landing gerada é um iframe
  // do próprio app. Ninguém de fora pode emoldurar as páginas.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Microfone só para o próprio site (briefing falado); câmera e localização, nunca.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

// CSP enxuta para o app. A landing gerada por IA (/api/generations/:id/html)
// tem a própria CSP com `sandbox` e fica fora desta regra.
const appCsp = { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" };

export default function config(phase: string): NextConfig {
  // O middleware inlina AUTH_SECRET no build: um build de produção sem o
  // segredo geraria um app que recusa todo login. Falha cedo e claro.
  // (Build local: AUTH_SECRET=$(openssl rand -hex 32) npx next build)
  if (phase === PHASE_PRODUCTION_BUILD && (process.env.AUTH_SECRET ?? "").length < 32) {
    throw new Error("AUTH_SECRET (mínimo 32 caracteres) é obrigatório no build de produção.");
  }
  return {
    serverExternalPackages: ["better-sqlite3"],
    poweredByHeader: false,
    // O otimizador de imagem do Next não é usado (as imagens são arquivos do
    // próprio app, servidos por rotas com checagem de acesso) e já teve falhas
    // críticas — desligado para não expor o endpoint /_next/image.
    images: { unoptimized: true },
    async headers() {
      return [
        { source: "/:path*", headers: securityHeaders },
        { source: "/((?!api/generations/[^/]+/html).*)", headers: [appCsp] },
      ];
    },
  };
}
