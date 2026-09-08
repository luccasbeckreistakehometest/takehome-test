# AgencyHub — imagem de produção (Next.js 16 + better-sqlite3).
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
# AUTH_SECRET precisa existir no build (o middleware/edge pode inliná-lo).
# Passado pelo docker-compose a partir do .env — o MESMO valor do runtime.
ARG AUTH_SECRET
ENV AUTH_SECRET=${AUTH_SECRET}
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
# Diretório de dados (montar volume persistente aqui)
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["npm", "start"]
