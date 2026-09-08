# Subir o AgencyHub online (Hostinger VPS / qualquer VPS)

Este app precisa de um **servidor Node contínuo com disco persistente** (por causa
do SQLite, dos uploads, do agendador interno e do worker de mensagens). Por isso
**não** vai em hospedagem compartilhada nem em serverless (Vercel/Netlify). Na
Hostinger, use o produto **VPS** (não o "Hospedagem de Sites").

Tudo roda em Docker. O guia abaixo leva do zero ao ar.

---

## Pré-requisitos
- Um **VPS** (Hostinger VPS, DigitalOcean, Hetzner…), **Ubuntu 22.04/24.04**, com
  **pelo menos 2 GB de RAM** (o build do Next consome memória; 1 GB pode falhar).
- Um **domínio** (ex.: `minhamarca.com`) para ter HTTPS. Opcional — dá pra testar
  só pelo IP, mas sem HTTPS.
- A sua **chave da Anthropic** (`ANTHROPIC_API_KEY`).

---

## Passo 1 — Criar o VPS na Hostinger
1. No hPanel da Hostinger, vá em **VPS → Comprar/Configurar**. Plano mínimo
   recomendado: **KVM 1** (1 vCPU, 4 GB RAM — já basta pro build).
2. Em **Sistema operacional**, escolha o **template com Docker** (ex.: “Ubuntu
   24.04 com Docker” / “Docker” nas aplicações). Assim o Docker já vem instalado
   e você **pula o Passo 2**. (Se escolher Ubuntu puro, faça o Passo 2.)
3. Defina a senha root, finalize e anote o **IP** do servidor.

## Passo 2 — Acessar o servidor
- Jeito fácil (sem instalar nada): no hPanel do VPS, abra o **Terminal do
  navegador** (botão “Terminal” / “Browser terminal”).
- Ou por SSH do seu computador: `ssh root@SEU_IP_DO_VPS`
- Se escolheu Ubuntu puro (sem template Docker), instale o Docker agora:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```

## Passo 3 — Colocar o código no servidor
Opção A (recomendada) — via Git (repo privado seu):
```bash
git clone https://SEU-REPO.git agencyhub && cd agencyhub
```
Opção B — sem Git, enviando do seu computador:
```bash
# no SEU computador, dentro da pasta do projeto:
rsync -av --exclude node_modules --exclude .next --exclude data --exclude pitch \
  ./ root@SEU_IP_DO_VPS:/root/agencyhub/
# depois, no VPS:
cd /root/agencyhub
```

## Passo 4 — Configurar as variáveis de ambiente
```bash
cp .env.example .env
nano .env
```
Preencha (mínimo):
- `ANTHROPIC_API_KEY` — sua chave da Anthropic.
- `AUTH_SECRET` — gere uma aleatória:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  (ou `openssl rand -hex 48`).
- `SEED_PASSWORD` — senha inicial das contas **admin** e **agencia** (troque depois).
- `BILLING_ENFORCED=true` — liga o bloqueio de IA por saldo (evita estouro de custo).

## Passo 5 — Apontar o domínio e configurar HTTPS
1. No DNS do seu domínio (se for da Hostinger: hPanel → **Domínios → Zona DNS**),
   crie/edite um registro **A** com o nome `@` apontando para o **IP do VPS**.
   (Um `www` como CNAME para o domínio é opcional.)
2. Edite o `Caddyfile` e troque `seu-dominio.com` pelo seu domínio:
   ```bash
   nano Caddyfile
   ```
3. Libere as portas **80** e **443** no firewall do VPS (hPanel do VPS →
   **Firewall**; normalmente já ficam abertas).

> Sem domínio? Pule este passo e troque, no `docker-compose.yml`, a seção do Caddy
> por `ports: ["80:3000"]` no serviço `app` — você acessa por `http://SEU_IP`
> (sem HTTPS, só para testes).

## Passo 6 — Subir
```bash
docker compose up -d --build
```
A primeira vez demora alguns minutos (compila tudo). Depois:
```bash
docker compose logs -f app   # acompanhar
```

## Passo 7 — Primeiro acesso
- Abra `https://SEU-DOMINIO`.
- Entre como **admin** (senha = seu `SEED_PASSWORD`).
- **Troque as senhas** de `admin` e `agencia`, configure o whitelabel
  (logo/cor/nome) em Configurações e comece a cadastrar clientes.

---

## Operação do dia a dia
- **Atualizar** (novo código): `git pull` (ou reenviar via rsync) e
  `docker compose up -d --build`.
- **Logs**: `docker compose logs -f app`.
- **Reiniciar**: `docker compose restart app`.
- **Backup** (importante!): todos os dados ficam no volume `data`. Faça backup:
  ```bash
  docker run --rm -v agencyhub_data:/d -v $PWD:/b busybox \
    tar czf /b/backup-$(date +%F).tar.gz -C /d .
  ```

## Segurança já incluída nesta versão
- **Rotas de API exigem login** (só webhooks, login/cadastro e o logo público ficam abertos).
- **Segredo de sessão** vem de `AUTH_SECRET` (env), não do código.
- **Bloqueio de IA por saldo** liga com `BILLING_ENFORCED=true`.

## Limitações conhecidas (v1)
- **Isolamento por conta**: as APIs exigem login, mas o isolamento fino
  (um cliente nunca conseguir ler dados de outro via API) ainda é parcial — o
  reforço por recurso é um passo seguinte antes de escala grande.
- **WhatsApp por sessão (Playwright)**: precisa de Chrome no servidor e não vem na
  imagem. Na v1 use a **API oficial** do WhatsApp/Instagram (aba Mensagens →
  Conexões). Envio por sessão é para uso local.
- **Pagamento** é simulado (sem Stripe/Mercado Pago). Os planos registram receita,
  mas não cobram de verdade ainda.
- **Banco**: SQLite num volume aguenta bem um começo; para muitos usuários
  simultâneos, migrar para Postgres é o próximo passo.
