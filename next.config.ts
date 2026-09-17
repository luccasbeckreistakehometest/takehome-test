import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as respostas. O HSTS só faz sentido
// atrás de HTTPS (Caddy em produção); em dev ele ficaria preso no localhost.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SAMEORIGIN (e não DENY): a pré-visualização da landing gerada é um iframe
  // do próprio app. Ninguém de fora pode emoldurar as páginas.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  // Microfone só para o próprio site (briefing falado); câmera e localização, nunca.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // O otimizador de imagem do Next não é usado (as imagens são arquivos do
  // próprio app, servidos por rotas com checagem de acesso) e já teve falhas
  // críticas — desligado para não expor o endpoint /_next/image.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
