import { useState } from "react";
import {
  AirplaneTilt,
  ArrowRight,
  CalendarBlank,
  ChatCircleDots,
  Check,
  Clock,
  CurrencyCircleDollar,
  FileText,
  Kanban,
  ListBullets,
  MapPin,
  PaperPlaneTilt,
  Phone,
  Plus,
  ShareNetwork,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ColumnChart,
  DataTable,
  HBars,
  HighlightCard,
  History,
  IconBox,
  JourneySteps,
  KpiRow,
  Meter,
  Mini,
  PageTitle,
  PhotoHero,
  Progress,
  SectionHeader,
  Seg,
  SegBar,
  Tabs,
  Tick,
  ViewSwitcher,
  type JourneyStep,
} from "@/components/ds";
import foto from "@/assets/roteiro-fallback.jpg";

/**
 * "Prints" do sistema para a página /conheca. São montados com as mesmas peças
 * do design system do app, com dados de exemplo, e respondem a cliques.
 * Nada aqui fala com o servidor.
 */

export const FOTO_DESTINO = foto;

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// "Fotos" de capa desenhadas em SVG, uma por destino.
function capa(c1: string, c2: string, c3: string) {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 120' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='160' height='120' fill='url(#g)'/><circle cx='112' cy='42' r='14' fill='#fff3d6' opacity='.85'/><path d='M0 88 L40 62 L70 80 L104 54 L160 86 V120 H0Z' fill='${c3}'/></svg>`,
    )
  );
}
export const CAPAS = {
  portugal: capa("#f4b678", "#d9785a", "#5b3550"),
  orlando: capa("#8fd3f4", "#4b8fd6", "#2d4a7a"),
  italia: capa("#f7d9a0", "#c98b5a", "#6b4a3a"),
  patagonia: capa("#bfe3f0", "#7fa7c9", "#3d5068"),
  noronha: capa("#9fe6d8", "#3aa6a0", "#1f5a5a"),
};

// ── Hoje ──────────────────────────────────────────────────────────────
export function TelaHoje({ compacta }: { compacta: boolean }) {
  const [feitos, setFeitos] = useState<Record<string, boolean>>({});
  const agenda = [
    {
      id: "a",
      hora: "09:30",
      t: "Retornar Família Souza sobre os parques",
      s: "Disney em família",
      icon: Phone,
    },
    {
      id: "b",
      hora: "14:00",
      t: "Enviar roteiro da Itália para Marina",
      s: "Itália clássica",
      icon: PaperPlaneTilt,
    },
    {
      id: "c",
      hora: "17:00",
      t: "Cobrar 2ª parcela",
      s: "Lua de mel em Portugal",
      icon: CurrencyCircleDollar,
    },
  ];
  return (
    <div className="flex flex-col gap-7">
      <PageTitle
        eyebrow="Quarta · 25 de novembro"
        title="Bom dia, Carla"
        summary={`${agenda.length - Object.values(feitos).filter(Boolean).length} compromissos hoje · 1 viagem pede retorno`}
        actions={
          <Button variant="primary" icon={<Plus weight="bold" aria-hidden />}>
            Nova viagem
          </Button>
        }
      />
      <KpiRow
        items={[
          {
            label: "Vendido no mês",
            value: "R$ 84 mil",
            delta: { text: "12% sobre outubro", direction: "up" },
          },
          { label: "Em negociação", value: "R$ 184 mil", delta: { text: "8 viagens abertas" } },
          { label: "Conversão", value: "38%", delta: { text: "4 pontos a mais", direction: "up" } },
          { label: "Embarques em 30 dias", value: "4" },
        ]}
      />
      <div className={`grid gap-5 ${compacta ? "grid-cols-1" : "grid-cols-[1.25fr_1fr]"}`}>
        <Card>
          <SectionHeader title="Agenda do dia" note="Clique para concluir" />
          <div className="mt-2">
            {agenda.map((a) => (
              <div key={a.id} className="ds-ag">
                <time>{a.hora}</time>
                <div className="ds-ag-bd">
                  <b className={feitos[a.id] ? "ds-feito" : undefined}>{a.t}</b>
                  <span>
                    <a.icon aria-hidden /> {a.s}
                  </span>
                </div>
                <div className="ds-ag-acts">
                  <Mini
                    label="Concluir"
                    done={feitos[a.id]}
                    onClick={() => setFeitos((f) => ({ ...f, [a.id]: !f[a.id] }))}
                  >
                    <Check aria-hidden />
                  </Mini>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <HighlightCard>
            <div className="ds-focus">
              <IconBox accent>
                <Warning aria-hidden />
              </IconBox>
              <div>
                <span className="ds-mono">Comece por aqui</span>
                <b>Família Souza · 4 dias sem resposta</b>
                <p>Proposta da Disney enviada no dia 21.</p>
              </div>
              <Mini label="Abrir WhatsApp">
                <WhatsappLogo aria-hidden />
              </Mini>
            </div>
          </HighlightCard>
          <Card>
            <SectionHeader title="Próximos embarques" />
            <div className="mt-1">
              {[
                {
                  t: "Réveillon em Noronha",
                  s: "Rafael Dias · checklist 100%",
                  d: 36,
                  img: CAPAS.noronha,
                },
                {
                  t: "Lua de mel em Portugal",
                  s: "Ana e Pedro · checklist 71%",
                  d: 12,
                  img: CAPAS.portugal,
                },
              ]
                .sort((a, b) => a.d - b.d)
                .map((v) => (
                  <div key={v.t} className="ds-trip">
                    <img className="ds-trip-img" src={v.img} alt="" />
                    <div>
                      <b>{v.t}</b>
                      <span>{v.s}</span>
                    </div>
                    <div className="ds-trip-d">
                      <strong>{v.d}</strong>
                      <small>dias</small>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Viagens (comercial) ───────────────────────────────────────────────
type Etapa = "new" | "contacted" | "negotiating" | "closed";
const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "new", label: "Novo" },
  { id: "contacted", label: "Contatado" },
  { id: "negotiating", label: "Negociando" },
  { id: "closed", label: "Fechado" },
];
type Viagem = {
  id: string;
  titulo: string;
  quem: string;
  valor: number;
  etapa: Etapa;
  passo: string;
  atraso?: boolean;
};
const VIAGENS: Viagem[] = [
  {
    id: "1",
    titulo: "Itália clássica",
    quem: "Marina Lopes",
    valor: 19500,
    etapa: "new",
    passo: "Ligar para entender o perfil",
  },
  {
    id: "2",
    titulo: "Patagônia de aventura",
    quem: "Grupo Trilheiros",
    valor: 36000,
    etapa: "new",
    passo: "Enviar formulário de grupo",
  },
  {
    id: "3",
    titulo: "Disney em família",
    quem: "Família Souza",
    valor: 42000,
    etapa: "contacted",
    passo: "4 dias sem resposta",
    atraso: true,
  },
  {
    id: "4",
    titulo: "Lua de mel em Portugal",
    quem: "Ana e Pedro",
    valor: 28000,
    etapa: "negotiating",
    passo: "Ajustar hotel do Porto",
  },
  {
    id: "5",
    titulo: "Réveillon em Noronha",
    quem: "Rafael Dias",
    valor: 14800,
    etapa: "closed",
    passo: "Contrato assinado",
  },
];

export function TelaViagens({ compacta }: { compacta: boolean }) {
  const [vista, setVista] = useState<"quadro" | "lista">("quadro");
  const [fase, setFase] = useState<"comercial" | "preparacao">("comercial");
  const [viagens, setViagens] = useState(VIAGENS);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  const abertas = viagens.filter((v) => v.etapa !== "closed");

  const mover = (id: string, etapa: Etapa) =>
    setViagens((vs) => vs.map((v) => (v.id === id ? { ...v, etapa } : v)));
  const avancar = (v: Viagem) => {
    const i = ETAPAS.findIndex((e) => e.id === v.etapa);
    mover(v.id, ETAPAS[Math.min(i + 1, ETAPAS.length - 1)].id);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Viagens"
        summary={`${abertas.length} em negociação · ${brl(abertas.reduce((s, v) => s + v.valor, 0))} em jogo`}
        actions={
          <Button variant="primary" icon={<Plus weight="bold" aria-hidden />}>
            Nova viagem
          </Button>
        }
      />
      <div className="flex items-center gap-3">
        <Seg
          label="Fase"
          value={fase}
          onChange={setFase}
          options={[
            { value: "comercial", label: "Comercial", count: abertas.length },
            { value: "preparacao", label: "Preparação", count: 2 },
          ]}
        />
        <span className="flex-1" />
        <ViewSwitcher
          value={vista}
          onChange={setVista}
          options={[
            { value: "quadro", label: "Quadro", icon: <Kanban aria-hidden /> },
            { value: "lista", label: "Lista", icon: <ListBullets aria-hidden /> },
          ]}
        />
      </div>

      {fase === "preparacao" ? (
        <TelaPreparacao embutida />
      ) : vista === "quadro" ? (
        <div className={`grid gap-3.5 ${compacta ? "grid-cols-2" : "grid-cols-4"}`}>
          {ETAPAS.slice(0, compacta ? 2 : 4).map((e) => {
            const col = viagens.filter((v) => v.etapa === e.id);
            return (
              <div
                key={e.id}
                className="ds-col"
                onDragOver={(ev) => {
                  ev.preventDefault();
                  setSobre(e.id);
                }}
                onDragLeave={() => setSobre(null)}
                onDrop={() => {
                  if (arrastando) mover(arrastando, e.id);
                  setArrastando(null);
                  setSobre(null);
                }}
              >
                <div className="ds-col-h">
                  <b>{e.label}</b>
                  <span className="ds-cnt">{col.length}</span>
                  <small>{brl(col.reduce((s, v) => s + v.valor, 0))}</small>
                </div>
                <div className={`ds-col-b ${sobre === e.id ? "ds-over" : ""}`}>
                  {col.map((v) => (
                    <div
                      key={v.id}
                      draggable
                      onDragStart={() => setArrastando(v.id)}
                      onDragEnd={() => setArrastando(null)}
                      className={`ds-vcard ${arrastando === v.id ? "ds-drag" : ""}`}
                    >
                      <div className="ds-vcard-t">
                        <b>{v.titulo}</b>
                      </div>
                      <span className="ds-vcard-v">{brl(v.valor)}</span>
                      <span className="ds-vcard-m">{v.quem}</span>
                      <span className={`ds-vcard-p ${v.atraso ? "ds-bad" : ""}`}>
                        {v.atraso ? <Warning aria-hidden /> : <ArrowRight aria-hidden />}
                        {v.passo}
                      </span>
                      <div className="ds-vcard-f">
                        {v.etapa !== "closed" ? (
                          <button
                            type="button"
                            onClick={() => avancar(v)}
                            className="ds-chip ds-now"
                            title="Avançar etapa"
                          >
                            Avançar <ArrowRight weight="bold" aria-hidden />
                          </button>
                        ) : (
                          <Chip tone="ok" icon={<Check weight="bold" aria-hidden />}>
                            Fechada
                          </Chip>
                        )}
                        <Avatar name={v.quem} size="sm" />
                      </div>
                    </div>
                  ))}
                  {!col.length && <div className="ds-col-vazia">Arraste uma viagem para cá</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <DataTable
            caption="Viagens"
            rows={viagens}
            rowKey={(v) => v.id}
            initialSort={{ id: "valor", dir: "desc" }}
            columns={[
              {
                id: "quem",
                header: "Viajante",
                cell: (v) => <b>{v.quem}</b>,
                sortValue: (v) => v.quem,
              },
              { id: "titulo", header: "Viagem", cell: (v) => v.titulo, sortValue: (v) => v.titulo },
              {
                id: "etapa",
                header: "Etapa",
                cell: (v) => (
                  <Chip tone={v.etapa === "closed" ? "ok" : v.atraso ? "warn" : "neutral"}>
                    {ETAPAS.find((e) => e.id === v.etapa)?.label}
                  </Chip>
                ),
                sortValue: (v) => ETAPAS.findIndex((e) => e.id === v.etapa),
              },
              {
                id: "valor",
                header: "Valor",
                numeric: true,
                cell: (v) => brl(v.valor),
                sortValue: (v) => v.valor,
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

// ── Preparação (jornada e checklist) ─────────────────────────────────
const CHECK = [
  "Passaporte válido",
  "Seguro viagem",
  "Passagens emitidas",
  "Reserva dos hotéis",
  "Trem Lisboa–Porto",
  "Check-in online",
  "Enviar roteiro final",
];

export function TelaPreparacao({ embutida = false }: { embutida?: boolean }) {
  const [feitos, setFeitos] = useState<Record<string, boolean>>({
    "Passaporte válido": true,
    "Seguro viagem": true,
    "Passagens emitidas": true,
    "Reserva dos hotéis": true,
  });
  const n = CHECK.filter((c) => feitos[c]).length;
  const passos: JourneyStep[] = [
    { title: "Proposta", note: "Aceita em 3 out", state: "done" },
    { title: "Contrato", note: "Assinado em 6 out", state: "done" },
    { title: "Pagamento", note: "2 de 3 parcelas", state: "current" },
    {
      title: "Roteiro e guia",
      note: n === CHECK.length ? "Pronto" : "A seguir",
      state: n === CHECK.length ? "done" : "todo",
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      {!embutida && (
        <PageTitle
          eyebrow="Preparação · embarca em 12 dias"
          title="Lua de mel em Portugal"
          summary="Ana e Pedro · 12 a 20 de maio"
        />
      )}
      <Card>
        <JourneySteps steps={passos} />
      </Card>
      <Card>
        <SectionHeader
          title="Checklist da viagem"
          note={`${n} de ${CHECK.length} · clique para marcar`}
        />
        <div className="mt-3">
          <Progress value={n} max={CHECK.length} label="Checklist" />
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-8">
          {CHECK.map((c) => (
            <li
              key={c}
              className="flex items-center gap-3 border-b border-border py-2.5 text-[14px]"
            >
              <Tick
                checked={!!feitos[c]}
                label={c}
                onCheckedChange={(v) => setFeitos((f) => ({ ...f, [c]: v }))}
              />
              <span className={feitos[c] ? "text-muted-foreground line-through" : ""}>{c}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ── Roteiro ──────────────────────────────────────────────────────────
export const DIAS = [
  {
    dia: 1,
    titulo: "Chegada a Lisboa",
    itens: [
      ["14:00", "Transfer do aeroporto ao hotel no Chiado"],
      ["18:30", "Pôr do sol no Miradouro de Santa Luzia"],
      ["20:30", "Jantar com fado em Alfama"],
    ],
  },
  {
    dia: 2,
    titulo: "Belém e Lisboa histórica",
    itens: [
      ["09:30", "Torre de Belém e Mosteiro dos Jerónimos"],
      ["12:00", "Pastéis de Belém"],
      ["17:00", "Passeio de barco pelo Tejo"],
    ],
  },
  {
    dia: 3,
    titulo: "Sintra",
    itens: [
      ["09:00", "Palácio da Pena"],
      ["13:30", "Quinta da Regaleira"],
      ["18:00", "Cabo da Roca no fim da tarde"],
    ],
  },
  {
    dia: 4,
    titulo: "Rumo ao Porto",
    itens: [
      ["10:00", "Trem para o Porto"],
      ["15:00", "Ribeira e Ponte Luís I"],
      ["18:00", "Degustação de vinho do Porto"],
    ],
  },
];

export function TelaRoteiro({ compacta }: { compacta: boolean }) {
  const [dia, setDia] = useState("1");
  const atual = DIAS.find((d) => String(d.dia) === dia)!;
  return (
    <div className="flex flex-col gap-6">
      <PhotoHero
        image={FOTO_DESTINO}
        minHeight={compacta ? 300 : 280}
        aside={
          !compacta && (
            <>
              <span className="ds-mono">Embarque</span>
              <b className="font-display text-[34px] leading-none">12 dias</b>
              <Progress value={71} label="Preparação" />
              <Button variant="primary" block icon={<ShareNetwork aria-hidden />}>
                Enviar ao cliente
              </Button>
            </>
          )
        }
      >
        <span className="ds-mono" style={{ color: "rgba(255,255,255,.75)" }}>
          Roteiro · 8 noites
        </span>
        <h1 className="ds-h1" style={{ color: "#fff" }}>
          Lua de mel em Portugal
        </h1>
        <p style={{ color: "rgba(255,255,255,.8)", margin: 0 }}>
          Ana e Pedro · Lisboa, Sintra e Porto
        </p>
      </PhotoHero>
      <Tabs
        label="Dias do roteiro"
        value={dia}
        onChange={setDia}
        options={DIAS.map((d) => ({ value: String(d.dia), label: `Dia ${d.dia}` }))}
      />
      <div className={`grid gap-5 ${compacta ? "grid-cols-1" : "grid-cols-[1.4fr_1fr]"}`}>
        <Card>
          <SectionHeader title={atual.titulo} note={`Dia ${atual.dia}`} />
          <div className="mt-2">
            {atual.itens.map(([h, t]) => (
              <div key={t} className="ds-ag">
                <time>{h}</time>
                <div className="ds-ag-bd">
                  <b>{t}</b>
                  <span>
                    <MapPin aria-hidden /> Portugal
                  </span>
                </div>
                <span />
              </div>
            ))}
          </div>
        </Card>
        {!compacta && (
          <Card>
            <SectionHeader title="Hospedagem" />
            <div className="ds-trip mt-1">
              <img className="ds-trip-img" src={CAPAS.portugal} alt="" />
              <div>
                <b>Hotel no Chiado</b>
                <span>Noites 1 a 4 · café incluso</span>
              </div>
              <span />
            </div>
            <div className="ds-trip">
              <img className="ds-trip-img" src={CAPAS.italia} alt="" />
              <div>
                <b>Hotel na Ribeira</b>
                <span>Noites 5 a 8 · vista para o rio</span>
              </div>
              <span />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Viajantes ────────────────────────────────────────────────────────
export function TelaViajantes({ compacta }: { compacta: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        <Avatar name="Ana Ribeiro" size="lg" />
        <div className="flex-1">
          <span className="ds-mono">Viajante · desde 2023</span>
          <h1 className="ds-h1">Ana Ribeiro</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip tone="info">Família Ribeiro · 3 pessoas</Chip>
            <Chip>Prefere hotel boutique</Chip>
            <Chip>Viaja em maio</Chip>
          </div>
        </div>
        {!compacta && (
          <Button icon={<WhatsappLogo aria-hidden />} variant="outline">
            WhatsApp
          </Button>
        )}
      </div>
      <div className={`grid gap-5 ${compacta ? "grid-cols-1" : "grid-cols-[1fr_1.2fr]"}`}>
        <Card>
          <SectionHeader title="Documentos" />
          <div className="mt-3 flex flex-col gap-4">
            <Meter
              label="Passaporte"
              value={4}
              max={10}
              display="vence em 2030"
              state="ok"
              status="Em dia"
            />
            <Meter
              label="Visto americano"
              value={9}
              max={10}
              display="vence em fev/27"
              state="warn"
              status="Renovar antes da Disney"
            />
          </div>
          <div className="mt-5">
            <SectionHeader title="Viagens" />
            <div className="mt-1">
              {[
                { t: "Lua de mel em Portugal", s: "Maio/27 · preparação", img: CAPAS.portugal },
                { t: "Patagônia", s: "Mar/25 · concluída", img: CAPAS.patagonia },
              ].map((v) => (
                <div key={v.t} className="ds-trip">
                  <img className="ds-trip-img" src={v.img} alt="" />
                  <div>
                    <b>{v.t}</b>
                    <span>{v.s}</span>
                  </div>
                  <span />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Histórico" />
          <History
            entries={[
              {
                id: "1",
                icon: <ChatCircleDots aria-hidden />,
                text: "Mensagem enviada com a proposta",
                meta: "Hoje, 10:12 · Carla",
              },
              { id: "2", icon: <FileText aria-hidden />, text: "Contrato assinado", meta: "6 out" },
              {
                id: "3",
                icon: <CurrencyCircleDollar aria-hidden />,
                text: "Pagamento da 2ª parcela recebido",
                meta: "2 nov",
              },
              {
                id: "4",
                icon: <Phone aria-hidden />,
                text: "Ligação sem resposta",
                meta: "28 set",
                bad: true,
              },
              {
                id: "5",
                icon: <AirplaneTilt aria-hidden />,
                text: "Viagem criada pelo formulário do site",
                meta: "20 set",
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

// ── Agenda ───────────────────────────────────────────────────────────
const SEMANA = [
  { d: "Seg 23", e: [{ h: "10:00", t: "Reunião família Souza", k: "info" }] },
  { d: "Ter 24", e: [{ h: "15:00", t: "Prazo do visto", k: "warn" }] },
  {
    d: "Qua 25",
    e: [
      { h: "09:30", t: "Retorno Disney", k: "now" },
      { h: "17:00", t: "Cobrar parcela", k: "neutral" },
    ],
  },
  { d: "Qui 26", e: [{ h: "11:00", t: "Check-in Noronha", k: "ok" }] },
  { d: "Sex 27", e: [{ h: "16:00", t: "Enviar roteiro Itália", k: "now" }] },
  { d: "Sáb 28", e: [] },
  { d: "Dom 29", e: [{ h: "—", t: "Embarque Rafael", k: "ok" }] },
] as const;

export function TelaAgenda({ compacta }: { compacta: boolean }) {
  const [vista, setVista] = useState<"semana" | "lista">("semana");
  const dias = compacta ? SEMANA.slice(0, 4) : SEMANA;
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Agenda"
        summary="Retornos, pagamentos e embarques entram sozinhos, com a data certa."
        actions={
          <Seg
            label="Visualização"
            value={vista}
            onChange={setVista}
            options={[
              { value: "semana", label: "Semana", icon: <CalendarBlank aria-hidden /> },
              { value: "lista", label: "Lista", icon: <ListBullets aria-hidden /> },
            ]}
          />
        }
      />
      {vista === "semana" ? (
        <div
          className="grid overflow-hidden rounded-[var(--r3)] border border-border"
          style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0,1fr))` }}
        >
          {dias.map((d) => (
            <div
              key={d.d}
              className={`min-h-[300px] border-r border-border p-3 last:border-r-0 ${d.d === "Qua 25" ? "bg-accent" : "bg-card"}`}
            >
              <p className="ds-mono mb-3">{d.d}</p>
              <div className="flex flex-col gap-2">
                {d.e.map((e) => (
                  <div
                    key={e.t}
                    className="rounded-[12px] border border-border bg-background p-2.5"
                  >
                    <p className="text-[12px] text-muted-foreground">{e.h}</p>
                    <p className="text-[13.5px] font-semibold leading-snug">{e.t}</p>
                    <div className="mt-1.5">
                      <Chip tone={e.k}>
                        {e.k === "ok"
                          ? "Embarque"
                          : e.k === "warn"
                            ? "Prazo"
                            : e.k === "info"
                              ? "Reunião"
                              : "Tarefa"}
                      </Chip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          {SEMANA.flatMap((d) => d.e.map((e) => ({ ...e, d: d.d }))).map((e) => (
            <div key={e.t} className="ds-ag">
              <time>
                {e.h}
                <small>{e.d}</small>
              </time>
              <div className="ds-ag-bd">
                <b>{e.t}</b>
                <span>
                  <Clock aria-hidden /> Lembrete no celular 1 hora antes
                </span>
              </div>
              <span />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Financeiro ───────────────────────────────────────────────────────
export function TelaFinanceiro({ compacta }: { compacta: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Financeiro" summary="Novembro · visível só para quem você liberar" />
      <KpiRow
        items={[
          {
            label: "Vendido",
            value: "R$ 84 mil",
            delta: { text: "12% sobre outubro", direction: "up" },
          },
          { label: "Comissão", value: "R$ 9,2 mil" },
          { label: "A receber", value: "R$ 31 mil", delta: { text: "6 parcelas" } },
          { label: "Ticket médio", value: "R$ 21 mil" },
        ]}
      />
      <div className={`grid gap-5 ${compacta ? "grid-cols-1" : "grid-cols-2"}`}>
        <Card>
          <SectionHeader title="Vendido por mês" note="em mil reais" />
          <div className="mt-4">
            <ColumnChart
              label="Vendido por mês"
              bars={[
                { label: "Jun", value: 42 },
                { label: "Jul", value: 58 },
                { label: "Ago", value: 31 },
                { label: "Set", value: 66 },
                { label: "Out", value: 75 },
                { label: "Nov", value: 84 },
              ]}
            />
          </div>
        </Card>
        <Card>
          <SectionHeader title="Por consultora" />
          <div className="mt-4 flex flex-col gap-6">
            <HBars
              label="Por consultora"
              bars={[
                { label: "Carla", value: 46, display: "R$ 46 mil" },
                { label: "João", value: 26, display: "R$ 26 mil" },
                { label: "Bia", value: 12, display: "R$ 12 mil", muted: true },
              ]}
            />
            <SegBar
              label="Composição"
              parts={[
                { label: "Aéreo", value: 41, display: "41%" },
                { label: "Hotel", value: 33, display: "33%" },
                { label: "Passeios", value: 16, display: "16%" },
                { label: "Seguro", value: 10, display: "10%" },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Biblioteca ───────────────────────────────────────────────────────
const ITENS_BIBLIOTECA = [
  { t: "Palácio da Pena", s: "Sintra · passeio de meio dia", img: CAPAS.portugal, tipo: "Passeio" },
  { t: "Hotel na Ribeira", s: "Porto · vista para o rio", img: CAPAS.italia, tipo: "Hotel" },
  { t: "Magic Kingdom", s: "Orlando · dia inteiro", img: CAPAS.orlando, tipo: "Passeio" },
  {
    t: "Glaciar Perito Moreno",
    s: "El Calafate · passarelas",
    img: CAPAS.patagonia,
    tipo: "Passeio",
  },
  { t: "Baía do Sancho", s: "Noronha · trilha e mergulho", img: CAPAS.noronha, tipo: "Passeio" },
  { t: "Transfer aeroporto", s: "Lisboa · privativo", img: CAPAS.portugal, tipo: "Transfer" },
];

export function TelaBiblioteca({ compacta }: { compacta: boolean }) {
  const [filtro, setFiltro] = useState<"todos" | "Passeio" | "Hotel" | "Transfer">("todos");
  const itens = ITENS_BIBLIOTECA.filter((i) => filtro === "todos" || i.tipo === filtro);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Biblioteca"
        summary="Passeios, hotéis e fotos que você já usou, prontos para entrar no próximo roteiro."
      />
      <Seg
        label="Tipo"
        value={filtro}
        onChange={setFiltro}
        options={[
          { value: "todos", label: "Todos" },
          { value: "Passeio", label: "Passeios" },
          { value: "Hotel", label: "Hotéis" },
          { value: "Transfer", label: "Transfers" },
        ]}
      />
      <div className={`grid gap-4 ${compacta ? "grid-cols-2" : "grid-cols-3"}`}>
        {itens.map((i) => (
          <div
            key={i.t}
            className="overflow-hidden rounded-[var(--r3)] border border-border bg-card"
          >
            <img src={i.img} alt="" className="h-28 w-full object-cover" />
            <div className="flex items-start justify-between gap-2 p-3.5">
              <div>
                <b className="text-[14.5px]">{i.t}</b>
                <p className="text-[13px] text-muted-foreground">{i.s}</p>
              </div>
              <Mini label="Usar no roteiro">
                <Plus aria-hidden />
              </Mini>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
