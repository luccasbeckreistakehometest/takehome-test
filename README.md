# AgencyHub — Central de Marketing com IA

Webapp para agências de marketing centralizarem tudo de cada cliente em um único
lugar: a equipe preenche o briefing **uma vez** e a plataforma gera, com IA
(Claude), entregáveis prontos para apresentar — sempre fundamentados no briefing
e na estratégia vigente da conta.

## O que a plataforma gera

| Entregável | O que traz |
|---|---|
| **Estratégia & Deep Dive** | Pesquisa **real na web**: tendências atuais do segmento (com fontes), personas de target buyers, análise de concorrentes, apostas priorizadas ("best fits") e metas SMART |
| **Radar de mercado** | Pulso recorrente: o que mudou nos últimos dias no mercado do cliente e quais ajustes fazer na estratégia, com urgência — rode diariamente para ficar ahead of the game |
| **Plano de campanha** | Tema criativo, objetivos com KPIs, cronograma semana a semana, estratégia por canal e distribuição de verba |
| **ROI & Roadmap** | Premissas explícitas, investimento detalhado, métricas **antes → depois**, ROI/payback e roadmap por fases |
| **Calendário social** | Posts do mês com legenda pronta, hashtags, direção de arte e CTA |
| **Posts** | Variações de post sobre um tema, cada uma com um ângulo criativo |
| **Identidade visual** | Essência, slogans, **conceitos de logo em SVG**, paleta hex, tipografia e tom de voz |
| **Landing pages** | HTML único responsivo (mobile-first, formulário, SEO) com preview e download |

Recursos transversais:

- **Kit completo (one-shot):** um clique gera estratégia → campanha → ROI →
  identidade → social → landing page em sequência, cada etapa aproveitando a
  anterior.
- **Estratégia viva:** todos os entregáveis recebem a análise estratégica mais
  recente como contexto; rode o Radar/Estratégia de novo e as próximas gerações
  se adaptam às mudanças do mercado.
- **Refinamento humano:** toda aba aceita instruções da equipe e pode refinar a
  partir de uma versão anterior em vez de recomeçar do zero.
- **Multilíngue:** cada cliente tem idioma de entregáveis (Português BR ou
  English US).

## Rodando

```bash
cp .env.example .env.local   # e preencha ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

A chave da API é obtida em <https://platform.claude.com>. Os dados ficam em um
SQLite local (`data/agencyhub.db`, fora do git).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- SQLite via better-sqlite3 (zero configuração)
- Claude API (`claude-opus-4-8`) com structured outputs (JSON garantido por
  schema), adaptive thinking, streaming e **web search** server-side para as
  análises de mercado

## Estrutura

```
app/                # páginas + rotas de API (App Router)
  api/clients       # CRUD de clientes
  api/generate      # endpoint central de geração com IA
  api/generations   # histórico + HTML das landing pages
components/         # UI (workspace, abas de geração, renderizadores)
lib/                # db, cliente da Claude, prompts, schemas, validação
data/               # SQLite local (gitignored)
```

## Próximos passos naturais

- Agendar o Radar de mercado diariamente (cron chamando `POST /api/generate`)
- Autenticação multiusuário e permissões por conta
- Publicação das landing pages em domínio próprio
- Exportar entregáveis em PDF/slides para apresentação
