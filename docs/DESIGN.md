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
