# Marqa em produção

A Marqa roda no VPS Hostinger junto com Betmatic e ResumeTailor, orquestrada pelo repositório
**`stack`** (privado): um `docker-compose.yml` com os três apps, o Caddy (HTTPS automático e
cabeçalhos de segurança) e os scripts de operação. Este repositório só fornece a imagem do app.

| O quê | Onde |
|---|---|
| Código do app (este repo) | `/srv/apps/takehome-test` (clone de `main`) |
| `.env` do app | `/srv/apps/takehome-test/.env` (permissão 600) |
| Stack (compose, Caddyfile, scripts) | `/srv/apps/stack` |
| Dados (SQLite, uploads, cache de voz) | `/srv/apps/stack/volumes/marqa/data` → `/app/data` no container |
| Serviço no compose | `marqa` |
| Domínio | `https://marqa.online` (o `www` redireciona) |

> Precisa de VPS (Node contínuo + disco): SQLite, uploads, scheduler interno. Não roda em hospedagem
> compartilhada nem em serverless.

## Operação

Tudo a partir de `/srv/apps/stack` (detalhes no `DEPLOY.md` do stack):

- **Instalar do zero**: `bin/setup.sh` (cria pastas, `.env` a partir do exemplo, sobe o compose).
- **Atualizar**: `bin/update.sh` (puxa `main` de cada app, reconstrói e recria só o que mudou).
- **Backup**: `bin/backup.sh`, todo dia às 04:00 (UTC) pelo cron do stack (`/etc/cron.d/stack-backup`).
- **Logs**: `docker compose logs -f marqa`.
- **Reler o `.env`**: `docker compose up -d marqa` (um `restart` NÃO relê o `env_file`).
- **Saúde**: `curl -s https://marqa.online/api/health` → `{"ok":true,"db":"ok"}` (também usado pelo
  `HEALTHCHECK` da imagem).

## Variáveis de ambiente

Gere segredos **no servidor** (`openssl rand -hex 32`), nunca no repositório.

### Obrigatórias

| Variável | Valor |
|---|---|
| `AUTH_SECRET` | aleatório, ≥ 32 caracteres. Também é *build arg* (o middleware o inlina): build e runtime usam o mesmo valor. Sem ele o build de produção falha e nenhum login funciona. Trocar derruba todas as sessões. |
| `APP_URL` | `https://marqa.online` — links, canonical, sitemap e retorno/webhook do Mercado Pago. |
| `SEED_PASSWORD` | senha forte das contas seed `admin` e `agencia` (só usada se elas ainda não existirem). |
| `ANTHROPIC_API_KEY` | chave do console da Anthropic com crédito. Uma chave salva em Configurações (admin) tem prioridade sobre esta. |
| `MP_ACCESS_TOKEN` | token de produção do Mercado Pago (`APP_USR-...`). |
| `BILLING_ENFORCED` | `true` para bloquear IA sem saldo. Antes de ligar, dê um plano à agência da casa em **/admin → Usuários**. |

### Custos e limites (têm padrão; ajuste se precisar)

| Variável | Padrão | Efeito |
|---|---|---|
| `AI_DAILY_SPEND_LIMIT_USD` | `20` | teto diário de gasto de IA (estimado pelos tokens). Atingiu → IA pausa até o dia seguinte (UTC). `0` desliga a IA. |
| `AI_RATE_LIMIT_PER_10MIN` / `AI_RATE_LIMIT_PER_IP_10MIN` | `40` / `80` | pedidos de IA por conta / por IP. |
| `TTS_RATE_LIMIT_PER_10MIN` / `TTS_RATE_LIMIT_PER_IP_10MIN` | `30` / `60` | voz por conta / por IP. |
| `LOGIN_RATE_LIMIT_PER_IP` / `LOGIN_RATE_LIMIT_PER_ACCOUNT` | `30` / `8` (15 min) | tentativas de login. |
| `REGISTER_RATE_LIMIT_PER_HOUR`, `CONTACT_RATE_LIMIT_PER_HOUR`, `LEAD_RATE_LIMIT_PER_HOUR` | `5` | cadastro, contato e lead da página pública por IP. |
| `TTS_USD_PER_1K_CHARS`, `IMAGE_USD_PER_IMAGE`, `CONCEPT_USD_PER_IMAGE` | estimativas | custo usado no teto diário para voz e imagem. |
| `TTS_CACHE_MAX_FILES` | `2000` | arquivos de voz em cache. |

### Cadastro, identidade legal e suporte

| Variável | Uso |
|---|---|
| `AGENCY_SELF_SIGNUP` | `true` libera o cadastro público de agências. Padrão: desligado (agências pedem acesso pelo formulário). |
| `LEGAL_NAME`, `LEGAL_DOCUMENT`, `LEGAL_ADDRESS`, `LEGAL_EMAIL` | razão social, CNPJ/CPF, endereço e e-mail nas páginas legais e no rodapé. Vazios → as linhas somem e as páginas apontam para o formulário de contato. |
| `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP` | canais extras na página de contato (só aparecem se definidos; WhatsApp com DDI, só dígitos). |

### Integrações opcionais

| Variável | Uso |
|---|---|
| `META_APP_SECRET` | App Secret do app da Meta. Sem ele, o webhook `/api/webhooks/meta` recusa todo POST. |
| `META_VERIFY_TOKEN` | token do handshake do webhook (aleatório, ≥ 16 caracteres; o antigo valor público não vale mais). |
| `SALES_WEBHOOK_SECRET` | token global opcional (≥ 16) para `/api/webhooks/sales/<clienteId>`. O normal é o token por cliente, gerado na aba **Vendas & Dados**. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` / `OPENAI_API_KEY` | voz da IA no briefing falado. Sem nenhum, a interface mostra só o texto. |
| `GOOGLE_AI_API_KEY`, `TOGETHER_API_KEY`, `HF_API_KEY` | imagens (também configuráveis pelo admin). |
| `MESSAGING_SESSION_MODE` | `true` só num servidor preparado com Chrome + worker; a imagem padrão usa apenas a API oficial. |

## Mercado Pago

- Checkout Pro com `notification_url = ${APP_URL}/api/webhooks/mercadopago` em cada preferência.
  Cadastre a mesma URL em **Suas integrações → Webhooks** (evento *Pagamentos*).
- O webhook relê o pagamento na API do MP; aprovado → credita/ativa numa transação; estorno ou
  chargeback → desfaz; falha na consulta → responde 502 e o MP tenta de novo.
- Planos são **pré-pagos por período, sem renovação automática**. No vencimento a conta volta ao
  plano grátis; a cota mensal de coins é recarregada a cada mês do período.
- **Reprocessar**: **/admin → Pagamentos** relê um pagamento pelo número (idempotente).
- Teste ponta a ponta com uma compra real de valor baixo depois de configurar o token.

## Senhas antigas conhecidas

`scripts/rotate-weak-passwords.mjs` (vai na imagem) troca a senha de toda conta que não seja `admin`
nem `agencia` e ainda use `SEED_PASSWORD` ou uma senha passada em `LEGACY_PASSWORDS` (uma por linha,
informada só no ambiente, nunca em arquivo versionado):

```bash
cd /srv/apps/stack
docker compose exec -T -e LEGACY_PASSWORDS='...' marqa node scripts/rotate-weak-passwords.mjs          # conta
docker compose exec -T -e LEGACY_PASSWORDS='...' marqa node scripts/rotate-weak-passwords.mjs \
  --apply --out /app/data/.rotated-passwords.txt
install -m 600 /dev/null /root/marqa-rotated-passwords.txt
docker compose cp marqa:/app/data/.rotated-passwords.txt /root/marqa-rotated-passwords.txt
chmod 600 /root/marqa-rotated-passwords.txt
docker compose exec -T marqa rm /app/data/.rotated-passwords.txt
```

As contas trocadas entram com a senha provisória e precisam criar uma nova no primeiro acesso.

## Primeiro acesso

1. Entre como `admin` (senha = `SEED_PASSWORD`) e troque a senha em **Minha conta**.
2. **/admin → Usuários**: dê à agência da casa o plano que ela deve ter (sem cobrança).
3. **Configurações** (admin): modo de IA, landing pages e chaves.
4. Só então ligue `BILLING_ENFORCED=true` e rode `docker compose up -d marqa`.

## Build local

```bash
AUTH_SECRET=$(openssl rand -hex 32) DATA_DIR=$(mktemp -d) npx next build
```

Nunca rode `next build` com o `next dev` do mesmo repositório ligado (corrompe `.next`).
