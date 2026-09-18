"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  Breadcrumb,
  Button,
  ButtonGroup,
  Checkbox,
  ChipGroup,
  Dash,
  Density,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  FormGrid,
  IconButton,
  Input,
  InputAffix,
  KPI,
  LinkText,
  Pagination,
  Panel,
  Progress,
  Radio,
  Select,
  Skeleton,
  StatusDot,
  Switch,
  Table,
  Tabs,
  Textarea,
  Toast,
  Tooltip,
  type Tone,
} from "@/components/ui";
import { brandRamp, contrast, SURFACE_DARK, SURFACE_LIGHT } from "@/lib/brand-ramp";
import { displayStyle } from "@/lib/type";

/* -------------------------------------------------------------------------- */

function Section({
  n,
  title,
  lede,
  children,
}: {
  n: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-8 pb-16">
      {/* Grade editorial `doc`: 8 + 4. O texto corrente à esquerda, a âncora
          numérica no trilho — a numeração é tabular porque é número. */}
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-12">
        <div className="md:col-span-2">
          <p className="n3 text-text-faint">{n}</p>
        </div>
        {/* min-w-0: um item de grade tem min-width:auto e estica a coluna para
            caber o conteúdo mais largo — é o que faz a peça de 160mm empurrar a
            página inteira para o lado no celular. */}
        <div className="min-w-0 md:col-span-10">
          <h2 className="d3 mb-2">{title}</h2>
          {lede && <p className="t2 measure-prose text-text-muted">{lede}</p>}
          <div className="mt-8 grid min-w-0 grid-cols-1 gap-8">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // min-w-0 em toda caixa que hospeda um rolador: um item de grade tem
    // min-width:auto e estica até caber o conteúdo, e aí quem rola é a página.
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <h3 className="t6 text-text-muted">{label}</h3>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="t5 measure-prose text-text-muted">{children}</p>;
}

/* -------------------------------------------------------------------------- */

const NEUTRALS = [
  "0", "25", "50", "100", "150", "200", "300", "400",
  "500", "600", "700", "800", "850", "900", "950",
];

const BRAND_CASES = ["#F76B15", "#0F62FE", "#00A86B", "#FFD400", "#E91E63", "#00E5FF", "#FFFFFF"];

type Row = { id: string; cliente: string; entregue: string; horas: string; receita: string; margem: number | null };

const ROWS: Row[] = [
  { id: "1", cliente: "Padaria Aurora", entregue: "12 de 14", horas: "18h30", receita: "4.200,00", margem: 38.4 },
  { id: "2", cliente: "Clínica Vestíbulo", entregue: "8 de 8", horas: "9h15", receita: "2.780,00", margem: 61.2 },
  { id: "3", cliente: "Marcenaria Tarde", entregue: "3 de 11", horas: "22h00", receita: "3.100,00", margem: -4.8 },
  { id: "4", cliente: "Instituto Corrente", entregue: "—", horas: "—", receita: "—", margem: null },
];

const COLUMNS = [
  { key: "cliente", header: "Cliente", width: "38%", cell: (r: Row) => r.cliente },
  { key: "entregue", header: "Entregue", width: "16%", align: "right" as const, cell: (r: Row) => r.entregue },
  { key: "horas", header: "Horas", width: "14%", align: "right" as const, cell: (r: Row) => r.horas },
  { key: "receita", header: "Receita", width: "18%", align: "right" as const, cell: (r: Row) => r.receita },
  {
    key: "margem",
    header: "Margem",
    width: "14%",
    align: "right" as const,
    cell: (r: Row) =>
      r.margem === null ? <Dash /> : <span className={r.margem < 0 ? "text-negative" : undefined}>{r.margem.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%</span>,
  },
];

export default function Gallery() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(false);
  const [tab, setTab] = useState("entregas");
  const [chips, setChips] = useState<string[]>(["instagram"]);
  const [on, setOn] = useState(true);
  const [page, setPage] = useState(2);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 md:px-8">
      {/* Abertura — grade `lead` 7+5: manchete à esquerda, dado à direita. */}
      <header className="grid gap-x-6 gap-y-8 pt-12 pb-16 md:grid-cols-12">
        <div className="min-w-0 md:col-span-7">
          <p className="t6 mb-4 text-text-muted">Marqa · sistema de desenho</p>
          <h1 className="d1">Estúdio editorial</h1>
          <p className="t1 measure-lede mt-6 text-text-muted">
            A tipografia carrega a hierarquia, a grade carrega o ritmo, e a cor da agência aparece
            uma vez por tela — no lugar que decide.
          </p>
        </div>
        <div className="grid min-w-0 content-end gap-4 md:col-span-4 md:col-start-9">
          <div className="border-t border-edge pt-3">
            <p className="t5 text-text-muted">Famílias</p>
            <p className="t3 text-text">Fraunces · Archivo</p>
          </div>
          <div className="border-t border-edge pt-3">
            <p className="t5 text-text-muted">Passos de escala</p>
            <p className="n3 text-text">13</p>
          </div>
          <div className="border-t border-edge pt-3">
            <p className="t5 text-text-muted">Piso de contraste</p>
            <p className="n3 text-text">4,5:1 texto · 3:1 borda</p>
          </div>
        </div>
      </header>

      <Section
        n="01"
        title="Tipografia"
        lede="Duas variáveis e uma pilha de sistema. O eixo óptico do Fraunces acompanha o tamanho renderizado — é o que faz uma manchete de 72px e um olho de 11px serem desenhos diferentes, e não a mesma letra esticada."
      >
        <Block label="Display — Fraunces, opsz = tamanho">
          <div className="grid gap-6">
            {[
              { t: "d1", px: 72, use: "capa de relatório, hero da página pública" },
              { t: "d2", px: 48, use: "abertura de seção editorial" },
              { t: "d3", px: 32, use: "título de página, capítulo" },
              { t: "d4", px: 24, use: "título de painel" },
            ].map((s) => (
              <div key={s.t} className="grid items-baseline gap-2 border-b border-rule pb-5 md:grid-cols-12">
                <div className="flex gap-3 md:col-span-2">
                  <span className="t5 text-text">{s.t}</span>
                  <span className="n3 text-text-faint">{s.px}</span>
                </div>
                <p className={`${s.t} md:col-span-7`}>Relatório de setembro</p>
                <p className="t5 text-text-muted md:col-span-3">{s.use}</p>
              </div>
            ))}
          </div>
          <Note>
            Fora da escala, <code className="font-mono text-text">displayStyle(px)</code> — nunca um
            font-size na mão, que deixaria o opsz em 14 e faria a manchete sumir. Abaixo, 56px pela
            função, com SOFT 20 como na capa de proposta.
          </Note>
          <p style={displayStyle(56, { soft: 20 })}>Proposta comercial</p>
        </Block>

        <Block label="Texto e UI — Archivo">
          <div className="grid gap-4">
            {[
              { t: "t1", d: "lede · 20/30 · 62ch" },
              { t: "t2", d: "corpo · 16/26 · 68ch" },
              { t: "t3", d: "padrão da interface · 14/20" },
              { t: "t4", d: "célula de tabela · 13/18" },
              { t: "t5", d: "legenda, cabeçalho, label de formulário · 12/16" },
              { t: "t6", d: "eyebrow · 11/12 · o único com caixa alta" },
            ].map((s) => (
              <div key={s.t} className="grid items-baseline gap-2 border-b border-rule pb-3 md:grid-cols-12">
                <span className="t5 text-text md:col-span-1">{s.t}</span>
                <p className={`${s.t} measure-prose md:col-span-7`}>
                  A agência entrega, o cliente aprova, o relatório sai no dia primeiro.
                </p>
                <p className="t5 text-text-muted md:col-span-4">{s.d}</p>
              </div>
            ))}
          </div>
          <Note>
            Caixa alta é exclusividade do t6, no máximo um por seção. Label de formulário é t5 em
            caixa de sentença — é o que mata um estilo servindo a quatro papéis.
          </Note>
        </Block>

        <Block label="Números — Archivo com figura tabular">
          <div className="grid min-w-0 gap-6 md:grid-cols-2">
            <div>
              <p className="t5 mb-2 text-text-muted">Tabular (o sistema)</p>
              <p className="n2 leading-8">1111111111</p>
              <p className="n2 leading-8">0000000000</p>
              <p className="n2 leading-8">4.280.900,00</p>
            </div>
            <div>
              <p className="t5 mb-2 text-text-muted">Proporcional (o que não entra em coluna)</p>
              <p className="n2 leading-8" style={{ fontVariantNumeric: "proportional-nums" }}>1111111111</p>
              <p className="n2 leading-8" style={{ fontVariantNumeric: "proportional-nums" }}>0000000000</p>
              <p className="n2 leading-8" style={{ fontVariantNumeric: "proportional-nums" }}>4.280.900,00</p>
            </div>
          </div>
          <Note>
            Fraunces ignora <code className="font-mono text-text">tabular-nums</code> — medido: mais
            de 80px de deriva em dez dígitos a 40px. Por isso n1–n3 são de texto, mesmo no passo de
            36px, e nenhum número que se compara entra em display.
          </Note>
        </Block>
      </Section>

      <Section
        n="02"
        title="Cor"
        lede="Uma rampa neutra quente, três cores semânticas que só descrevem estado, e uma cor expressiva — a da agência — com orçamento de um elemento por tela."
      >
        <Block label="Rampa Tinta">
          {/* Uma rampa que quebra em três fileiras deixa de ser uma rampa: no
              celular ela rola, e continua sendo uma faixa contínua. */}
          <div className="flex gap-0 overflow-x-auto">
            {NEUTRALS.map((n) => (
              <div key={n} className="w-[6.25%] min-w-[54px] shrink-0">
                <div className="h-14 border-r border-b border-[rgba(0,0,0,.06)]" style={{ background: `var(--n-${n})` }} />
                <p className="t5 tnum pt-1 text-text-muted">{n}</p>
              </div>
            ))}
          </div>
          <Note>
            Cinza quente, não o preto-azulado de gerador de tema. Papel tem temperatura.
          </Note>
        </Block>

        <Block label="Papéis — os dois temas são de primeira classe">
          <div className="grid gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-2">
            {[
              { k: "text", c: "text-text", n: "18,20 / 16,42" },
              { k: "text-muted", c: "text-text-muted", n: "5,60 / 4,97" },
              { k: "text-faint", c: "text-text-faint", n: "3,66 / 3,25" },
              { k: "edge (estrutural)", c: "text-text", n: "3,66 / 3,25 — delimita input e seleção" },
              { k: "rule (decorativa)", c: "text-text", n: "1,42 / 1,54 — nunca sozinha" },
              { k: "brand-text", c: "text-brand-text", n: ">= 4,5 nos dois temas, por derivação" },
            ].map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-4 bg-surface px-4 py-3">
                <span className={`t3 ${r.c}`}>{r.k}</span>
                <span className="t5 tnum text-text-muted">{r.n}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block label="Semântica — só estado">
          <div className="flex flex-wrap gap-3">
            {(["positive", "caution", "negative"] as Tone[]).map((t) => (
              <Badge key={t} tone={t}>
                {t === "positive" ? "Aprovado" : t === "caution" ? "Aguardando" : "Vencido"}
              </Badge>
            ))}
          </div>
          <Note>
            Não existe azul de &ldquo;info&rdquo;: a informação é a marca. Um KPI não é verde porque
            é um KPI.
          </Note>
        </Block>

        <Block label="Whitelabel — a cor da agência com garantia">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] table-fixed border-collapse">
              <thead>
                <tr>
                  {["Marca", "Sólido + tinta", "Texto no claro", "Texto no escuro", "Campo"].map((h, i) => (
                    <th key={h} className={`t5 border-b border-edge px-3 py-2 font-medium text-text-muted ${i === 0 ? "text-left" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRAND_CASES.map((hex) => {
                  const l = brandRamp(hex, "light");
                  const d = brandRamp(hex, "dark");
                  return (
                    <tr key={hex}>
                      <td className="px-3 py-2 shadow-[inset_0_-1px_0_var(--rule)]">
                        <span className="t4 inline-flex items-center gap-2">
                          <span className="size-4 rounded-xs border border-rule" style={{ background: hex }} />
                          <span className="font-mono">{hex}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right shadow-[inset_0_-1px_0_var(--rule)]">
                        <span className="t5 inline-flex items-center gap-2 rounded-sm border border-rule px-2 py-1" style={{ background: l.brandSolid, color: l.brandInk }}>
                          Gerar
                          <span className="tnum">{contrast(l.brandSolid, l.brandInk).toFixed(2)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right shadow-[inset_0_-1px_0_var(--rule)]">
                        <span className="n3 inline-block rounded-sm px-2 py-1" style={{ background: SURFACE_LIGHT, color: l.brandText }}>
                          {contrast(l.brandText, SURFACE_LIGHT).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right shadow-[inset_0_-1px_0_var(--rule)]">
                        <span className="n3 inline-block rounded-sm px-2 py-1" style={{ background: SURFACE_DARK, color: d.brandText }}>
                          {contrast(d.brandText, SURFACE_DARK).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right shadow-[inset_0_-1px_0_var(--rule)]">
                        <span className="t5 inline-block rounded-sm px-2 py-1" style={{ background: l.brandWash, color: "var(--n-900)" }}>
                          campo
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Note>
            Só o L se move, em OKLCH, com o croma cortado em gamut por busca binária: a matiz é da
            agência. #E91E63 prova a necessidade (o rosa cru dá 4,40:1 e o sólido é deslocado);
            #FFFFFF mostra o limite — a marca branca vive como campo, nunca como texto.
          </Note>
        </Block>
      </Section>

      <Section
        n="03"
        title="Grade, raio e profundidade"
        lede="Três grades — editorial, ferramenta e documento. O raio diz o que a coisa é. A sombra é o último recurso, e só para o que de fato flutua."
      >
        <Block label="Splits da grade editorial">
          {[
            { n: "lead 7+5", a: 7, b: 5 },
            { n: "lead-rev 5+7", a: 5, b: 7 },
            { n: "doc 8+4", a: 8, b: 4 },
          ].map((g) => (
            <div key={g.n} className="grid gap-2">
              <p className="t5 text-text-muted">{g.n}</p>
              <div className="grid grid-cols-12 gap-1.5">
                <div className="h-8 bg-[var(--n-200)]" style={{ gridColumn: `span ${g.a}` }} />
                <div className="h-8 border border-edge" style={{ gridColumn: `span ${g.b}` }} />
              </div>
            </div>
          ))}
          <Note>Duas seções seguidas nunca repetem o split — foi esse o erro da landing atual.</Note>
        </Block>

        <Block label="Raio é sinal">
          <div className="flex flex-wrap items-end gap-6">
            {[
              { r: "rounded-none", l: "tabela, documento, impressão" },
              { r: "rounded-sm", l: "input, botão, badge" },
              { r: "rounded-md", l: "painel, menu, diálogo" },
              { r: "rounded-full", l: "avatar, ponto de status" },
            ].map((x) => (
              <div key={x.r} className="grid gap-2">
                <div className={`size-16 border border-edge bg-surface-sunken ${x.r}`} />
                <p className="t5 text-text">{x.r}</p>
                <p className="t5 text-text-faint">{x.l}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block label="Profundidade">
          <div className="flex flex-wrap gap-6">
            <div className="grid h-24 w-56 place-items-center rounded-md border border-rule bg-surface">
              <p className="t5 text-text-muted">painel — sem sombra</p>
            </div>
            <div className="grid h-24 w-56 place-items-center rounded-md border border-rule bg-surface shadow-e1">
              <p className="t5 text-text-muted">e1 — menu, tooltip</p>
            </div>
            <div className="grid h-24 w-56 place-items-center rounded-md border border-rule bg-surface shadow-e2">
              <p className="t5 text-text-muted">e2 — diálogo, gaveta</p>
            </div>
          </div>
        </Block>
      </Section>

      <Section
        n="04"
        title="Ação"
        lede="Um primary por região. O disabled cai para tinta esmaecida em campo rebaixado, sem opacidade global — opacidade quebra o contraste do rótulo."
      >
        {(["comfortable", "compact"] as const).map((d) => (
          <Density key={d} value={d} className="grid min-w-0 grid-cols-1 gap-3">
            <h3 className="t6 text-text-muted">{d}</h3>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-rule bg-surface p-[var(--pad-x)]">
              <Button>Gerar relatório</Button>
              <Button variant="secondary">Pré-visualizar</Button>
              <Button variant="quiet">Cancelar</Button>
              <Button variant="danger" icon="trash">Excluir</Button>
              <Button loading>Gerar relatório</Button>
              <Button disabled>Indisponível</Button>
              <ButtonGroup>
                <Button variant="secondary">Mês</Button>
                <Button variant="secondary">Trimestre</Button>
                <Button variant="secondary">Ano</Button>
              </ButtonGroup>
              <IconButton name="settings" label="Configurações" />
              <IconButton name="trash" label="Excluir" variant="danger" />
              <Tooltip text="O relatório sai em PDF">
                <Button variant="secondary" icon="download">PDF</Button>
              </Tooltip>
            </div>
          </Density>
        ))}
        <Note>
          Alvo de toque mínimo de 40×40 em qualquer densidade: no compact o botão tem 32px visíveis
          e o resto entra como padding transparente. O anel de foco é global — navegue por Tab.
        </Note>
        <div className="flex flex-wrap items-center gap-4">
          <LinkText href="#">link em prosa, sublinhado sempre visível</LinkText>
          <LinkText href="#" quiet>link de UI, sublinhado no hover</LinkText>
        </div>
      </Section>

      <Section
        n="05"
        title="Entrada"
        lede="A instrução vai acima do controle — dentro do placeholder ela some justamente no foco, que é quando é lida. A largura do campo comunica o conteúdo esperado."
      >
        <FormGrid className="rounded-md border border-rule bg-surface p-6">
          <Field label="Nome do cliente" hint="Como aparece no relatório e na proposta." required>
            {(p) => <Input placeholder="Padaria Aurora" {...p} />}
          </Field>
          <Field label="E-mail de aprovação" error="Endereço inválido: falta o domínio.">
            {(p) => <Input defaultValue="contato@" {...p} />}
          </Field>
          <Field label="Margem-alvo" width="pct" hint="Percentual.">
            {(p) => <InputAffix suffix="%" defaultValue="38" {...p} />}
          </Field>
          <Field label="Orçamento mensal" width="money">
            {(p) => <InputAffix prefix="R$" defaultValue="4.200,00" {...p} />}
          </Field>
          <Field label="Canal principal">
            {(p) => (
              <Select defaultValue="instagram" {...p}>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            )}
          </Field>
          <Field label="Identificador" hint="Gerado pelo sistema.">
            {(p) => <Input readOnly defaultValue="cli_8f21c0" className="font-mono" {...p} />}
          </Field>
          <Field label="Contexto da marca" counter="128/600" width="full">
            {(p) => <Textarea rows={3} placeholder="O que a marca faz, para quem, e o que não pode ser dito." {...p} />}
          </Field>
          <div className="grid content-start gap-2">
            <Field label="Campo desligado">
              {(p) => <Input disabled defaultValue="Sem permissão" {...p} />}
            </Field>
            <Checkbox label="Enviar resumo semanal" defaultChecked />
            <Checkbox label="Incluir concorrentes" indeterminate />
            <Radio name="g" label="Aprovação por link" defaultChecked />
            <Radio name="g" label="Aprovação no portal" />
            <Switch checked={on} onChange={setOn} label="Publicar página pública" />
          </div>
          <div className="md:col-span-2">
            <p className="t5 mb-2 text-text">Canais do pacote</p>
            <ChipGroup
              label="Canais do pacote"
              value={chips}
              onChange={setChips}
              options={[
                { value: "instagram", label: "Instagram" },
                { value: "linkedin", label: "LinkedIn" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "E-mail" },
              ]}
            />
          </div>
        </FormGrid>
      </Section>

      <Section
        n="06"
        title="Estrutura"
        lede="Uma metáfora de navegação só: o sublinhado de 2px. O painel é o único cartão, e não flutua."
      >
        <Breadcrumb items={[{ label: "Clientes", href: "#" }, { label: "Padaria Aurora", href: "#" }, { label: "Setembro" }]} />
        <Tabs
          label="Seções do cliente"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "entregas", label: "Entregas", count: 12 },
            { value: "calendario", label: "Calendário" },
            { value: "aprovacoes", label: "Aprovações", count: 3 },
            { value: "relatorio", label: "Relatório" },
          ]}
        />
        <div className="grid gap-4 md:grid-cols-12">
          <Panel title="Pulso do cliente" actions={<IconButton name="settings" label="Ajustar" size={16} />} className="md:col-span-8">
            <p className="t3 measure-ui text-text-muted">
              Painel: superfície, régua de 1px, raio de 6px, e nenhuma sombra. Um cartão de conteúdo
              não flutua acima da página — quem separa é o espaço, depois o degrau tonal, depois a
              régua.
            </p>
          </Panel>
          <div className="grid gap-4 md:col-span-4">
            <Panel>
              <KPI label="Entregues no mês" value="12" delta={12.4} note="de 14 planejados" />
            </Panel>
            <Panel>
              <KPI label="Receita atribuída" value="R$ 4.200" delta={-8.1} />
            </Panel>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>Abrir diálogo</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>Abrir gaveta</Button>
          <Button variant="secondary" onClick={() => setToast(true)}>Mostrar aviso</Button>
        </div>
      </Section>

      <Section
        n="07"
        title="Dados"
        lede="A tabela é a superfície: sem cartão em volta, sem zebra, largura de coluna declarada, cabeçalho alinhado igual à célula, e travessão onde não há dado."
      >
        <Density value="compact" className="grid min-w-0 grid-cols-1 gap-3">
          <h3 className="t6 text-text-muted">compact — a tela de margem</h3>
          <div className="min-w-0 bg-surface">
            <Table
              caption="Margem por cliente"
              columns={COLUMNS}
              rows={ROWS}
              rowKey={(r) => r.id}
              total={["Total", "23 de 33", "49h45", "10.080,00", "31,6%"]}
            />
          </div>
        </Density>
        <Density value="comfortable" className="grid min-w-0 grid-cols-1 gap-3">
          <h3 className="t6 text-text-muted">comfortable — a mesma tabela no relatório</h3>
          <div className="min-w-0 bg-surface">
            <Table caption="Margem por cliente" columns={COLUMNS} rows={ROWS.slice(0, 2)} rowKey={(r) => r.id} />
          </div>
        </Density>
        <Block label="Carregando — as mesmas larguras de coluna">
          <div className="min-w-0 bg-surface">
            <Table caption="Carregando" columns={COLUMNS} rows={[]} rowKey={() => ""} loading />
          </div>
        </Block>
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <Block label="Vazio — forma fixa">
            <EmptyState
              icon="calendar"
              title="As reuniões marcadas com este cliente aparecem aqui."
              condition="Conecte o Google Agenda para que a Marqa leia os horários."
              action={<Button variant="secondary">Conectar agenda</Button>}
            />
          </Block>
          <Block label="Esqueleto — a mesma caixa do conteúdo final">
            <div className="grid gap-2 rounded-md border border-rule bg-surface p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </Block>
        </div>
        <Block label="Sinais">
          <div className="flex flex-wrap items-center gap-5 rounded-md border border-rule bg-surface p-5">
            <StatusDot tone="positive" label="Publicado" />
            <StatusDot tone="caution" label="Aguardando cliente" />
            <StatusDot tone="negative" label="Recusado" />
            <StatusDot label="Rascunho" />
            <Badge tone="positive">Pago</Badge>
            <Badge tone="caution">Vence em 3 dias</Badge>
            <Badge tone="negative">Vencido</Badge>
            <Badge>12 coins</Badge>
            <Avatar name="Padaria Aurora" />
            <span className="t3">
              Sem dado: <Dash />
            </span>
          </div>
        </Block>
        <div className="grid min-w-0 gap-8">
          <div className="max-w-[360px]">
            <Progress value={72.5} label="Pacote consumido" />
          </div>
          <Pagination page={page} pages={7} onChange={setPage} />
        </div>
        <Block label="Retorno">
          <div className="grid gap-3">
            <Banner tone="positive" title="Relatório enviado" action={<Button variant="quiet">Ver</Button>}>
              O cliente recebeu o link por e-mail às 09h14.
            </Banner>
            <Banner tone="caution" title="Faltam 2 aprovações para fechar o mês" />
            <Banner tone="negative" title="Não foi possível gerar o relatório">
              A conta do Instagram perdeu a permissão de leitura. Reconecte para continuar.
            </Banner>
            <Banner title="Nenhuma métrica conectada ainda.">
              Enquanto isso o relatório sai só com as entregas.
            </Banner>
          </div>
        </Block>
      </Section>

      <Section
        n="08"
        title="Documento"
        lede="O que a agência mostra ao cliente dela é diagramado como publicação: capa, régua da marca, mancha de 160mm e folha de impressão de verdade. A pré-visualização usa a mesma mancha do papel."
      >
        <div className="doc rounded-none border border-rule px-10 py-12">
          <div className="doc-cover">
            <p className="t6 text-[var(--n-500)]">Relatório mensal · setembro de 2026</p>
            <h3 className="d2 mt-3 text-[var(--n-900)]">Padaria Aurora</h3>
            <div className="doc-rule mt-6 w-full" />
            <div className="mt-6 flex items-baseline justify-between">
              <p className="t5 text-[var(--n-500)]">por Marqa</p>
              <p className="n3 text-[var(--n-500)]">01</p>
            </div>
          </div>
          <p className="t2 prose-doc mt-10 text-[var(--n-900)]">
            &ldquo;Setembro fechou com doze das quatorze entregas publicadas. O que puxou o resultado
            foi a série de receitas da manhã: três dos quatro melhores posts do mês vieram dela, e o
            custo por peça caiu porque o roteiro passou a ser reaproveitado no carrossel.&rdquo;
          </p>
          <div className="mt-8 grid grid-cols-3 gap-6 border-t border-[var(--n-150)] pt-6">
            <div className="doc-kpi">
              <p className="t5 text-[var(--n-500)]">Entregues</p>
              <p className="n2 text-[var(--n-900)]">12</p>
            </div>
            <div className="doc-kpi">
              <p className="t5 text-[var(--n-500)]">Alcance</p>
              <p className="n2 text-[var(--n-900)]">38.412</p>
            </div>
            <div className="doc-kpi">
              <p className="t5 text-[var(--n-500)]">Custo por peça</p>
              <p className="n2 text-[var(--n-900)]">R$ 91,30</p>
            </div>
          </div>
          <p className="t5 mt-8 text-[var(--n-500)]">
            Fig. 1 · Entregas por semana. Fonte: publicações confirmadas no Instagram, leitura de 01
            a 30 de setembro.
          </p>
        </div>
        <Note>
          A peça nunca herda o tema escuro, e o FAB do assistente e a navegação do app não existem
          dentro dela. Imprima esta página (Ctrl+P) para ver a folha A4 com a mancha de 160mm.
        </Note>
      </Section>

      <Section
        n="09"
        title="Movimento"
        lede="Três durações, uma curva, e nada em loop. Saíram float, glow-pulse, gradient-pan, marquee e o brilho infinito do esqueleto."
      >
        <div className="grid gap-2">
          {[
            { t: "dur-1 · 90ms", d: "estado: hover, foco, pressionado" },
            { t: "dur-2 · 160ms", d: "revelar: menu, tooltip, sublinhado de aba" },
            { t: "dur-3 · 240ms", d: "camada: diálogo, gaveta, aviso" },
          ].map((m) => (
            <div key={m.t} className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
              <span className="t3 text-text">{m.t}</span>
              <span className="t5 text-text-muted">{m.d}</span>
            </div>
          ))}
        </div>
        <Note>
          Com <code className="font-mono text-text">prefers-reduced-motion: reduce</code> as durações
          viram 1ms, o esqueleto fica parado e a comemoração vira um selo estático.
        </Note>
      </Section>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Enviar relatório ao cliente"
        footer={
          <>
            <Button variant="quiet" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => setDialog(false)}>Enviar</Button>
          </>
        }
      >
        <p className="t3 measure-ui text-text-muted">
          O cliente recebe um link com a versão de leitura. Foco preso no diálogo, Esc fecha, e o
          primeiro elemento focável recebe o cursor de teclado ao abrir.
        </p>
      </Dialog>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Detalhe da entrega">
        <p className="t3 text-text-muted">Gaveta de 420px, mesma regra de foco do diálogo.</p>
      </Drawer>
      {toast && <Toast tone="positive" onClose={() => setToast(false)}>Relatório enviado.</Toast>}
    </div>
  );
}
