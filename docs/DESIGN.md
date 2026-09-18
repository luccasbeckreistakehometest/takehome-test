# Marqa — Design System · Estúdio Editorial

Especificação da linguagem visual da Marqa. Este documento é normativo: quando o código diverge
daqui, o código está errado. Nomes de token ficam em inglês (são código); o resto é pt-BR, como o
resto do repositório.

Versão 1.0 · branch `feat/design-system` · escrito a partir de uma auditoria visual das telas reais
(build de produção, banco semeado, 23 capturas em 1440×900 e 390×844, claro e escuro).

---

## 1. Tese

A Marqa é um **estúdio editorial**: a tipografia carrega a hierarquia, a grade carrega o ritmo, e a
cor da agência aparece **uma vez por tela**, no lugar que decide. Toda peça que a agência mostra ao
cliente dela — relatório, proposta, fatura, página pública, carrossel — é diagramada como uma
publicação: capa, cabeçalho corrente, régua, número tabular, medida de leitura e estilo de impressão
de verdade. Dentro do app a mesma escala fica densa e silenciosa, porque ferramenta boa não decora:
ela alinha.

---

## 2. O que estava errado (auditoria, 18/09/2026)

Auditoria feita sobre o build de produção em `localhost:3200` com dados semeados. As capturas ficam
fora do repositório (scratchpad da sessão). Cada item abaixo foi visto numa tela, não deduzido do
código.

### 2.1 Defeitos medidos (números, não opinião)

| # | Defeito | Medida |
|---|---|---|
| D1 | Rótulo branco no botão primário (`--accent-ink: #fff` sobre `--accent: #f76b15`) | **2,97:1** — reprova AA (4,5:1) e reprova até o piso de 3:1 de UI. Está em **todo** CTA do produto. Tinta preta no mesmo laranja dá 6,45:1. |
| D2 | `--accent` como cor de texto no tema claro (títulos de seção, links, eyebrows) | **2,97:1** sobre papel branco — reprova AA. No escuro o mesmo token dá 6,65:1. Um único token para dois contextos com resultados opostos. |
| D3 | Hairline `--edge` — o único recurso de hierarquia da interface | **1,31:1** no escuro (`#2b2b37` sobre `#14141b`), **1,28:1** no claro. A borda é invisível: toda a "estrutura" das telas é um campo cinza sem separação real. |
| D4 | Cartões do workspace | 11 cartões empilhados com o **mesmo** raio (`rounded-xl`), a **mesma** borda de 1px, o **mesmo** preenchimento e o **mesmo** padding (20px). Nada é primário. |
| D5 | Tiles do admin | **13** KPIs idênticos numa grade de 6 colunas, todos com ícone laranja, todos mostrando `0`, sem agrupamento nem ordem de importância. Dinheiro (`R$ 0`) e contagem (`1/1`) recebem o mesmo estilo. |
| D6 | Navegação | 12 itens + menu "Mais" + 5 controles utilitários = **17 alvos numa barra de 56px**. Sem grupos. |
| D7 | Medida de leitura | Parágrafos no workspace ocupam os 1050px do cartão ≈ **140 caracteres por linha** (o confortável é 60–75). |
| D8 | Um estilo, quatro papéis | `text-[11px] uppercase tracking-wide` é usado ao mesmo tempo como título de seção, rótulo de KPI, cabeçalho de tabela **e** label de formulário. |
| D9 | Escala tipográfica | Toda a interface vive em 3 tamanhos de uma família só (Space Grotesk 30 / 15 / 11px). Sem contraste editorial, sem escala documentada. |
| D10 | Comprimento da landing | **6.939px** em 1440 e **12.050px** em 390 — 14 telas de rolagem no celular, com `py-24` idêntico em todas as seções. Nada acelera, nada desacelera; a tabela comparativa cai para ~330px de largura e fica ilegível. |

### 2.2 Tudo que é da lista proibida e está no produto hoje

Encontrado nas capturas, não no código:

- **Emoji como ícone**, apesar de já existir um sprite próprio em `components/icons.tsx`:
  `👋 COMECE POR AQUI`, `🔖 Rodar radar de mercado`, `📄 Gerar relatório`, `💡 Ideias para esta
  conta`, `👤 Ver como cliente`, `💎 Planos & coins`, `📦 Pacote do cliente`, `💗 PULSO DO CLIENTE`,
  `🔍 O QUE FUNCIONA PRA ESTE CLIENTE`, `📊 Relatório mensal`, `🔗 Cliques`, `🔢 Horas & margem`,
  `⚙️ Admin da Plataforma`.
- **Ícone "sparkle" de IA** no CTA primário (`✦ Gerar kit completo`, `✦ Gerar resumo com IA`) e no
  FAB laranja flutuante — que ainda por cima fica **por cima do relatório do cliente**.
- **Manchas de cor borradas**: `.glow-pulse` com `blur-[130px]` em dois blobs laranja atrás do hero
  e mais um atrás do CTA final.
- **Texto com gradiente animado**: `.hero-gradient-text` com `gradient-pan` infinito na segunda
  linha do H1.
- **Dashboard falso na captura**: o `HeroVisual` é um mock com barras de skeleton e o selo
  "9 entregáveis prontos" — um print de produto que não existe.
- **Hero = texto + dois botões + cartões iguais**: a landing repete o mesmo bloco (título centrado,
  subtítulo, grade de cartões idênticos) em **cinco** seções seguidas, todas com `py-24`.
- **`rounded-2xl` uniforme** em cartões, chips, badges e caixas de FAQ.
- **Sombra como único recurso de profundidade** (`card-hover` levanta 2px e joga uma sombra; é a
  única diferença entre estados).
- **Animação decorativa em loop**: `float`, `glow-pulse`, `gradient-pan`, `marquee` — todas
  infinitas, nenhuma informativa.

### 2.3 Defeitos de ofício

- **Zeros mentirosos.** Onde não há dado, a tela mostra `0` em laranja gigante (Entregáveis, Pulso,
  Resultados). "Nenhuma métrica conectada" e "zero" são coisas diferentes e o desenho não distingue.
- **Tabelas sem tabela.** Em `/finance`, oito colunas — seis delas numéricas — todas alinhadas à
  esquerda, sem régua, sem zebra, sem largura definida, sem cabeçalho fixo.
- **Sem figuras tabulares** em lugar nenhum. `R$ 0`, `0h00` e `15,8%` usam a display proporcional.
- **Formulários sem sistema.** 14 campos, dois cartões sem título, larguras arbitrárias
  (`Margem-alvo (%)` tem 350px para dois caracteres), instrução dentro do placeholder — que some no
  foco —, `<select>` nativo do sistema operacional no meio de inputs customizados, um único botão
  no fim de uma página de 1400px e nenhum estado de erro desenhado.
- **Estados vazios são parágrafos.** "Nenhuma reunião futura para esta conta." solto num cartão,
  sem ação, sem diferença visual em relação ao estado cheio.
- **Mobile sem IA própria.** As duas fileiras de abas viram dois `<select>` nativos; o workspace
  vira uma coluna de 3267px com 15 cartões; o FAB cobre um KPI.
- **Duas metáforas de navegação empilhadas** em 40px: uma fileira de pílulas e outra de sublinhados.
- **Ícones em sete tamanhos** (13, 14, 15, 17, 18, 22, 24px) com a mesma espessura de traço.

---

## 3. Tipografia

Duas famílias baixadas (as duas variáveis, as duas servidas pelo próprio Next via `next/font/google`,
sem CDN) e uma pilha de sistema. Nada de Inter, Poppins, Montserrat ou Geist em título.

### 3.1 Famílias

**Display — `Fraunces`** (Undercase Type). Serifa *old style* de display com quatro eixos:
`opsz 9–144`, `wght 100–900`, `SOFT 0–100`, `WONK 0–1`.

Por quê: é o único jeito honesto de fazer tipografia editorial na web. Com o eixo óptico, uma manchete
de 72px e um olho-de-texto de 11px são **desenhos diferentes** — o `opsz` baixo abre o espacejamento,
aumenta a altura-x e alarga os caracteres; o alto afina e fecha. Sem isso, "editorial" vira uma fonte
esticada. O eixo `WONK` (o `h`/`n`/`m` inclinado, os terminais em bola do itálico) dá personalidade
nas manchetes sem trocar de família, e o `SOFT` cobre do rígido ao "molhado" sem uma segunda licença.

```ts
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],   // wght já vem por padrão
  variable: "--font-display",
  display: "swap",
});
```

Uso: `wght` **400–600 apenas** (nunca 700+: a manchete pesa pelo tamanho, não pelo peso).
`opsz` **sempre igual ao tamanho renderizado em px**, com clamp em 9–144 — é obrigatório, não opcional.
`WONK 1` só a partir de 40px. `SOFT 0` no app e nos documentos; até `SOFT 20` na página pública da
agência e na capa da proposta, onde a peça é uma peça de marca.

Pilha de fallback (serifas de sistema com altura-x parecida, não Times):
`'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`

**Texto e UI — `Archivo`** (Omnibus-Type). Grotesca variável com `wght 100–900` e `wdth 62–125`.

Por quê: linhagem editorial de verdade (grotescas americanas de madeira, desenhadas para manchete de
jornal), altura-x grande — sobrevive a 12–13px numa tabela densa, que é onde o produto passa a maior
parte do tempo — e um **eixo de largura**, que dá cabeçalho de coluna condensado e rótulo denso sem
uma terceira família. É a economia que separa um sistema de uma pasta de fontes.

```ts
const text = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-text",
  display: "swap",
});
```

Uso: `wght` **400 / 500 / 600**. `wdth 100` para prosa e UI; `wdth 92` para cabeçalho de tabela,
rótulo denso e eyebrow; nada além disso.

Pilha de fallback: `'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif`

**Monoespaçada — pilha de sistema, zero download.** Só para string de máquina: slug, token, ID, UTM,
chave de webhook, nome de variável de ambiente.
`ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`

**Números: não há terceira família — e não é palpite, foi medido.** Dez dígitos a 40px, num Chromium
headless, comparando a largura de `1111111111` com a de `0000000000`:

| Família | Padrão | Com `tabular-nums` | Conclusão |
|---|---|---|---|
| Archivo | 208,55px vs 229,09px — **proporcional** | 227,38px vs 227,38px — **idênticas** | `tnum` funciona |
| Fraunces | 173,98px vs 256,13px — proporcional | 173,98px vs 256,13px — **sem efeito** | Fraunces **não tem** figuras tabulares |

Daí a regra, que é dura: **todo número que se alinha usa Archivo com
`font-variant-numeric: tabular-nums lining-nums`. Fraunces nunca recebe número que se compara** —
num Fraunces sem `tnum` a diferença entre uma coluna de uns e uma de zeros passa de 80px em dez
dígitos, e a coluna desmonta. Fraunces pode levar número só quando ele é ornamento isolado (o ano
numa capa, o "1" de um passo). Uma família a menos na rede e nenhuma quebra de ritmo de cor dentro
da tabela.

Subset `latin` cobre o pt-BR inteiro (ã õ ç á é í ó ú â ê ô à). `latin-ext` só entra se surgir copy
em idioma que precise. Os eixos e subsets acima foram conferidos no catálogo do próprio
`next/font/google` desta versão (`Fraunces`: SOFT 0–100, WONK 0–1, opsz 9–144, wght 100–900;
`Archivo`: wdth 62–125, wght 100–900), e não no que a documentação promete.

### 3.2 Escala modular

Duas razões, como manda a prática editorial: a escala de texto é fechada (1,2 — terça menor), a de
display é aberta (1,5 — quinta). `tracking` em `em` para escalar junto com o corpo.

**Display — Fraunces**

| Token | px | line-height | tracking | wght | opsz | WONK | Onde |
|---|---|---|---|---|---|---|---|
| `d1` | 72 (mobile 44) | 72 / 44 | −0,022em | 500 | 72 | 1 | capa de relatório, hero da página pública, H1 da landing |
| `d2` | 48 (mobile 34) | 48 / 36 | −0,018em | 500 | 48 | 1 | abertura de seção editorial |
| `d3` | 32 (mobile 26) | 36 / 32 | −0,012em | 500 | 32 | 0 | título de página do app, capítulo de documento |
| `d4` | 24 | 28 | −0,008em | 500 | 24 | 0 | título de painel, subtítulo de documento |

**Texto — Archivo**

| Token | px | line-height | tracking | wght | wdth | Medida máx. | Onde |
|---|---|---|---|---|---|---|---|
| `t1` lede | 20 | 30 | −0,004em | 400 | 100 | 62ch | linha de apoio abaixo de `d1`/`d2` |
| `t2` body | 16 | 26 | 0 | 400 | 100 | 68ch | prosa, corpo de documento |
| `t3` ui | 14 | 20 | 0 | 400 | 100 | 72ch | padrão da interface |
| `t4` dense | 13 | 18 | +0,002em | 400 | 100 | — | célula de tabela, lista densa |
| `t5` micro | 12 | 16 | +0,006em | 500 | 92 | — | legenda, cabeçalho de tabela, badge, **label de formulário** |
| `t6` eyebrow | 11 | 12 | +0,09em | 600 | 92 | — | **caixa alta; no máximo um por seção** |

**Números — Archivo, `tabular-nums lining-nums`**

| Token | px | line-height | tracking | wght | Onde |
|---|---|---|---|---|---|
| `n1` | 36 | 36 | −0,02em | 500 | KPI de destaque |
| `n2` | 24 | 28 | −0,015em | 500 | figura de relatório, total de fatura |
| `n3` | 14 | 20 | 0 | 500 | valor em tabela, moeda inline |

### 3.3 Regras de tipografia

1. **Caixa alta é só do `t6`.** Label de formulário é `t5` em caixa de sentença. Isto sozinho mata o
   defeito D8: um estilo deixa de fazer quatro trabalhos.
2. **`opsz` acompanha o tamanho.** Um utilitário `displayStyle(px)` devolve `fontSize`,
   `lineHeight`, `letterSpacing` e `fontVariationSettings` juntos. Ninguém escreve `text-5xl` na mão.
3. **Medida de leitura é obrigatória.** Toda prosa fica dentro de `max-width` em `ch`, nunca 100% do
   contêiner. A coluna editorial tem 6 das 12 colunas.
4. **Pontuação pendurada** (`hanging-punctuation: first last`) na coluna de prosa dos documentos e
   nas citações — Safari já suporta; nos outros navegadores degrada sem prejuízo.
5. **Alinhamento óptico** na capa dos documentos: aspas e travessões iniciais recuam com
   `text-indent` negativo do tamanho do glifo.
6. **Sem viúvas em manchete**: `text-wrap: balance` em `d1`/`d2`/`d3`, `text-wrap: pretty` em `t1`/`t2`.
7. **Números que se comparam se alinham.** Qualquer número que apareça duas vezes na mesma coluna
   ou empilhado é tabular. Sem exceção.
8. **Zero não é vazio.** Ausência de dado é travessão (`—`) em `text-faint`, nunca `0`.
9. **Itálico é do Fraunces**, para citação do cliente e nota de rodapé do documento. A UI não usa
   itálico.

---

## 4. Grade e ritmo

### 4.1 Três grades, não uma

O produto tem três naturezas e cada uma tem a sua grade. A escala é a mesma; o que muda é o
enquadramento.

**A · Editorial** — landing, funis, página pública da agência, planos, jurídico.
Contêiner 1280px, margem lateral 32 / 24 / 16 (desktop / tablet / mobile), **12 colunas**, goteira 24.
Assimetria nomeada, usada com intenção:

| Split | Colunas | Para quê |
|---|---|---|
| `lead` | 7 + 5 | abertura de seção: manchete e lede à esquerda, figura ou dado à direita |
| `lead-rev` | 5 + 7 | a seção seguinte, para o olho não cair no mesmo lugar duas vezes |
| `doc` | 8 + 4 | texto corrido + trilho de notas / âncoras |
| `prose` | 6 centradas | prosa longa (FAQ, jurídico) |
| `bleed` | 12, sangrando | **uma** imagem de largura total por página, no máximo |

Regra: **duas seções seguidas nunca usam o mesmo split.** Foi exatamente esse o erro da landing atual.

**B · Ferramenta** — app da agência.
Trilho fixo de 248px à esquerda (colapsa para 64px em ≤1200px, vira gaveta em ≤900px) + conteúdo
fluido com `max-width: 1180px`. Dentro do conteúdo, 12 colunas, goteira 16 (densidade `compact`).
Layouts típicos: `8+4` (trabalho + contexto), `12` (tabela), `6+6` (comparação).

**C · Documento** — relatório, proposta, fatura, versão de impressão, carrossel.
Uma medida só, centrada: **160mm de mancha** numa página A4 retrato (210×297mm), margens
`24mm 25mm 22mm`. Na tela a mesma peça renderiza a 720px com as mesmas proporções, para que a
pré-visualização seja a peça. Cabeçalho corrente (cliente · período) e numeração em figura tabular.

### 4.2 Ritmo vertical

Linha de base de **4px**, preferência forte por múltiplos de 8. Toda altura de bloco fecha em 8.
As `line-height` da §3.2 já são múltiplos de 4 por construção.

Espaçamento entre seções — é aqui que a página passa a ter compasso em vez de `py-24` no mundo todo:

| Contexto | Entre blocos irmãos | Entre seções | Depois de uma abertura `d1`/`d2` |
|---|---|---|---|
| Editorial | 32 | **96** (mobile 64) | 40 |
| Ferramenta | 16 | 32 | 20 |
| Documento | 24 | 48 (quebra de página quando couber) | 32 |

**Proximidade importa mais do que a régua.** Coisas relacionadas ficam a 8–16px; coisas não
relacionadas, a 32px ou mais, e com régua entre elas. A tela do workspace hoje usa 24px entre tudo,
e é por isso que onze cartões diferentes parecem um fluxo só.

### 4.3 Escala de espaçamento

```
--space-3xs 2    --space-2xs 4    --space-xs 6    --space-sm 8
--space-md  12   --space-lg  16   --space-xl 20   --space-2xl 24
--space-3xl 32   --space-4xl 40   --space-5xl 56  --space-6xl 72
--space-7xl 96   --space-8xl 128
```

Nada fora desta lista. Sem `p-[13px]`.

### 4.4 Densidade é uma decisão

A densidade é um token de contêiner, não uma propriedade de componente. O mesmo `<Table>` serve o
relatório e a tela de margem.

```css
[data-density="comfortable"] { --row-h: 48px; --pad-x: 24px; --pad-y: 20px; --gap: 24px; --ui-size: 16px; }
[data-density="compact"]     { --row-h: 32px; --pad-x: 12px; --pad-y:  8px; --gap: 12px; --ui-size: 13px; }
```

- `comfortable`: landing, funis, página pública, relatório, proposta, fatura, onboarding, jurídico.
- `compact`: workspace, produção, agenda, finance/insights, faturas (lista), admin, calendário, kanban.

Alvo de toque: **mínimo 40×40px de área clicável em qualquer densidade**, mesmo quando o alvo visível
tem 32px de altura (a diferença entra como padding transparente). No mobile, 44×44.

### 4.5 Raio — sinal, não decoração

O raio diz o que a coisa é. Um produto em que tudo é `rounded-2xl` não diz nada.

| Token | Valor | Onde |
|---|---|---|
| `r-none` | 0 | tabela, superfície de documento, coluna editorial, régua, impressão |
| `r-sm` | 3px | input, botão, checkbox, badge, chip, célula selecionada |
| `r-md` | 6px | painel, menu, popover, diálogo, imagem de entregável |
| `r-full` | 9999px | **só** avatar e ponto de status |

Proibido: `rounded-xl`, `rounded-2xl`, `rounded-3xl`. A "pílula" de navegação some junto (vira a aba
sublinhada da §11).

---

## 5. Cor

Uma rampa neutra, três cores semânticas e **uma** cor expressiva — a da agência. Todos os contrastes
abaixo foram medidos (WCAG 2.1, fórmula de luminância relativa); o script vive em
`lib/brand-ramp.ts` e os pisos são verificados por teste unitário.

### 5.1 A rampa neutra "Tinta"

Cinza quente, não o preto-azulado de hoje. Papel tem temperatura; cinza frio é o cinza que todo
gerador de tema entrega.

| Token | Hex | sobre `n-0` | sobre `n-950` |
|---|---|---|---|
| `n-0` | `#FFFFFF` | 1,00 | 19,15 |
| `n-25` | `#FBFAF8` | 1,04 | 18,36 |
| `n-50` | `#F5F3EF` | 1,11 | 17,28 |
| `n-100` | `#EAE7E1` | 1,23 | 15,52 |
| `n-150` | `#DCD8D0` | 1,42 | 13,47 |
| `n-200` | `#C9C4BA` | 1,74 | 11,02 |
| `n-300` | `#ABA599` | 2,45 | 7,82 |
| `n-400` | `#8B857A` | 3,66 | 5,23 |
| `n-500` | `#6D675E` | 5,60 | 3,42 |
| `n-600` | `#524D46` | 8,37 | 2,29 |
| `n-700` | `#3B3733` | 11,80 | 1,62 |
| `n-800` | `#292623` | 15,05 | 1,27 |
| `n-850` | `#201E1C` | 16,62 | 1,15 |
| `n-900` | `#171514` | 18,20 | 1,05 |
| `n-950` | `#100F0E` | 19,15 | 1,00 |

### 5.2 Papéis, nos dois temas — todos medidos

Os dois temas são de primeira classe. O escuro não é o claro invertido: as bordas trocam de degrau
porque contraste não é simétrico.

| Papel | Claro | medido | Escuro | medido |
|---|---|---|---|---|
| `canvas` (fundo da página) | `n-50` | — | `n-950` | — |
| `surface` (painel, documento) | `n-0` | 1,11 sobre canvas | `n-900` | 1,05 sobre canvas |
| `surface-sunken` (campo, célula par) | `n-50` | — | `n-850` | — |
| `text` | `n-900` | **18,20** sobre surface | `n-50` | **16,42** sobre surface |
| `text-muted` | `n-500` | **5,60** | `n-400` | **4,97** |
| `text-faint` (placeholder, `—`) | `n-400` | **3,66** | `n-500` | **3,25** |
| `rule` (hairline decorativa) | `n-150` | **1,42** | `n-700` | **1,54** |
| `edge` (borda estrutural: input, seleção, régua de cabeçalho) | `n-400` | **3,66** | `n-500` | **3,25** |

**Pisos, e a razão de cada um.** Texto ≥ 4,5:1 (AA). Texto grande (≥ `d3`) e texto esmaecido
não-essencial ≥ 3:1. **Borda estrutural ≥ 3:1** (WCAG 1.4.11: a borda que delimita um input ou marca
uma seleção carrega informação). **Régua decorativa ≥ 1,4:1** — e, justamente por ser fraca,
`rule` **nunca pode ser o único recurso de hierarquia**; vem sempre acompanhada de um degrau tonal,
de espaço ou de peso tipográfico. É a regra que impede o defeito D3 de voltar.

### 5.3 Semântica — só estado, nunca decoração

| Papel | Claro | sobre `n-0` | Escuro | sobre `n-900` |
|---|---|---|---|---|
| `positive` (aprovado, margem positiva, pago) | `#1B6B44` | **6,50** | `#57C98D` | **8,79** |
| `negative` (recusado, prejuízo, vencido, erro) | `#A32B22` | **7,18** | `#FF8A7E` | **7,96** |
| `caution` (aguardando, vence em breve, limite perto) | `#7A5200` | **6,92** | `#E4A83C` | **8,64** |

Cada um tem `-wash` (campo chapado, ~8% de tinta) e `-edge` (a própria cor a 3:1).
**Não existe azul de "info".** A informação é a cor da marca — é o que faz a marca significar algo.

Proibido: cor semântica em qualquer coisa que não seja estado. Um KPI não é verde porque é um KPI.

### 5.4 Whitelabel — a cor da agência com garantia

O problema real: a agência escolhe **um hex**, e esse hex pode ser `#FFD400` ou `#FFFFFF`. O sistema
não pode "esperar que dê certo". Ele deriva, a cada request (a marca já vem de `resolveBrand`), seis
tokens com piso de contraste verificado, e emite como `style` inline no `<html>` — exatamente onde
hoje sai o `--accent` cru.

| Token derivado | Regra | Uso |
|---|---|---|
| `--brand` | o hex cru | campo grande, fundo de capa, marca d'água |
| `--brand-solid` | `--brand` com L deslocado em OKLCH até que preto **ou** branco alcance 4,5:1 | fundo do botão primário, barra de capa |
| `--brand-ink` | preto `n-950` ou branco `n-0`, o que vencer sobre `--brand-solid` | rótulo em cima de `--brand-solid` |
| `--brand-text` | matiz preservado, L movido até 4,5:1 contra a `surface` **do tema corrente** | link, valor em destaque, marcador ativo |
| `--brand-edge` | mesma ideia, piso 3:1 | borda de seleção, anel de foco, sublinhado de aba ativa |
| `--brand-wash` | matiz a L 0,965 (claro) / 0,24 (escuro), croma limitado | campo chapado de destaque — **nunca** gradiente |

Derivação em OKLCH: só o **L** se move (a matiz é da agência, não nossa), e o croma é cortado para o
máximo em gamut naquele L por busca binária. Se a cor crua já passa no piso, ela é usada como está —
a marca aparece de verdade quando pode.

Resultados medidos, incluindo os casos patológicos:

| Marca | `--brand-solid` + `--brand-ink` | `--brand-text` claro | escuro | `--brand-edge` claro | escuro |
|---|---|---|---|---|---|
| `#F76B15` (Marqa) | `#F76B15` + preto — **6,45** | `#C75100` 4,56 | `#F76B15` 6,13 | `#F56911` 3,04 | `#F76B15` 6,13 |
| `#0F62FE` | `#0F62FE` + branco — **5,00** | `#0F62FE` 5,00 | `#3378FF` 4,57 | `#0F62FE` 5,00 | `#0F62FE` 3,64 |
| `#00A86B` | `#00A86B` + preto — **6,21** | `#008755` 4,57 | `#00A86B` 5,91 | `#00A86B` 3,08 | `#00A86B` 5,91 |
| `#FFD400` | `#FFD400` + preto — **13,38** | `#8D7400` 4,53 | `#FFD400` 12,71 | `#B09100` 3,05 | `#FFD400` 12,71 |
| `#E91E63` | `#EC2365` + preto — **4,55** ← o sólido precisou mover | `#E51760` 4,54 | `#F02969` 4,53 | `#E91E63` 4,35 | `#E91E63` 4,19 |
| `#7C3AED` | `#7C3AED` + branco — **5,70** | `#7C3AED` 5,70 | `#915FFF` 4,58 | `#7C3AED` 5,70 | `#7C3AED` 3,19 |
| `#00E5FF` | `#00E5FF` + preto — **12,45** | `#008291` 4,56 | `#00E5FF` 11,83 | `#00A3B6` 3,04 | `#00E5FF` 11,83 |
| `#FFFFFF` | `#FFFFFF` + preto — **19,15** | `#100F0E` 19,15 | `#FFFFFF` 18,20 | — | — |
| `#000000` | `#000000` + branco — **21,00** | `#000000` 21,00 | `#FFFFFF` 18,20 | — | — |

Duas leituras honestas desta tabela. **`#E91E63`** prova que a derivação é necessária: o rosa cru dá
4,40:1 com tinta preta, reprova, e o sólido é deslocado para `#EC2365`. **`#FFFFFF`** mostra o limite:
não existe texto branco legível em papel branco, então `--brand-text` cai para tinta — a marca
continua visível como **campo** (`--brand-solid` branco com tinta preta), só não como texto. Isso é
correto, e precisa estar documentado para ninguém "consertar" depois.

Teste unitário obrigatório: para um conjunto que inclua os nove hexes acima, `--brand-ink` sobre
`--brand-solid` ≥ 4,5, `--brand-text` sobre a surface do tema ≥ 4,5 e `--brand-edge` ≥ 3,0, nos dois
temas.

### 5.5 Orçamento de cor por tela

Regra dura, e é o coração da tese: **um elemento expressivo por tela.** Numa tela, a cor da marca
aparece em no máximo **um** destes papéis ao mesmo tempo: o botão primário, **ou** o marcador de
navegação ativo, **ou** a régua de capa do documento. Tudo o mais é neutro. Estado usa semântica.
Ícone herda `currentColor` e nunca é colorido por decoração.

Consequência direta, que mata o D2 e o "laranja em tudo": título de seção é `text` (não marca),
número de KPI é `text` (não marca), eyebrow é `text-muted` (não marca), ícone de lista é
`text-faint` (não marca).

---

## 6. Bordas, profundidade e elevação

Ordem de recursos para separar duas coisas. Usa-se o primeiro que resolve; sombra é o último.

1. **Espaço e posição** — a maior parte do trabalho.
2. **Degrau tonal** — `surface` sobre `canvas`, `surface-sunken` dentro de `surface`.
3. **Régua/hairline** — 1px, `rule`.
4. **Borda estrutural** — 1px, `edge` (≥3:1), só quando delimita algo interativo.
5. **Sombra** — **só** para o que de fato flutua acima da página.

**Um painel nunca tem sombra.** Um cartão de conteúdo não flutua.

| Token | Valor (claro) | Onde |
|---|---|---|
| `e1` | `0 1px 2px rgba(16,15,14,.06), 0 8px 24px -8px rgba(16,15,14,.18)` | menu, popover, tooltip |
| `e2` | `0 2px 4px rgba(16,15,14,.08), 0 24px 64px -16px rgba(16,15,14,.28)` | diálogo, gaveta |
| `e3` | `0 1px 0 var(--rule), 0 8px 16px -12px rgba(16,15,14,.24)` | barra fixa **depois** do scroll começar |

No escuro a sombra quase não existe: `e1`/`e2` caem para metade da opacidade e **ganham um degrau
tonal** (`surface` → `surface-raised` = `n-850`), porque sombra preta sobre fundo preto não separa
nada. Quem confia só na sombra perde o tema escuro.

**Regras de retina.** Borda é sempre `1px solid` — nunca `0.5px` (o Safari arredonda para 0 em 1x).
Régua de tabela é `box-shadow: inset 0 -1px 0 var(--rule)`, não `border-bottom`, para não entrar na
altura da linha e não brigar com o ritmo de 4px. Nada de borda em elemento com `transform: scale()`.

---

## 7. Movimento

| Token | Duração | Curva | Para quê |
|---|---|---|---|
| `dur-1` | 90ms | `cubic-bezier(.2,0,0,1)` | estado: hover, foco, pressionado |
| `dur-2` | 160ms | `cubic-bezier(.2,0,0,1)` | revelar: menu, tooltip, sublinhado de aba, acordeão |
| `dur-3` | 240ms | `cubic-bezier(.2,0,0,1)` | camada: diálogo, gaveta, toast |

Saída sempre 2/3 da entrada, com `cubic-bezier(.4,0,1,1)`. Sem mola, sem *bounce*, sem `overshoot`.

Propriedades animáveis: `opacity`, `transform`, `background-color`, `border-color`, `color`,
`box-shadow`. **Nunca** `height`, `width`, `top`, `left` (usar `grid-template-rows: 0fr → 1fr` para
acordeão).

**Nada roda em loop.** Saem: `float`, `glow-pulse`, `gradient-pan`, `marquee`, `shimmer` infinito.
O skeleton perde o brilho que atravessa a tela e vira uma pulsação de opacidade de 1,2s entre
`surface-sunken` e `rule` — e só aparece depois de **400ms** de espera, para carregamento rápido não
piscar.

Exceção, porque é funcionalidade e não enfeite: a comemoração de subida de elo (`LevelUpCelebration`)
continua, mas **um disparo só**, ≤ 700ms, dispensável com `Esc`, e nunca por cima de uma peça que o
cliente da agência vê.

`prefers-reduced-motion: reduce`: todas as durações viram 1ms, transformações somem (opacidade
permanece), o skeleton fica estático e a comemoração vira um selo parado.

---

## 8. Ícones

Sem pacote novo. O sprite local `components/icons.tsx` (SVG inline, `currentColor`) fica — endurecido:

- **Uma espessura:** 1,5px numa `viewBox` de 24. O tamanho 16 usa 1,75px para o traço não sumir.
- **Três tamanhos, e só três:** `16` (denso, dentro de tabela e lista), `20` (padrão de UI),
  `24` (marcador de seção, estado vazio). Acabam os 13/14/15/17/18/22.
- Traçado desenhado na grade de 24 com os eixos em meio pixel, `stroke-linecap="round"`,
  `stroke-linejoin="round"`, sem preenchimento, sem traço de espessura mista no mesmo glifo.
- **Ícone nunca tem cor própria.** Herda `currentColor`; quem decide a cor é o texto ao lado.
- **Zero emoji na interface do produto.** Todo emoji listado na §2.2 sai — vira glifo do sprite ou
  simplesmente nada (a maioria não estava informando coisa alguma). Emoji continua legítimo em
  conteúdo escrito por gente e em copy gerada pela IA que a agência publica.
- Ícone decorativo leva `aria-hidden="true"`; ícone que é o único conteúdo de um botão leva
  `aria-label`.
- **Nenhum ícone de "IA".** Sem varinha, sem estrelinha, sem cérebro. Ação de IA é dita por verbo —
  "Gerar kit completo" —, não por ✦.

---

## 9. Exibição de dados

### 9.1 Tabelas

- **Sem cartão em volta.** A tabela é a superfície. Nada de `border` + `rounded` + `p-5` envolvendo
  uma tabela: é o que faz a `/finance` parecer um slide.
- **Sem zebra.** Zebra é para quando a linha é alta e a leitura é horizontal. As tabelas da Marqa são
  curtas e densas: régua de 1px em `rule` entre linhas, régua de 1px em `edge` sob o cabeçalho, e
  `surface-sunken` só na linha sob o cursor e na selecionada.
- Cabeçalho `t5` (Archivo `wdth 92`, `wght 500`, caixa de sentença, `text-muted`), fixo no scroll com
  `position: sticky` + `e3`.
- **Largura de coluna é declarada**, nunca automática, e `table-layout: fixed`. Coluna de texto pode
  truncar com `text-overflow: ellipsis` + `title`; coluna numérica jamais trunca.
- **Alinhamento:** texto à esquerda, **número à direita**, data à direita, status à esquerda, ações à
  direita. **O cabeçalho alinha igual à célula** — é o detalhe que mais denuncia trabalho apressado.
- Linha de total: régua de 1px `edge` em cima, `wght 600`, mesma tabulação.
- Overflow horizontal: só a tabela rola (`overflow-x: auto` no contêiner próprio), nunca a página; a
  primeira coluna gruda com `position: sticky; left: 0`.
- Estados obrigatórios: carregando (esqueleto com **as mesmas** larguras de coluna), vazio, erro,
  filtro sem resultado (diferente de vazio), fim de paginação.

### 9.2 Números

- `font-variant-numeric: tabular-nums lining-nums` em **toda** célula, KPI, moeda e porcentagem — e
  sempre em Archivo. Fraunces não tem `tnum` (medido, §3.1): um KPI em display desalinha a coluna.
  É por isso que os tokens `n1`–`n3` da §3.2 são de texto, não de display, mesmo o de 36px.
- Moeda em pt-BR via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
  O símbolo `R$` sai em `text-muted`, o valor em `text` — a coluna alinha pelo dígito, não pelo cifrão.
- Porcentagem com uma casa (`15,8%`); contagem sem casa; horas como `12h30` (nunca `12.5`).
- **Delta** é `+12,4%` / `−8,1%` em `positive`/`negative` com a seta do sprite, **sem chip de fundo
  colorido**. O sinal `−` é o menos tipográfico (U+2212), não o hífen.
- **Ausência de dado é `—`** em `text-faint`. `0` só quando o valor medido é zero. Onde o produto não
  sabe a diferença, o backend passa a devolver `null` e não `0`.
- Alinhamento de linha de base: rótulo e valor de um KPI compartilham a mesma linha de base, com o
  rótulo acima; blocos de KPI lado a lado alinham **pelo valor**, não pelo topo do cartão.

### 9.3 Gráficos (relatórios e insights)

- Uma série = `--brand`. Duas séries = `--brand` + `n-400`. Três ou mais: repensar o gráfico.
- Grade só no eixo de valor, 1px em `rule`, sem grade vertical, sem moldura.
- Sem preenchimento em gradiente, sem topo arredondado em barra, sem 3D, sem donut com número no
  meio — a não ser que aquele número **seja** a métrica.
- Legenda só com duas séries ou mais; com uma, o rótulo vai direto na linha.
- Sparkline: traço de 1,5px, sem preenchimento, sem pontos, exceto o último.
- Eixos em `t5`; valores em figura tabular; o eixo de valor começa em zero, e quando não começar isso
  é dito no rótulo.
- Toda visualização tem tabela equivalente acessível (`<table>` visualmente oculta ou `aria-label`
  com o resumo).

### 9.4 Estados vazios — forma fixa

Nunca um parágrafo solto. Sempre: ícone 24 em `text-faint` · frase `t3` dizendo **o que vai aparecer
aqui** (não "nenhum dado") · **uma** ação em link ou botão *quiet* · quando fizer sentido, uma linha
`t5` explicando a condição ("aparece a partir de 4 posts publicados"). Fundo `surface`, régua
tracejada de 1px em `rule`, `r-md`, altura mínima 160px.

---

## 10. Documentos e impressão

É aqui que a tese vira dinheiro: o relatório, a proposta, a fatura, a página pública e o carrossel
são o que a agência mostra **ao cliente dela**. Precisam parecer entrega de estúdio.

**Anatomia comum**

1. **Capa**: nome do cliente em `d1`; período e tipo em `t1`; régua de 3px em `--brand` com a largura
   da mancha; logo da agência (ou o lockup Marqa) alinhado à base da régua. Sem cor de fundo.
2. **Cabeçalho corrente** (a partir da 2ª página): `t5`, `cliente · período` à esquerda, número da
   página em figura tabular à direita, régua `rule` embaixo.
3. **Sumário executivo**: coluna de prosa de 62ch em `t2`, com `hanging-punctuation`.
4. **Figuras**: bloco numerado (`Fig. 1`) em `t5`, legenda abaixo, `break-inside: avoid`.
5. **Tabelas**: as da §9.1, sem cartão, régua fina.
6. **Rodapé**: emissor, data de geração em figura tabular, e o aviso de origem do dado.

**Estilo de impressão de verdade** — não `display: none` no header:

```css
@page { size: A4; margin: 24mm 25mm 22mm; }
@page :first { margin-top: 32mm; }
@media print {
  :root { color-scheme: light; }              /* documento é sempre claro */
  body { background: #fff; color: var(--n-900); }
  .doc-cover  { break-after: page; }
  .doc-figure, .doc-table, .doc-kpi { break-inside: avoid; }
  h2, h3 { break-after: avoid; }              /* título não fica órfão no pé */
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 9pt; color: var(--n-500); }
  .doc-rule { print-color-adjust: exact; }    /* só a régua da marca imprime colorida */
  .no-print, nav, .app-rail, .fab { display: none !important; }
}
```

Regras: o documento **nunca** herda o tema escuro; o FAB do assistente e a navegação do app não
existem dentro de uma peça de cliente; a pré-visualização na tela usa a mesma folha de estilo do
papel (mesma mancha, mesmas quebras), então o que se vê é o que sai.

---

## 11. Inventário de componentes

Estados obrigatórios em **tudo** que é interativo: `default`, `hover`, `active`, `focus-visible`,
`disabled`, e, quando couber, `loading`, `selected`, `invalid`, `readonly`.

**Foco.** `focus-visible` é anel de 2px em `--brand-edge` (≥3:1 garantido pela §5.4) com 2px de
offset e `border-radius` herdado. No escuro, anel de 2px em `n-50` com 1px interno em `--brand-edge`,
para o anel não sumir sobre uma marca escura. `outline: none` só existe acompanhado de substituto.
Ordem de tabulação segue a ordem visual; nada de `tabindex` positivo.

### 11.1 Ação

| Componente | Variantes | Observações |
|---|---|---|
| `Button` | `primary` (`--brand-solid` + `--brand-ink`), `secondary` (borda `edge`, fundo `surface`), `quiet` (só texto, hover em `surface-sunken`), `danger` (texto `negative`, borda `negative-edge`) | altura 32 (`compact`) / 40 (`comfortable`); `r-sm`; **um `primary` por região**; `loading` troca o rótulo por spinner **mantendo a largura**; `disabled` é `text-faint` sobre `surface-sunken`, sem opacidade global (opacidade quebra contraste) |
| `ButtonGroup` | — | régua interna de 1px, cantos externos `r-sm` |
| `Link` | `default`, `quiet` | `--brand-text`, sublinhado com `text-underline-offset: 2px`; **sublinhado sempre visível** em prosa, só no hover em UI |
| `IconButton` | idem `Button` | quadrado, alvo mínimo 40×40, `aria-label` obrigatório |
| `Menu` / `MenuItem` | — | `e1`, `r-md`, item 32px, separador `rule`, item perigoso em `negative` |

### 11.2 Entrada

| Componente | Estados extras |
|---|---|
| `Field` (invólucro) | `label` `t5` caixa de sentença · `hint` `t5` `text-muted` **acima** do controle · `error` `t5` `negative` abaixo · `required` marcado por texto "obrigatório" no hint, não por `*` · contador de caracteres em campo longo |
| `Input`, `Textarea` | `invalid` (borda `negative`, ícone, `aria-invalid`), `readonly` (fundo `surface-sunken`, sem borda), `disabled`, `with-prefix/suffix` (ex. `R$`, `%`, `@`) |
| `Select` | **customizado**, nunca o `<select>` nativo cru; mesma altura e borda dos inputs; teclado completo |
| `Combobox` | `loading`, `no-results`, `creating` |
| `Checkbox`, `Radio`, `Switch` | `indeterminate` no checkbox; o switch só para efeito imediato, nunca dentro de formulário com Salvar |
| `ChipGroup` | `selected` = `--brand-wash` + borda `--brand-edge` + `aria-pressed`; nunca só cor de fundo |
| `FileDrop` | `idle`, `dragover`, `uploading` (progresso real), `error`, `preview` |
| `DateNav` | setas com `aria-label` do período, rótulo em `t3`, hoje marcado com ponto |

**Largura de campo comunica.** A largura segue o conteúdo esperado: `%` = 88px, moeda = 160px,
data = 160px, nome = 320px, e-mail/URL = 100% da coluna. Formulário longo ganha barra de ação fixa
(`e3`) com Salvar/Cancelar e aviso de alteração não salva.

### 11.3 Estrutura e navegação

| Componente | Observações |
|---|---|
| `AppRail` | 248px, **4 grupos** com rótulo `t6`, item 32px com ícone 20 + `t3`; ativo = fundo `surface-sunken` + barra de 2px em `--brand-edge` à esquerda; colapsa para 64px (só ícone + tooltip) e vira gaveta em ≤900px. Substitui os 12 itens + "Mais" |
| `TopBar` | 48px: caminho/`d3` da página à esquerda, busca no centro, utilitários à direita agrupados num único `Menu` |
| `Tabs` | **uma metáfora só**: sublinhado de 2px em `--brand-edge`, rótulo `t3`; rolagem horizontal com máscara no mobile — **acabam** as duas fileiras e os `<select>` nativos |
| `Breadcrumb` | `t5`, separador `/` em `text-faint` |
| `Panel` | o único "cartão": `surface`, `r-md`, `rule` de 1px, **sem sombra**; cabeçalho opcional com `d4` + ações à direita, régua `rule` sob o cabeçalho |
| `ListRow` | altura `--row-h`, régua `rule` embaixo, hover `surface-sunken`, ação revelada no hover mas **sempre presente para o teclado** |
| `Dialog` | `e2`, largura 480/640/800, foco preso, `Esc` fecha, título `d4` |
| `Drawer` | `e2`, lateral direita, 420px, mesma regra de foco |
| `Toast` | `e1`, canto inferior direito, 5s, pausa no hover, nunca carrega a única via de desfazer |
| `Banner` | dentro do fluxo, `positive`/`caution`/`negative`/neutro, com `-wash` + `-edge` |
| `Tooltip` | só para texto curto; nunca a única fonte de uma informação |

### 11.4 Dados e conteúdo

`Table` (§9.1) · `Figure`/`KPI` (rótulo `t5` + valor `n1` + delta) · `Delta` · `StatusDot` ·
`Badge` (`t5`, `r-sm`, `-wash` + `-edge`) · `Progress` (barra de 4px, `rule` + `--brand-edge`) ·
`Skeleton` (mesma caixa do conteúdo final) · `EmptyState` (§9.4) · `Avatar` (`r-full`, iniciais em
`t5` sobre `surface-sunken`) · `BrandLockup` (marca da agência + "por Marqa" quando for whitelabel) ·
`Timeline` (aprovações) · `Comment` · `KanbanColumn`/`KanbanCard` · `CalendarCell` ·
`DocumentBlock` (§10) · `PrintHeader`/`PrintFooter`.

---

## 12. Do / Don't

**Proibido — porque é exatamente o que faz a tela parecer feita por IA:**

- Gradiente decorativo (roxo-para-azul ou qualquer outro), inclusive em texto.
- *Glassmorphism*, `backdrop-blur` como estética.
- Manchas de cor borradas ao fundo.
- Emoji como ícone ou marcador de lista.
- Hero de "texto centrado + dois botões + três cartões iguais".
- `rounded-2xl` uniforme em tudo.
- Sombra como único recurso de profundidade.
- Iconografia de "faísca de IA".
- Copy tipo "✨ Powered by AI".
- Dashboard falso nas capturas.
- Texto de enchimento estilo *lorem*.

**Também proibido aqui:**

- Cor da marca em mais de um papel na mesma tela (§5.5).
- Caixa alta fora do `t6`.
- Prosa sem `max-width` em `ch`.
- Número não tabular em coluna.
- `0` no lugar de "sem dado".
- Animação em loop.
- `<select>` nativo cru convivendo com input customizado.
- Um estilo de rótulo servindo a mais de um papel.
- Componente sem `focus-visible` visível.

**Faça:**

- Deixe o tipo carregar a hierarquia: tamanho, peso e família antes de caixa, cor ou moldura.
- Alterne os splits da grade entre seções seguidas.
- Alinhe a linha de base de rótulo e valor.
- Declare largura de coluna e alinhe número à direita.
- Desenhe o estado vazio antes do cheio.
- Escolha a densidade pela natureza da tela e mude só o token.
- Teste a marca da agência com `#FFD400` e `#FFFFFF` antes de dizer que funciona.
- Imprima o relatório em PDF antes de chamá-lo de pronto.

---

## 13. Ordem de reconstrução

Ordem escolhida por dependência (fundação antes de uso) e por risco (o que mais aparece primeiro, o
que mais vende logo depois). Cada bloco fecha num commit que compila, passa o e2e e pode ir para
produção sozinho.

| # | Bloco | Arquivos | Por que nesta posição |
|---|---|---|---|
| 1 | **Fundação** | `app/globals.css` (tokens, `@theme`, reset, impressão), `app/layout.tsx` (troca de `next/font`), **novo** `lib/brand-ramp.ts` + testes | Nada mais pode começar antes dos tokens e da garantia de contraste da §5.4 |
| 2 | **Primitivas** | `components/ui.tsx` → `Button`, `Field`, `Input`, `Textarea`, `Select`, `Panel`, `Tag`/`Badge`, `Skeleton`, `EmptyState`, `ErrorBox`; `components/icons.tsx` endurecido | Todo o resto consome daqui |
| 3 | **Varredura de emoji** | busca global por emoji em `components/**` e `app/**` | Uma passada mecânica, alto impacto visual, risco quase zero |
| 4 | **Casca do app** | `app/layout.tsx` (header → `AppRail` + `TopBar`), `AgencyNav`, `UserMenu`, `ThemeToggle`, `GlobalSearch`, `JobsIndicator`, `ActivityBell`, `AssistantWidget` (o FAB sai de cima do conteúdo), `SiteFooter` | Resolve o D6 e enquadra todas as telas seguintes |
| 5 | **Workspace do cliente** | `Workspace.tsx`, `SectionTabs.tsx`, `ClientDashboard.tsx`, `PulseOverviewCard`, `ClicksCard`, `PackageUsage`, `ApprovalLinkPanel` | Tela mais usada e a mais danificada (D4, D7) |
| 6 | **Telas de dado** | `app/finance`, `app/insights`, `app/invoices`, `app/production` (`ProjectsTab`), `app/agenda`, `app/calendar` (`TimeTab`) | Onde a densidade `compact` e a `Table` provam o sistema |
| 7 | **As entregas** ⭐ | `MonthlyReportView`, `app/print/report/[token]`, `app/print/[id]`, `ProposalPanel` + `app/proposta/[token]`, `InvoicePayView` + `app/fatura/[token]`, `app/a/[slug]` (página pública), `CarouselTab`, `DeliverableViewer` | **É a tese.** Vem depois da fundação porque depende da §10, e antes do marketing porque é o que a agência mostra ao cliente dela |
| 8 | **Formulários** | `ClientForm`, `ProfessionalForm`, `RegistrationForm`, `AccessRequestForm`, `LeadForm`, `ContactForm`, `app/settings`, `InvoiceSettingsCard`, `BrandVoiceCard` | Depende de `Field`; grande volume, baixa variabilidade |
| 9 | **Portal e aprovação** | `app/portal/client/[id]`, `app/aprovar/[token]`, `ApprovalLinkView`, `ApprovalTimeline`, `PortalInvoicesCard` | Também é cara de cliente; herda quase tudo do bloco 7 |
| 10 | **Marketing** | `components/landing/LandingPage`, `Pricing`, `ShowcaseDemo`, `DifferentiatorsStrip`, `app/para-agencias`, `app/para-marcas`, `app/para-profissionais`, `app/plans`, `components/legal/*` | A reescrita mais pesada (some o hero mock, os blobs, o gradiente, as cinco seções iguais) e a que menos bloqueia as outras |
| 11 | **Entrada e onboarding** | `app/login`, `app/criar-conta`, `app/cadastro`, `app/convite/[token]`, `WelcomeLogin`, `OneTimeLogin`, `OnboardingModal`, `Tour`, `ActivationChecklist`, `LevelUpCelebration`, `MarcaModeChoice` | Volume pequeno, mas é a primeira impressão; depois do marketing para herdar a mesma abertura |
| 12 | **Admin** | `app/admin`, `app/admin/analytics`, `PanelTester` | Público interno; os 13 tiles viram três grupos com uma tabela |
| 13 | **Fechamento** | folha de impressão revisada nas 5 peças, varredura de `focus-visible`, `prefers-reduced-motion`, captura de todas as telas em 1440/390 × claro/escuro para conferência | Só fecha com as telas olhadas, não com o diff lido |

⭐ Se houver tempo para um bloco só, é o 7: é onde o produto deixa de parecer um app genérico e passa
a parecer um estúdio.

---

## 14. Riscos e pontos em aberto

1. **Peso das fontes.** Duas variáveis (Fraunces com 4 eixos + Archivo com 2) no subset `latin`.
   Precisa ser medido depois do primeiro build: se o par passar de ~180KB de woff2, o plano B é
   travar `SOFT`/`WONK` e servir Fraunces só nos passos de display, com Archivo assumindo o `d4`.
2. **`opsz` disciplinado.** O eixo óptico é o melhor argumento do sistema e a coisa mais fácil de
   esquecer. Por isso a §3.3 exige o helper: se alguém escrever `text-5xl` na mão, o `opsz` fica em
   144 e a manchete some. Vale um teste de lint.
3. **Whitelabel em produção.** Trocar `--accent` cru por seis tokens derivados muda a aparência de
   toda agência que já configurou uma cor. A derivação preserva a matiz, mas o tom **muda** quando a
   cor original reprovava — e vai mudar. É uma melhoria, e ainda assim precisa ser avisada.
4. **Tema claro é hoje o parente pobre.** O CSS atual assume escuro por padrão e o claro só troca
   variáveis. Com os dois temas de primeira classe, cada tela do bloco correspondente precisa ser
   vista nos dois — o que dobra a conferência visual.
5. **`0` versus `—`.** A regra da §9.2 tem consequência de backend: várias rotas devolvem `0` onde a
   verdade é "sem dado". A troca para `null` precisa ser feita rota a rota, e está fora do escopo do
   design system.
6. **Emoji no e-mail e no WhatsApp.** A varredura do bloco 3 é só da interface. Notificação, e-mail e
   mensagem do atendente são outro canal, com outra norma — não mexer sem decidir separadamente.
7. **Confetes do level-up.** Mantidos como funcionalidade, mas a regra "nunca por cima de peça de
   cliente" precisa de uma checagem de rota no componente, que hoje não existe.
8. **`overflow-x: hidden` no `body`.** O CSS atual esconde rolagem lateral globalmente, o que mascara
   estouro em vez de corrigir. Some na fundação — e isso vai **revelar** estouros hoje invisíveis em
   telas que ninguém sabia que estavam quebradas. É bom, mas gera trabalho não previsto.
9. **Não verificado nesta rodada:** nenhum teste com leitor de tela; nenhum PDF realmente impresso;
   nenhuma medição de CLS/LCP com as fontes novas; nenhuma tela do portal do cliente, do profissional
   ou do fluxo de aprovação foi capturada (a auditoria cobriu landing, funil, planos, home da
   agência, workspace, formulário, finance, calendário, relatório, faturas, ajustes e admin).

---

## 15. Estado da implementação

A fundação (bloco 1 da §13) e as primitivas (bloco 2) estão no código, na branch
`feat/design-system`. O que está feito, o que mudou de rota e o que ainda não foi verificado:

**Feito**

- `lib/brand-ramp.ts` + `tests/unit/brand-ramp.test.ts` (28 testes): a derivação da §5.4 com os
  pisos verificados nos nove hexes, nos dois temas. Os valores caem dentro de um degrau de 8 bits
  da tabela da §5.4 (`#C65100` contra `#C75100`, `#ED2466` contra `#EC2365`) — mesmo algoritmo,
  passo de busca diferente. O que o teste garante é o piso, não o hex exato.
- `app/globals.css`: rampa Tinta, papéis nos dois temas, semântica, profundidade, densidade como
  token de contêiner, movimento sem laço, e a folha de impressão da §10.
- `app/layout.tsx`: Fraunces + Archivo por `next/font/google`, com as pilhas de fallback que
  permitem ao Next calcular o `size-adjust`. O `--accent` cru deu lugar aos nove tokens de
  `brandStyle()`.
- `lib/type.ts`: `displayStyle(px)` com o `opsz` já correto, `tabular`, `condensed`, `EM_DASH`.
- `components/ui.tsx`: o inventário da §11 com os estados obrigatórios; os nomes antigos
  continuam exportados com a mesma assinatura.
- `components/icons.tsx`: uma espessura, três tamanhos (o que chegar é arredondado), `IconName`
  virou união de verdade.
- `app/design`: a galeria, fora do sitemap e negada no `robots.ts`.

**Decisões tomadas na implementação, que divergem ou precisam do texto acima**

1. **Ponte de compatibilidade em vez de varredura.** Os nomes antigos (`--accent`, `--edge`,
   `bg-surface-2`, `text-muted`, `--font-display`) passaram a APONTAR para os tokens novos. É o
   que faz a correção de contraste valer em 300 telas sem reescrevê-las no mesmo commit. Cada
   bloco da §13 troca os nomes na sua vez.
2. **`rounded-xl`/`2xl`/`3xl` colapsaram em `r-md` no tema do Tailwind**, em vez de serem
   removidos classe a classe. O proibido da §4.5 continua proibido em código novo; o que já
   existe deixou de parecer um bloco de balas sem uma varredura de 53 arquivos.
3. **O alvo de toque de 40×40 virou área transparente (`::after`), não altura mínima.** Com
   `min-height` as duas densidades renderizavam idênticas — o `compact` só existe se o botão
   desenhado tiver mesmo 32px.
4. **`FormGrid` reserva a linha da dica.** Dois campos lado a lado, um com dica e outro sem,
   colocavam os controles em linhas de base diferentes. A grade reserva a linha para todos.
5. **O `Select` é o nativo com moldura nossa** (`appearance: none`, altura, borda e seta do
   sistema), não uma listbox reescrita. O que a §11.2 proíbe é o widget cru do sistema
   operacional no meio de inputs customizados; o teclado nativo é melhor do que o que
   reimplementaríamos.
6. **`overflow-x: hidden` saiu do `body`**, como manda o risco 8 da §14 — e isso pode revelar
   estouro lateral em telas que ninguém sabia que estavam quebradas.

**Não feito nesta rodada, e dito com todas as letras**

- A varredura de emoji (bloco 3) **não** foi feita. Medido: 886 ocorrências em 151 arquivos, com
  393 só em `lib/ui-dict.ts`, e `😀😐😞` são valores de dado do Pulso, com asserção em e2e. Não é
  uma troca mecânica como a §13 supunha.
- Nenhuma tela de produto foi redesenhada (blocos 4 a 12).
- Nenhum teste com leitor de tela, nenhum PDF realmente impresso, e nenhuma medição de CLS/LCP
  com as fontes novas.

**O peso das fontes — medido, e acima do gatilho da §14.1**

Lido do build de produção (`.next/static/media/*.woff2`, agrupado pelo `unicode-range` de cada
`@font-face`):

| Subset | Fraunces | Archivo | Soma |
|---|---|---|---|
| latin (o que o pt-BR baixa) | **118,0 KB** | **88,0 KB** | **206,0 KB** |
| latin-ext (só se o texto pedir) | 103,0 KB | 83,8 KB | 186,8 KB |
| vietnamese (idem) | 33,5 KB | 33,6 KB | 67,1 KB |

O `subsets: ["latin"]` não impede o Next de emitir os três arquivos; ele emite os três e deixa o
navegador escolher pelo `unicode-range`. Uma página em pt-BR baixa **206 KB**, contra o gatilho de
~180 KB que a §14.1 tinha estipulado para acionar o plano B (travar `SOFT`/`WONK` e servir Fraunces
só nos passos de display). Está acima, e por uma margem pequena.

Decisão tomada: **manter os quatro eixos por enquanto**, com `display: swap` e as métricas de
fallback ligadas, e reavaliar com uma medição de LCP real em vez de um número de KB — que é o
critério que interessa. O plano B continua escrito e continua disponível; o que falta é o dado que
justifica acioná-lo.

---

## 15. Referências de estudo

Estudadas pela **hierarquia, o espaço em branco e a contenção da cor de marca**, nunca por asset ou
texto copiado: Linear e o painel da Vercel (densidade e estado), a tipografia do Notion, o navegador
de arquivos do Figma, Pitch e Superlist (ritmo editorial dentro de produto), e, no lado das
ferramentas de agência, Planable, Later, AgencyAnalytics e Reportei (layout de relatório e como a cor
do cliente entra numa peça sem tomar conta dela).

Fontes técnicas dos eixos e das features citadas:
[Fraunces (Google Fonts)](https://fonts.google.com/specimen/Fraunces/about),
[Fraunces no GitHub](https://github.com/undercasetype/Fraunces),
[Archivo (Omnibus-Type)](https://www.omnibus-type.com/variable-fonts/),
[OpenType features na web (Google Fonts Knowledge)](https://fonts.google.com/knowledge/using_type/implementing_open_type_features_on_the_web),
[`font-variant-numeric` (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric).
