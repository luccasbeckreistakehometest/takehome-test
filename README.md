# Marqa — marketing com IA para agências, marcas e profissionais

Plataforma que conecta **agência ↔ marca ↔ profissionais criativos** e usa IA (Claude) do briefing à
aprovação: estratégia com pesquisa real, calendário e posts, identidade visual, demandas de produção
com match de fotógrafos e designers, aprovação do cliente, relatório mensal e atendimento no WhatsApp.
Interface em português (nativo) e inglês. Em produção em <https://marqa.online>.

## O que tem

- **Kit por cliente**: estratégia e deep dive (com busca na web), radar de mercado, plano de campanha,
  ROI e roadmap, calendário social, posts, identidade visual (SVG), ofertas, relatório executivo e
  landing pages (liga/desliga pelo admin, por custo).
- **Briefing falado**: a pessoa fala, a IA pergunta o que falta; a voz da IA vem do servidor
  (ElevenLabs ou OpenAI), nunca do sintetizador do navegador.
- **Operação da agência**: clientes, demandas com pipeline e revisão por pontos na imagem, análise de
  arte 0-100, match de profissionais pelo histórico e portfólio, calendário, campanha de 30 dias,
  aprovação que vira rascunho de post, horas e margem por cliente, pulso/NPS, "o que funciona",
  guardião da voz da marca, proposta pública com aceite, página pública da agência com captação de leads.
- **Mensageria** pela API oficial da Meta (WhatsApp Cloud e Instagram): listas, agendamento e um
  atendente que rascunha respostas (pedido de humano, preço ou promessa nunca saem sozinhos).
- **Marcas autônomas** operam o próprio workspace; **marcas gerenciadas** acompanham, aprovam e pedem
  pelo portal; **profissionais** têm perfil, portfólio, candidaturas e elo (Bronze → Platina).
- **Marca da agência** (logo, cores, nome) para os clientes e profissionais que ela convida.
- **Planos pré-pagos e coins** pelo Mercado Pago (Pix, cartão, boleto), sem renovação automática; cota
  mensal de coins; ações de IA que falham não cobram.
- **Admin**: usuários (desativar, senha provisória, plano, coins), pagamentos com reprocessamento,
  caixa de entrada, gasto de IA do dia contra o teto, uso por conta, leads, propostas e pulso.
- **Conta e LGPD**: troca de senha, sair de todos os dispositivos, baixar meus dados, excluir conta;
  termos, privacidade, reembolso e cookies em pt-BR e inglês.

O pagamento entre agência, marca e profissional dentro das demandas é só um registro de status: a
plataforma não guarda nem repassa esse dinheiro. Domínio próprio para agências ainda não existe.

## Segurança e custos

- Sessões assinadas com expiração e revogação (versão por usuário), cookie `Secure`, `AUTH_SECRET`
  obrigatório em produção, scrypt assíncrono, limites de tentativa em login, cadastro e contato.
- Middleware nega por padrão às marcas e profissionais tudo o que não é do portal deles; cada rota
  checa a posse do recurso.
- Toda rota de IA passa por limite de taxa, disjuntor de gasto diário (`AI_DAILY_SPEND_LIMIT_USD`) e
  cobrança de coins com estorno em falha.
- Webhooks autenticados (assinatura da Meta, token por cliente nas vendas; o do Mercado Pago relê o
  pagamento na API).
- HTML gerado por IA servido com CSP `sandbox`.

## Rodando localmente

```bash
cp .env.example .env.local   # preencha o que for usar (ANTHROPIC_API_KEY, SEED_PASSWORD...)
npm install
npm run dev
```

Dados em SQLite (`data/agencyhub.db`, fora do git; uploads em `data/uploads/`). Sem chave da Anthropic,
tudo funciona menos a geração por IA.

## Testes

```bash
npx tsc --noEmit
npm run test:unit                          # vitest
npm run e2e                                # Playwright (1.55.x, macOS 13), dev server na porta 3200
AUTH_SECRET=$(openssl rand -hex 32) DATA_DIR=$(mktemp -d) npx next build
```

O e2e usa `AI_MOCK=1` (respostas determinísticas no lugar da API) e um banco descartável em `data/e2e`;
os projetos `enforced` rodam com `BILLING_ENFORCED=true` e o projeto `mobile` confere que nenhuma tela
principal estoura a largura do celular.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4, better-sqlite3, Anthropic SDK (structured
outputs, adaptive thinking, streaming, web search, visão), Mercado Pago Checkout Pro.

## Deploy

Ver [docs/DEPLOY.md](docs/DEPLOY.md): produção no VPS Hostinger pelo repositório `stack` (Caddy + compose
dos três apps), variáveis de ambiente, Mercado Pago e rotação de senhas antigas.
