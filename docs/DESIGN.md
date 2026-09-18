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

**Texto e UI — `Archivo`** (Omnibus-Type). Grotesca variável com `wght 100–900` e `wdth 62.5–125`.

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

**Números: não há terceira família.** Toda tabela, KPI, moeda e porcentagem usa Archivo com
`font-variant-numeric: tabular-nums lining-nums`. Uma família a menos na rede e nenhuma quebra de
ritmo de cor dentro da tabela.

Subset `latin` cobre o pt-BR inteiro (ã õ ç á é í ó ú â ê ô à). `latin-ext` só entra se surgir copy
em idioma que precise.

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
