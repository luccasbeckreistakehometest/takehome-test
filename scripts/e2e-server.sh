#!/bin/sh
# Servidor do e2e: build de PRODUÇÃO + next start (menos memória que o next dev
# e mais fiel ao que roda no VPS). IA mockada, banco descartável em data/e2e.
# E2E_SKIP_BUILD=1 reaproveita o build anterior.
set -e
cd "$(dirname "$0")/.."
export NODE_OPTIONS="--max-old-space-size=3072"
# Hermético: o next também lê .env/.env.local do projeto, mas variáveis já
# definidas no processo (mesmo vazias) têm prioridade. Nenhuma chave real entra.
export ANTHROPIC_API_KEY="" MP_ACCESS_TOKEN="" MP_PUBLIC_KEY="" ELEVENLABS_API_KEY="" OPENAI_API_KEY=""
export GOOGLE_AI_API_KEY="" TOGETHER_API_KEY="" HF_API_KEY="" SALES_WEBHOOK_SECRET="" SUPPORT_EMAIL="" SUPPORT_WHATSAPP=""
export LEGAL_ADDRESS="" AGENCY_SELF_SIGNUP=""
# identidade FICTÍCIA só para o e2e: em produção o cadastro de agência só
# abre com o controlador identificado (lib/legal.ts)
export LEGAL_NAME="Operadora de Teste E2E" LEGAL_DOCUMENT="documento-de-teste" LEGAL_EMAIL="legal@example.test"
export AUTH_SECRET="e2e-only-auth-secret-not-for-production-0123456789"
export APP_URL="http://localhost:3200"
if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  BUILD_DATA="$(mktemp -d)"
  DATA_DIR="$BUILD_DATA" npx next build
  rm -rf "$BUILD_DATA"
fi
rm -rf "$PWD/data/e2e"
export AI_MOCK=1
export DATA_DIR="$PWD/data/e2e"
export SEED_PASSWORD="e2e-pass"
export BILLING_ENFORCED=false
export META_APP_SECRET="e2e-meta-app-secret"
export META_VERIFY_TOKEN="e2e-verify-token-0123"
# o e2e não fala com a Meta: a checagem de posse do id fica nos testes unitários
export META_GRAPH_VERIFY=off
# assinatura no cartão: transporte falso do Mercado Pago (requisições em
# data/e2e/mp-outbox.json, respostas lidas de data/e2e/mp-fake.json)
export MP_TRANSPORT=file
# links/analytics: o navegador headless e o cliente do Playwright contam como visita
export TRACKING_TEST_MODE=1
export LOGIN_RATE_LIMIT_PER_IP=10000
export REGISTER_RATE_LIMIT_PER_HOUR=30
export AI_RATE_LIMIT_PER_10MIN=10000
export AI_RATE_LIMIT_PER_IP_10MIN=10000
export AI_DAILY_SPEND_LIMIT_USD=1000
# as specs de aprovação/atendente enfileiram no modo sessão (sem worker rodando)
export MESSAGING_SESSION_MODE=true
exec npx next start -p 3200
