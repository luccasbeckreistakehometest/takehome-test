# AgencyHub — Plataforma de Marketing com IA

Plataforma **whitelabel** que conecta as três pontas do marketing — **cliente ↔
agência ↔ profissionais terceirizados** — com IA (Claude) orquestrando do
briefing ao pagamento: estratégia com pesquisa real, produção de entregáveis,
match de freelas, revisão visual com nota de qualidade, escrow e relatórios
automatizados.

## Módulo 1 — Central de entregáveis por IA (por cliente)

| Entregável | O que traz |
|---|---|
| **Estratégia & Deep Dive** | Pesquisa **real na web**: tendências com fontes, personas de target buyers, concorrentes, "best fits" priorizados e metas SMART |
| **Radar de mercado** | Pulso recorrente do que mudou nos últimos dias no mercado do cliente + ajustes recomendados com urgência |
| **Plano de campanha** | Tema, objetivos/KPIs, semana a semana, canais e verba |
| **ROI & Roadmap** | Premissas, investimento, métricas **antes → depois**, ROI/payback, roadmap por fases |
| **Calendário social & Posts** | Legendas prontas, hashtags, direção de arte, CTA |
| **Identidade visual** | Essência, slogans, **logos em SVG**, paleta, tipografia, tom de voz |
| **Landing pages** | HTML único responsivo com preview, download e portal |
| **Relatório executivo** | Automatizado com os **dados reais da conta** (gerações, demandas, notas, reuniões), na visão certa: agência, cliente ou profissional |

Transversais: **✦ Kit completo** (one-shot: uma informação → tudo gerado em
sequência), **estratégia viva** (todo entregável recebe a análise mais recente
como contexto), **refinamento humano** (feedback + evoluir versão anterior) e
**multilíngue** (PT-BR/EN por cliente).

## Módulo 2 — Marketplace & operações

- **Profissionais** (fotógrafos/designers): cadastro com localização, skills,
  especialidades, foco de mercado e portfolio.
- **Match por IA**: rankeia quem tem mais propensão a entregar resultado para
  *aquele* cliente — skills, localização, estética, verba e **track record real**
  (nota média das entregas + demandas concluídas).
- **Demandas** com pipeline: brief → match → **escrow** (pagamento reservado) →
  produção → revisão → aprovação → **pagamento liberado**.
- **Revisão visual**: clique em qualquer ponto da imagem para marcar ajustes
  (pins numerados, resolver/reabrir).
- **Análise de arte por IA**: nota **0-100** por critérios profissionais +
  fit dentro da campanha/contexto + notas de revisão acionáveis.
- **Ranking elo** (sem XP): Bronze → Prata → Ouro → **Platina**, calculado de
  dados reais, para profissionais e empresas.
- **Chat por demanda**, **reuniões agendadas** (com link Meet/Zoom) e arquivos
  **baixáveis por todos os integrantes do contrato**.

## Módulo 3 — Crescimento

- **Prospecção**: a IA pesquisa na web negócios reais do nicho/região,
  qualifica cada lead (fit, maturidade, abordagem) e converte em cliente com um
  clique — mesmo quem não está na plataforma.
- **Auto-cadastro** de clientes via link compartilhável (`/cadastro`).
- **Motor de ideias**: propostas proativas para agência, clientes e
  profissionais, fundadas nas trends mais recentes e conectadas a quem já está
  na plataforma.
- **Portais por papel** (`/portal`): agência (app completo), cliente
  (acompanhamento read-only + downloads) e profissional (demandas,
  oportunidades, elo).
- **Whitelabel**: nome, tagline e cor da agência em Configurações.
- **Convites** para externos e página de **Treinamento** por papel.

## Rodando

```bash
cp .env.example .env.local   # e preencha ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Chave da API em <https://platform.claude.com>. Dados em SQLite local
(`data/agencyhub.db`, fora do git; uploads em `data/uploads/`).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- SQLite via better-sqlite3 (zero configuração, com migrações leves)
- Claude API (`claude-opus-4-8`): structured outputs (JSON garantido por
  schema), adaptive thinking, streaming, **web search** server-side (estratégia,
  radar, prospecção, ideias) e **vision** (análise de arte 0-100)

## Estrutura

```
app/                # páginas + 25 rotas de API (App Router)
components/         # workspace, abas de geração, demandas, revisão visual
lib/                # db, cliente Claude, prompts, schemas, ranking, uploads
data/               # SQLite + uploads (gitignored)
```

## Próxima fase (roadmap)

- **Autenticação real** (senha/SSO) por papel — hoje os portais são separados
  por papel sem senha, para validar o fluxo
- **Pagamentos reais** (Stripe/Mercado Pago) por trás do fluxo de escrow
- **Integrações OAuth** (Meta Ads, Google Ads/GA4, TikTok, Canva, Figma,
  Calendar/Meet, CRMs) — o hub e o catálogo já existem em Configurações
- **Agendamentos executáveis** (job runner/cron): radar de mercado diário,
  lembretes de prazo de entrega e auto-publicação do calendário social nas
  redes (via integrações)
- Exportação de relatórios em PDF/slides e notificações (e-mail/WhatsApp)
```
