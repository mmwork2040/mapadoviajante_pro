import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AirplaneTilt,
  CalendarBlank,
  ChatCircleDots,
  Check,
  FileText,
  Kanban,
  ListBullets,
  MagnifyingGlass,
  Moon,
  Phone,
  Plus,
  SquaresFour,
  Sun,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  ActionSheet,
  Avatar,
  Button,
  Card,
  Chip,
  ColumnChart,
  DataTable,
  Empty,
  ErrorBox,
  Field,
  FilterChip,
  Funnel,
  Glass,
  HBars,
  HighlightCard,
  History,
  IconBox,
  IconButton,
  Janela,
  JourneySteps,
  KpiRow,
  Meter,
  Mini,
  PageTitle,
  PhotoHero,
  Progress,
  SearchInput,
  SectionHeader,
  Seg,
  SegBar,
  SelectField,
  SidePanel,
  Skeleton,
  Switch,
  Tabs,
  TextField,
  Tick,
  ViewSwitcher,
} from "@/components/ds";
import { BrandLogo } from "@/components/BrandLogo";
import { Avisos } from "@/components/ds/aviso";
import { PRODUCT, applyBrandColor, normalizeHex } from "@/lib/brand";
import { useTheme } from "@/lib/ui";

// Página interna de revisão visual do design system. Não tem dado de verdade:
// tudo aqui é exemplo, só para conferir as peças contra o protótipo aprovado.
export const Route = createFileRoute("/dev/ui")({
  ssr: false,
  head: () => ({ meta: [{ title: `Design system — ${PRODUCT.name}` }, { name: "robots", content: "noindex" }] }),
  component: DevUi,
});

// "Foto" de exemplo desenhada em SVG, para ver o véu e o vidro sem depender de imagem externa.
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 500' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f4b678'/><stop offset='.55' stop-color='#d9785a'/><stop offset='1' stop-color='#5b3550'/></linearGradient></defs><rect width='1200' height='500' fill='url(#c)'/><circle cx='860' cy='210' r='70' fill='#ffe2b0' opacity='.9'/><path d='M0 360 L180 250 L330 340 L520 210 L700 350 L880 270 L1040 350 L1200 290 V500 H0Z' fill='#3d2740'/><path d='M0 420 L220 330 L420 410 L640 320 L860 420 L1200 360 V500 H0Z' fill='#24182a'/></svg>`,
  );

type Row = { id: string; quem: string; destino: string; etapa: string; valor: number | null; dias: number };
const ROWS: Row[] = [
  { id: "1", quem: "Família Exemplo", destino: "Lisboa", etapa: "Negociando", valor: 25000, dias: 1 },
  { id: "2", quem: "Casal Modelo", destino: "Patagônia", etapa: "Contatado", valor: null, dias: 4 },
  { id: "3", quem: "Grupo Amostra", destino: "Peru", etapa: "Novo", valor: 48000, dias: 6 },
];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ds-stack">
      <span className="ds-mono">{title}</span>
      {children}
    </section>
  );
}

function Specimen({ label }: { label: string }) {
  const [seg, setSeg] = useState<"hoje" | "amanha" | "semana">("hoje");
  const [tab, setTab] = useState<"resumo" | "historico" | "orcamento">("resumo");
  const [view, setView] = useState<"quadro" | "lista" | "capas">("quadro");
  const [mine, setMine] = useState(true);
  const [late, setLate] = useState(false);
  const [sw, setSw] = useState(true);
  const [done, setDone] = useState(false);

  return (
    <div className="ds-stack" style={{ gap: 30, padding: 28, background: "var(--background)", color: "var(--foreground)", borderRadius: 28, border: "1px solid var(--border)", minWidth: 0 }}>
      <PageTitle
        eyebrow={`${label} · exemplo`}
        title="Viagens"
        summary="6 em negociação · R$ 184 mil em jogo"
        actions={<Button variant="primary" icon={<Plus weight="bold" aria-hidden />}>Nova viagem</Button>}
      />

      <Block title="Tipografia">
        <div className="ds-stack" style={{ gap: 8 }}>
          <h1 className="ds-h1">Título da tela</h1>
          <h2 className="ds-h2">Título de seção</h2>
          <h3 className="ds-h3">Título de bloco</h3>
          <span className="ds-mono">Rótulo em caixa alta · 12 mar</span>
          <p className="ds-body" style={{ margin: 0 }}>Texto de corpo em Inter. Números tabulares: <span className="ds-num">1.234,56</span></p>
          <span className="ds-muted">Texto de apoio</span>
        </div>
      </Block>

      <Block title="Botões">
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Button variant="primary">Principal</Button>
          <Button>Contorno</Button>
          <Button variant="link">Ação em link</Button>
          <Button variant="primary" loading>Salvando</Button>
          <Button disabled>Desabilitado</Button>
          <IconButton label="Buscar"><MagnifyingGlass aria-hidden /></IconButton>
          <IconButton label="Notificações, 3 novas" dot><CalendarBlank aria-hidden /></IconButton>
          <Mini label="Abrir WhatsApp"><WhatsappLogo aria-hidden /></Mini>
          <Mini label="Concluir" done><Check aria-hidden /></Mini>
        </div>
      </Block>

      <Block title="Chips">
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Chip>Neutro</Chip>
          <Chip tone="ok" icon={<Check weight="bold" aria-hidden />}>Feito</Chip>
          <Chip tone="now">Em andamento</Chip>
          <Chip tone="warn" icon={<Warning weight="fill" aria-hidden />}>3 dias sem contato</Chip>
          <Chip tone="bad" icon={<Warning weight="fill" aria-hidden />}>Atrasada</Chip>
          <Chip tone="info">Informação</Chip>
        </div>
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <FilterChip pressed={mine} onPressedChange={setMine}>Minhas</FilterChip>
          <FilterChip pressed={late} onPressedChange={setLate}>Sem contato há 3+ dias</FilterChip>
        </div>
      </Block>

      <Block title="Seletor, abas e visualização">
        <Seg label="Período" value={seg} onChange={setSeg} options={[{ value: "hoje", label: "Hoje", count: 4 }, { value: "amanha", label: "Amanhã", count: 2 }, { value: "semana", label: "Semana", count: 9 }]} />
        <Tabs label="Seções da ficha" value={tab} onChange={setTab} options={[{ value: "resumo", label: "Resumo", icon: <FileText aria-hidden /> }, { value: "historico", label: "Histórico", count: 5 }, { value: "orcamento", label: "Orçamento" }]} />
        <div className="ds-filtros">
          <SearchInput icon={<MagnifyingGlass aria-hidden />} label="Buscar por viajante ou destino" placeholder="Buscar por viajante ou destino" />
          <span className="ds-filtros-sp" />
          <ViewSwitcher value={view} onChange={setView} options={[{ value: "quadro", label: "Quadro", icon: <Kanban aria-hidden /> }, { value: "lista", label: "Lista", icon: <ListBullets aria-hidden /> }, { value: "capas", label: "Capas", icon: <SquaresFour aria-hidden /> }]} />
        </div>
      </Block>

      <Block title="Campos">
        <div className="ds-two">
          <Field label="Quem vai viajar" placeholder="Busque na base ou digite um nome" />
          <SelectField label="Como chegou" defaultValue="">
            <option value="" disabled>Escolha</option>
            <option>Indicação</option>
            <option>Instagram</option>
          </SelectField>
          <Field label="Próximo passo" hint="Obrigatório: toda viagem tem um próximo passo." placeholder="Ex.: enviar a proposta" />
          <Field label="WhatsApp" defaultValue="11 9999" error="Número incompleto." />
        </div>
        <TextField label="Observações" placeholder="O que mais é bom saber" />
        <div className="ds-row" style={{ flexWrap: "wrap", gap: 18 }}>
          <span className="ds-row"><Switch label="Avisar por e-mail" checked={sw} onCheckedChange={setSw} /> Avisar por e-mail</span>
          <span className="ds-row"><Tick label="Concluir tarefa" checked={done} onCheckedChange={setDone} /> Concluir</span>
          <span className="ds-row"><Avatar name="Maria Exemplo" size="sm" /><Avatar name="João Modelo" color="#2d4a63" /><Avatar name="Ana Amostra" color="#5a3a4e" size="lg" /></span>
        </div>
        <div className="ds-stack" style={{ gap: 10 }}>
          <Progress label="Checklist da viagem" value={7} max={12} />
          <Progress label="Checklist concluído" value={12} max={12} />
        </div>
      </Block>

      <Block title="Seção, cartões e destaque">
        <SectionHeader title="Agenda do dia" note="4 compromissos">
          <Button variant="link">Ver agenda</Button>
        </SectionHeader>
        <HighlightCard>
          <div className="ds-row" style={{ gap: 18, flexWrap: "wrap" }}>
            <IconBox accent><Phone size={20} aria-hidden /></IconBox>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span className="ds-mono">Comece por aqui</span>
              <h3 className="ds-h3">Ligar para a Família Exemplo</h3>
              <p className="ds-muted" style={{ margin: 0 }}>Proposta enviada há 5 dias, sem resposta.</p>
            </div>
            <Button variant="primary">Abrir</Button>
          </div>
        </HighlightCard>
        <div className="ds-two">
          <Card>
            <div className="ds-inrow">
              <IconBox><ChatCircleDots size={18} aria-hidden /></IconBox>
              <div><b>Linha dentro do cartão</b><span className="ds-muted">Linha antes de caixa</span></div>
              <Chip tone="now">Hoje</Chip>
            </div>
            <div className="ds-inrow">
              <IconBox><AirplaneTilt size={18} aria-hidden /></IconBox>
              <div><b>Embarque em 12 dias</b><span className="ds-muted">Lisboa · 2 viajantes</span></div>
              <Chip tone="ok">Pronta</Chip>
            </div>
          </Card>
          <div className="ds-stack">
            <div className="ds-tip"><IconBox><FileText size={18} aria-hidden /></IconBox><span className="ds-body">Dica ou aviso dentro da tela.</span></div>
            <Skeleton height={18} width="70%" />
            <Skeleton height={44} radius={999} />
          </div>
        </div>
      </Block>

      <Block title="Números">
        <KpiRow
          items={[
            { label: "Vendido no mês", value: "R$ 84 mil", delta: { text: "12% sobre o mês anterior", direction: "up" } },
            { label: "Em negociação", value: "R$ 184 mil", delta: { text: "6 viagens abertas" } },
            { label: "Conversão em 90 dias", value: "38%", delta: { text: "4 pontos a menos", direction: "down" } },
            { label: "Embarques em 60 dias", value: "A definir" },
          ]}
        />
      </Block>

      <Block title="Foto com véu e vidro">
        <PhotoHero
          image={PHOTO}
          minHeight={300}
          aside={
            <>
              <span className="ds-mono">Embarque</span>
              <b style={{ font: "700 34px/1 var(--font-display)" }}>12 dias</b>
              <Progress label="Checklist" value={7} max={12} />
              <Button variant="primary" block>Enviar ao cliente</Button>
            </>
          }
        >
          <span className="ds-mono">Preparação e viagem</span>
          <h2 className="ds-h1">Lisboa em família</h2>
          <span>1 a 10 de março · 2 viajantes</span>
        </PhotoHero>
        <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", padding: 24, backgroundImage: `url("${PHOTO}")`, backgroundSize: "cover" }}>
          <Glass style={{ padding: 16, maxWidth: 320 }}>
            <b>Vidro</b>
            <p className="ds-muted" style={{ margin: 0 }}>Só sobre foto ou conteúdo.</p>
          </Glass>
        </div>
      </Block>

      <Block title="Jornada, funil e histórico">
        <Card>
          <JourneySteps steps={[{ title: "Proposta", note: "Aceita em 3 mar", state: "done" }, { title: "Contrato", note: "Aguardando assinatura", state: "current" }, { title: "Pagamento", note: "A seguir", state: "todo" }, { title: "Roteiro e guia", note: "A seguir", state: "todo" }]} />
        </Card>
        <div className="ds-two">
          <Card>
            <Funnel rows={[{ id: "novo", label: "Novo", count: 3, note: "R$ 62 mil" }, { id: "contatado", label: "Contatado", count: 2, note: "R$ 40 mil" }, { id: "negociando", label: "Negociando", count: 1, note: "R$ 25 mil" }, { id: "fechado", label: "Fechado", count: 4, note: "R$ 84 mil" }, { id: "perdido", label: "Perdido", count: 1, muted: true }]} onSelect={() => undefined} />
          </Card>
          <Card>
            <History entries={[{ id: "1", icon: <WhatsappLogo aria-hidden />, text: "Mensagem enviada com a proposta", meta: "Hoje, 10:12 · Maria" }, { id: "2", icon: <Phone aria-hidden />, text: "Ligação sem resposta", meta: "Ontem, 16:40", bad: true }, { id: "3", icon: <FileText aria-hidden />, text: "Proposta criada", meta: "3 mar" }]} />
          </Card>
        </div>
      </Block>

      <Block title="Tabela que ordena e vira lista no celular">
        <DataTable
          caption="Negociações de exemplo"
          rows={ROWS}
          rowKey={(r) => r.id}
          onRowClick={() => undefined}
          initialSort={{ id: "dias", dir: "desc" }}
          columns={[
            { id: "quem", header: "Viajante", cell: (r) => r.quem, sortValue: (r) => r.quem },
            { id: "destino", header: "Destino", cell: (r) => r.destino },
            { id: "etapa", header: "Etapa", cell: (r) => <Chip tone={r.etapa === "Negociando" ? "now" : "neutral"}>{r.etapa}</Chip>, sortValue: (r) => r.etapa },
            { id: "valor", header: "Valor", numeric: true, cell: (r) => (r.valor == null ? "A definir" : brl(r.valor)), sortValue: (r) => r.valor },
            { id: "dias", header: "Sem contato", numeric: true, cell: (r) => (r.dias >= 5 ? <Chip tone="bad" icon={<Warning weight="fill" aria-hidden />}>{r.dias} dias</Chip> : r.dias >= 3 ? <Chip tone="warn">{r.dias} dias</Chip> : `${r.dias} dia`), sortValue: (r) => r.dias },
          ]}
        />
      </Block>

      <Block title="Gráficos">
        <div className="ds-two">
          <Card><ColumnChart label="Vendido por mês" bars={[{ label: "Out", value: 42, display: "42" }, { label: "Nov", value: 58, display: "58" }, { label: "Dez", value: 31, display: "31" }, { label: "Jan", value: 66, display: "66" }, { label: "Fev", value: 75, display: "75" }, { label: "Mar", value: 84, display: "84" }]} /></Card>
          <Card className="ds-stack">
            <HBars label="Por consultora" bars={[{ label: "Maria", value: 84, display: "R$ 84 mil" }, { label: "João", value: 51, display: "R$ 51 mil" }, { label: "Ana", value: 20, display: "R$ 20 mil", muted: true }]} />
            <SegBar label="Despesas por tipo" parts={[{ label: "Pacote", value: 50, display: "50%" }, { label: "Comissão", value: 25, display: "25%" }, { label: "Operacional", value: 15, display: "15%" }, { label: "Marketing", value: 10, display: "10%" }]} />
            <Meter label="Cota de IA do mês" value={72} max={100} display="72 de 100 mil" state="warn" status="Perto do limite" />
          </Card>
        </div>
      </Block>

      <Block title="Vazio e erro">
        <div className="ds-two">
          <Empty title="Nenhuma viagem em negociação" action={<Button variant="primary">Nova viagem</Button>}>Quando chegar um pedido, ele aparece aqui.</Empty>
          <ErrorBox onRetry={() => undefined}>Não foi possível carregar as viagens.</ErrorBox>
        </div>
      </Block>
    </div>
  );
}

function DevUi() {
  const { theme, toggle } = useTheme();
  const [panel, setPanel] = useState(false);
  const [janela, setJanela] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [color, setColor] = useState("");

  // Cor de exemplo para conferir o white-label. Some ao sair da página.
  useEffect(() => {
    applyBrandColor(normalizeHex(color));
    return () => applyBrandColor(null);
  }, [color]);

  return (
    <div style={{ padding: "28px clamp(14px, 3vw, 40px) 80px", display: "flex", flexDirection: "column", gap: 24 }}>
      <header className="ds-ph">
        <div>
          <span className="ds-row"><BrandLogo heightClass="h-9" /></span>
          <h1 className="ds-h1">Design system</h1>
          <p>Todas as peças do protótipo, nos dois temas. Os dados desta página são exemplos.</p>
        </div>
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <label className="ds-row ds-muted">
            Cor da agência
            <input type="color" aria-label="Cor da agência de exemplo" value={normalizeHex(color) ?? PRODUCT.primary} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, background: "none", border: 0 }} />
          </label>
          <Button onClick={() => setColor("")}>Cor do produto</Button>
          <IconButton label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} onClick={toggle}>
            {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </IconButton>
        </div>
      </header>

      <Card className="ds-row" style={{ flexWrap: "wrap" }}>
        <span className="ds-mono">Sobreposições (seguem o tema da página)</span>
        <Button onClick={() => setPanel(true)}>Painel lateral</Button>
        <Button onClick={() => setJanela(true)}>Janela</Button>
        <Button onClick={() => setSheet(true)}>Menu Criar</Button>
        <Button onClick={() => toast("Viagem criada em Novo")}>Aviso curto</Button>
        <Button onClick={() => toast.error("Não foi possível salvar")}>Aviso de erro</Button>
      </Card>

      <div className="ds-two" style={{ alignItems: "start" }}>
        <div className="dark"><Specimen label="Tema escuro" /></div>
        <div className="light"><Specimen label="Tema claro" /></div>
      </div>

      <SidePanel open={panel} onOpenChange={setPanel} eyebrow="Viagem · fase comercial · exemplo" title="Família Exemplo" description="Lisboa · 1 a 10 de março · 2 viajantes" footer={<Button variant="primary" onClick={() => setPanel(false)}>Concluir e definir o próximo</Button>}>
        <HighlightCard>
          <span className="ds-mono">Próximo passo</span>
          <h3 className="ds-h3">Enviar a proposta revisada</h3>
          <p className="ds-muted" style={{ margin: 0 }}>Até amanhã</p>
        </HighlightCard>
        <History entries={[{ id: "1", icon: <WhatsappLogo aria-hidden />, text: "Mensagem enviada", meta: "Hoje, 10:12" }]} />
      </SidePanel>

      <Janela open={janela} onOpenChange={setJanela} title="Nova viagem" description="Começa pela negociação comercial." footer={<><Button onClick={() => setJanela(false)}>Cancelar</Button><Button variant="primary" onClick={() => setJanela(false)}>Criar viagem</Button></>}>
        <Field label="Quem vai viajar" placeholder="Busque na base ou digite um nome" />
        <div className="ds-two">
          <Field label="Destino" />
          <Field label="Quando" />
        </div>
        <Field label="Próximo passo" hint="Obrigatório." />
      </Janela>

      <Avisos />

      <ActionSheet
        open={sheet}
        onOpenChange={setSheet}
        title="Criar"
        items={[
          { id: "v", icon: <Kanban aria-hidden />, title: "Nova viagem", hint: "Começa pela negociação comercial", onSelect: () => undefined },
          { id: "t", icon: <CalendarBlank aria-hidden />, title: "Novo compromisso", hint: "Ligação, reunião ou retorno", onSelect: () => undefined },
        ]}
      />
    </div>
  );
}
