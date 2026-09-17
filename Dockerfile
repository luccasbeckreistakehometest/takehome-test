# Marqa — imagem de produção (Next.js 16 + better-sqlite3).
# Build multi-stage: compila as dependências nativas (better-sqlite3) no Linux
# e roda com `next start`. Os dados (SQLite + uploads) ficam em /app/data, que
# DEVE ser um volume persistente.

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Toolchain para compilar better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
# Não baixar navegadores do Playwright na instalação (WhatsApp por sessão
# precisa de Chrome no servidor; na v1 use a API oficial).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ----
FROM base AS builder
# AUTH_SECRET precisa existir no build: o middleware (edge) o inlina, e o
# next.config recusa um build de produção sem ele (mínimo 32 caracteres).
# Passado pelo docker-compose a partir do .env — o MESMO valor do runtime.
ARG AUTH_SECRET
ENV AUTH_SECRET=${AUTH_SECRET}
# NEXT_PUBLIC_* seriam inlinadas aqui; hoje nenhuma é necessária (a URL
# pública vem de APP_URL em runtime).
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
# Só o script de manutenção de senhas (o worker de WhatsApp por sessão NÃO
# entra: sem ele, a produção usa apenas a API oficial da Meta).
COPY --from=builder /app/scripts/rotate-weak-passwords.mjs ./scripts/rotate-weak-passwords.mjs
# Diretório de dados (montar volume persistente aqui)
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000
# Saúde: /api/health responde 200 quando o SQLite responde.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
