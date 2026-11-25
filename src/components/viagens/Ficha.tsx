// Ficha da viagem, fase comercial: painel lateral com etapa, próximo passo,
// contato rápido e as abas Resumo, Histórico e Orçamento. Edição completa,
// documentos e checklist continuam na ficha completa (botão no rodapé).
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight, CalendarBlank, ChatCircleText, Check, ClipboardText, Clock, EnvelopeSimple, Kanban, Phone,
  PencilSimple, Plus, VideoCamera, Warning, WhatsappLogo, XCircle, FileText, HandWaving,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Button, Card, Chip, Field, HBars, HighlightCard, History, JourneySteps, KpiRow, Meter, Seg, SidePanel, Skeleton, Tabs, TextField,
  type HistoryEntry, type JourneyStep,
} from "@/components/ds";
import {
  ETAPAS, campoDoPerfil, diaMes, dataDoPasso, dinheiro, dinheiroCurto, origemTexto, parseData, passageirosTexto,
  proximosPassos, quandoPasso, quandoTexto, situacaoPassaporte, valorDe, whatsappLink, type Etapa, type ProximoPasso,
} from "@/data/viagens";
import {
  createItinerary, createLeadActivity, createTask, fetchClientById, fetchItinerariesByLead, fetchLeadActivities, fetchLeadById,
  fetchTasks, fetchTripExpenses, getMemberId, marcarContato, updateLead, updateTask,
} from "@/lib/services";
import type { Lead, LeadActivity } from "@/lib/types";
import { motivoDaPerda } from "./Comercial";

const TIPOS_REGISTRO = [
  { value: "whatsapp", label: "WhatsApp", icon: <WhatsappLogo aria-hidden /> },
  { value: "call", label: "Ligação", icon: <Phone aria-hidden /> },
  { value: "email", label: "E-mail", icon: <EnvelopeSimple aria-hidden /> },
  { value: "meeting", label: "Reunião", icon: <VideoCamera aria-hidden /> },
  { value: "note", label: "Observação", icon: <ChatCircleText aria-hidden /> },
] as const;
type TipoRegistro = (typeof TIPOS_REGISTRO)[number]["value"];

const ICONE_ATIVIDADE: Record<string, ReactNode> = {
  whatsapp: <WhatsappLogo aria-hidden />, call: <Phone aria-hidden />, email: <EnvelopeSimple aria-hidden />,
  meeting: <VideoCamera aria-hidden />, note: <ChatCircleText aria-hidden />, request: <HandWaving aria-hidden />,
  document: <FileText aria-hidden />,
};
const NOME_ATIVIDADE: Record<string, string> = {
  whatsapp: "WhatsApp", call: "Ligação", email: "E-mail", meeting: "Reunião", note: "Observação", request: "Solicitação", document: "Documento",
};

const CATEGORIA: Record<string, string> = { passagem: "Passagens", hospedagem: "Hospedagem", seguro: "Seguro", alimentacao: "Alimentação", transporte: "Transporte", extra: "Extra", outro: "Outro" };
const PAGO_COM: Record<string, string> = { dinheiro: "Dinheiro ou Pix", cartao: "Cartão", milhas: "Milhas e pontos", beneficio: "Benefício ou cortesia" };

/** Sugestão de próximo passo para cada etapa. */
const SUGESTAO: Record<string, string> = { new: "Primeiro contato", contacted: "Montar proposta", negotiating: "Cobrar retorno da proposta" };

const dataCurta = diaMes;
const dataHora = (iso?: string | null) => {
  const d = parseData(iso);
  if (!d) return "";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : dataCurta(iso);
};

type Aba = "resumo" | "hist" | "orc";

export function FichaComercial({ leadId, onClose, onMover, onPerder, onFichaCompleta }: {
  leadId: string | null;
  onClose: () => void;
  onMover: (v: Lead, etapa: Etapa) => void;
  onPerder: (v: Lead) => void;
  onFichaCompleta: (id: string) => void;
}) {
  return (
    <SidePanel
      open={!!leadId}
      onOpenChange={(o) => !o && onClose()}
      title={<FichaTitulo leadId={leadId} />}
      eyebrow={<FichaRotulo leadId={leadId} />}
      footer={leadId ? <Button onClick={() => onFichaCompleta(leadId)} icon={<PencilSimple aria-hidden />}>Editar e ver tudo</Button> : undefined}
    >
      {leadId && <FichaCorpo key={leadId} leadId={leadId} onMover={onMover} onPerder={onPerder} onClose={onClose} />}
    </SidePanel>
  );
}

function useViagem(leadId: string | null) {
  return useQuery({ queryKey: ["lead", leadId], queryFn: () => fetchLeadById(leadId!), enabled: !!leadId });
}

function FichaTitulo({ leadId }: { leadId: string | null }) {
  const { data } = useViagem(leadId);
  return <span style={{ fontSize: 28 }}>{data?.name ?? "Carregando…"}</span>;
}

function FichaRotulo({ leadId }: { leadId: string | null }) {
  const { data: v } = useViagem(leadId);
  if (!v) return <>Viagem · fase comercial</>;
  return <>{["Viagem · fase comercial", v.created_at && `criada em ${dataCurta(v.created_at)}`, origemTexto(v.origin)].filter(Boolean).join(" · ")}</>;
}

function FichaCorpo({ leadId, onMover, onPerder, onClose }: { leadId: string; onMover: (v: Lead, etapa: Etapa) => void; onPerder: (v: Lead) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: v, isLoading } = useViagem(leadId);
  const { data: tarefas = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const { data: atividades = [] } = useQuery({ queryKey: ["lead-activities", leadId], queryFn: () => fetchLeadActivities(leadId) });
  const { data: roteiros = [] } = useQuery({ queryKey: ["lead-itineraries", leadId], queryFn: () => fetchItinerariesByLead(leadId) });
  const clientId = v?.client_id ?? null;
  const { data: viajante } = useQuery({ queryKey: ["client", clientId], queryFn: () => fetchClientById(clientId!), enabled: !!clientId });

  const [aba, setAba] = useState<Aba>("resumo");
  const registroRef = useRef<HTMLTextAreaElement>(null);
  const passo = useMemo(() => proximosPassos(tarefas).get(leadId), [tarefas, leadId]);

  const atualizar = () => {
    for (const k of [["lead", leadId], ["leads"], ["tasks"], ["lead-activities", leadId], ["dashboard"], ["lead-itineraries", leadId], ["lead-itinerary-statuses"]]) {
      qc.invalidateQueries({ queryKey: k });
    }
  };

  const reabrir = useMutation({
    mutationFn: async (viagem: Lead) => {
      const r = await updateLead(viagem.id, { status: "negotiating", profile: { lost_reason: null } });
      if (!r) throw new Error("falhou");
      await createTask({ lead_id: viagem.id, title: "Retomar contato", due_date: dataDoPasso("hoje"), assigned_to: viagem.assigned_to || getMemberId() });
    },
    onSuccess: () => { toast("Viagem reaberta em Negociando. Próximo passo: retomar contato hoje"); atualizar(); },
    onError: () => toast.error("Não foi possível reabrir. Tente de novo."),
  });

  const criarViagem = useMutation({
    mutationFn: async (viagem: Lead) => {
      const raw = campoDoPerfil(viagem, "travel_dates");
      const datas = /^(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})$/.exec(raw);
      const pax = Number((viagem.profile as { passengers?: unknown } | undefined)?.passengers) || 1;
      const r = await createItinerary({
        lead_id: viagem.id, title: `Roteiro - ${viagem.name}`, status: "draft", client_name: viagem.name,
        destination: viagem.destination || "", budget: valorDe(viagem), passengers: pax,
        start_date: datas?.[1] || null, end_date: datas?.[2] || null,
      });
      if (!r) throw new Error("falhou");
      return r;
    },
    onSuccess: (r, viagem) => {
      toast(`Viagem criada para ${viagem.name}`);
      atualizar();
      onClose();
      navigate({ to: "/roteiros/$id", params: { id: r.id } });
    },
    onError: () => toast.error("Não foi possível criar a viagem. Tente de novo."),
  });

  if (isLoading || !v) {
    return (
      <div className="ds-stack">
        <Skeleton height={20} width="60%" />
        <Skeleton height={44} radius={999} />
        <Skeleton height={140} radius={18} />
        <Skeleton height={220} radius={18} />
      </div>
    );
  }

  const idx = ETAPAS.findIndex((e) => e.id === v.status);
  const valor = valorDe(v);
  const sub = [v.destination || "Destino a definir", quandoTexto(v), passageirosTexto(v)].filter(Boolean).join(" · ");
  const tel = (v.phone || viajante?.whatsapp || viajante?.phone || "").trim();
  const email = (v.email || viajante?.email || "").trim();
  const wa = whatsappLink(tel);
  const totalHist = atividades.length + 1;

  const irRegistrar = () => {
    setAba("hist");
    setTimeout(() => registroRef.current?.focus(), 50);
  };

  return (
    <>
      <div className="ds-stack" style={{ gap: 8 }}>
        <p className="ds-ficha-sub">{sub}</p>
        <div className="ds-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <b className={`ds-ficha-valor${valor ? "" : " ds-nd"}`}>{valor ? dinheiro(valor) : "Valor a definir"}</b>
          {valor > 0 && <span className="ds-muted">orçamento do cliente</span>}
        </div>
      </div>

      {v.status === "lost" ? (
        <div className="ds-tip">
          <XCircle size={22} aria-hidden />
          <div style={{ flex: 1 }}>
            <b>Viagem perdida</b>
            <br />
            <span className="ds-muted">{motivoDaPerda(v) || "Motivo não registrado"}</span>
          </div>
          <Button loading={reabrir.isPending} onClick={() => reabrir.mutate(v)}>Reabrir</Button>
        </div>
      ) : (
        <div className="ds-stack" style={{ gap: 8 }}>
          <div className="ds-etapas" role="group" aria-label="Etapa da viagem">
            {ETAPAS.slice(0, 4).map((e, i) => (
              <button
                key={e.id}
                type="button"
                className={i < idx ? "ds-feita" : i === idx ? "ds-atual" : undefined}
                aria-current={i === idx ? "step" : undefined}
                onClick={() => e.id !== v.status && onMover(v, e.id)}
              >
                {i < idx && <Check weight="bold" aria-hidden />}
                {e.label}
              </button>
            ))}
          </div>
          {v.status !== "closed" && (
            <button type="button" className="ds-perder" onClick={() => onPerder(v)}>Marcar como perdida</button>
          )}
        </div>
      )}

      {v.status === "closed" ? (
        <HighlightCard className="ds-proximo">
          <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>Viagem fechada</span>
          <b className="ds-h3">{roteiros.length ? "A viagem já foi criada" : "Agora crie a viagem para montar o roteiro"}</b>
          <div className="ds-row">
            {roteiros.length ? (
              <Button variant="primary" onClick={() => { onClose(); navigate({ to: "/roteiros/$id", params: { id: roteiros[0].id } }); }}>
                Abrir viagem <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button variant="primary" loading={criarViagem.isPending} onClick={() => criarViagem.mutate(v)}>
                Criar viagem <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </HighlightCard>
      ) : v.status !== "lost" ? (
        <BlocoProximoPasso viagem={v} passo={passo} onFeito={atualizar} />
      ) : null}

      {v.status !== "lost" && (
        <section className="ds-stack" style={{ gap: 10 }}>
          <div className="ds-row" style={{ justifyContent: "space-between" }}>
            <span className="ds-mono">Proposta, contrato e guia</span>
          </div>
          <JourneySteps steps={jornada(v, roteiros.length > 0)} />
        </section>
      )}

      <div className="ds-acoes" role="group" aria-label="Contato">
        <a className="ds-acao" href={wa ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!wa} title={wa ? undefined : "Sem WhatsApp cadastrado"}>
          <WhatsappLogo aria-hidden /><span>WhatsApp</span>
        </a>
        <a className="ds-acao" href={tel ? `tel:${tel.replace(/[^\d+]/g, "")}` : undefined} aria-disabled={!tel}>
          <Phone aria-hidden /><span>Ligar</span>
        </a>
        <a className="ds-acao" href={email ? `mailto:${email}` : undefined} aria-disabled={!email}>
          <EnvelopeSimple aria-hidden /><span>E-mail</span>
        </a>
        <button type="button" className="ds-acao" onClick={irRegistrar}>
          <PencilSimple aria-hidden /><span>Registrar</span>
        </button>
      </div>

      <Tabs
        label="Seções da ficha"
        value={aba}
        onChange={setAba}
        options={[{ value: "resumo", label: "Resumo" }, { value: "hist", label: "Histórico", count: totalHist }, { value: "orc", label: "Orçamento" }]}
      />

      {aba === "resumo" && <Resumo viagem={v} viajante={viajante ?? null} onAbrirViajante={() => { onClose(); navigate({ to: "/clientes", search: { p: v.client_id! } }); }} />}
      {aba === "hist" && <Historico viagem={v} atividades={atividades} textoRef={registroRef} onRegistrado={atualizar} />}
      {aba === "orc" && <Orcamento viagem={v} />}
    </>
  );
}

function jornada(v: Lead, temRoteiro: boolean): JourneyStep[] {
  const fechada = v.status === "closed";
  return [
    { title: "Proposta", state: fechada ? "done" : v.status === "negotiating" ? "current" : "todo", note: fechada ? "Aceita" : v.status === "negotiating" ? "Em negociação" : "Ainda não enviada" },
    { title: "Contrato", state: fechada ? "current" : "todo", note: fechada ? "Pronto para enviar" : "Depois do aceite" },
    { title: "Pagamento", state: "todo", note: "Depois do contrato" },
    { title: "Roteiro e guia", state: temRoteiro ? "current" : "todo", note: temRoteiro ? "Roteiro em montagem" : "Depois do pagamento" },
  ];
}

// ── Próximo passo ──────────────────────────────────────────────────
function BlocoProximoPasso({ viagem: v, passo, onFeito }: { viagem: Lead; passo: ProximoPasso | undefined; onFeito: () => void }) {
  const [modo, setModo] = useState<"ver" | "definir" | "reagendar">("ver");
  const [novaData, setNovaData] = useState(passo?.tarefa.due_date?.slice(0, 10) ?? "");

  const concluir = useMutation({
    mutationFn: async () => {
      if (!passo) return;
      const r = await updateTask(passo.tarefa.id, { completed: true });
      if (!r) throw new Error("falhou");
      await marcarContato(v.id);
    },
    onSuccess: () => { toast("Passo concluído e registrado no histórico"); setModo("definir"); onFeito(); },
    onError: () => toast.error("Não foi possível concluir. Tente de novo."),
  });

  const reagendar = useMutation({
    mutationFn: async () => {
      if (!passo || !novaData) throw new Error("sem data");
      const r = await updateTask(passo.tarefa.id, { due_date: novaData });
      if (!r) throw new Error("falhou");
    },
    onSuccess: () => { toast(`Reagendado para ${quandoPasso(novaData).toLowerCase()}`); setModo("ver"); onFeito(); },
    onError: () => toast.error("Não foi possível reagendar."),
  });

  if (modo === "definir" || (!passo && modo === "ver")) {
    return <DefinirPasso viagem={v} semPasso={!passo && modo === "ver"} onPronto={() => { setModo("ver"); onFeito(); }} onCancelar={passo ? () => setModo("ver") : undefined} />;
  }

  if (!passo) return null;
  return (
    <HighlightCard className="ds-proximo">
      <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>Próximo passo</span>
      <b className="ds-h3">{passo.tarefa.title}</b>
      <span className={`ds-quando${passo.atrasado ? " ds-late" : ""}`}>
        {passo.atrasado ? <Warning weight="fill" aria-hidden /> : <Clock aria-hidden />}
        {quandoPasso(passo.tarefa.due_date)}
      </span>
      {modo === "reagendar" ? (
        <div className="ds-row" style={{ alignItems: "flex-end" }}>
          <Field label="Nova data" type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
          <Button variant="primary" loading={reagendar.isPending} disabled={!novaData} onClick={() => reagendar.mutate()}>Salvar</Button>
          <Button variant="link" onClick={() => setModo("ver")}>Cancelar</Button>
        </div>
      ) : (
        <div className="ds-row">
          <Button variant="primary" icon={<Check weight="bold" aria-hidden />} loading={concluir.isPending} onClick={() => concluir.mutate()}>Concluir e definir o próximo</Button>
          <Button icon={<CalendarBlank aria-hidden />} onClick={() => setModo("reagendar")}>Reagendar</Button>
        </div>
      )}
    </HighlightCard>
  );
}

const QUANDO = [
  { value: "hoje", label: "Hoje" },
  { value: "amanha", label: "Amanhã" },
  { value: "semana", label: "Esta semana" },
  { value: "data", label: "Outra data" },
] as const;

export function CamposPasso({ titulo, setTitulo, quando, setQuando, data, setData, erro }: {
  titulo: string; setTitulo: (s: string) => void;
  quando: string; setQuando: (s: (typeof QUANDO)[number]["value"]) => void;
  data: string; setData: (s: string) => void;
  erro?: string;
}) {
  return (
    <div className="ds-stack" style={{ gap: 10 }}>
      <Field label="Próximo passo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Enviar opções de hotel" error={erro} />
      <Seg label="Quando fazer" value={quando as (typeof QUANDO)[number]["value"]} onChange={setQuando} options={QUANDO.map((q) => ({ ...q }))} />
      {quando === "data" && <Field label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />}
    </div>
  );
}

function DefinirPasso({ viagem: v, semPasso, onPronto, onCancelar }: { viagem: Lead; semPasso: boolean; onPronto: () => void; onCancelar?: () => void }) {
  const [titulo, setTitulo] = useState(SUGESTAO[v.status] ?? "");
  const [quando, setQuando] = useState<string>("amanha");
  const [data, setData] = useState("");
  const [tentou, setTentou] = useState(false);
  const [aberto, setAberto] = useState(!semPasso);

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await createTask({ lead_id: v.id, title: titulo.trim(), due_date: dataDoPasso(quando, data), assigned_to: v.assigned_to || getMemberId() });
      if (!r) throw new Error("falhou");
    },
    onSuccess: () => { toast(`Próximo passo: ${titulo.trim().toLowerCase()}, ${quandoPasso(dataDoPasso(quando, data)).toLowerCase()}`); onPronto(); },
    onError: () => toast.error("Não foi possível salvar o próximo passo."),
  });

  if (!aberto) {
    return (
      <Card className="ds-proximo">
        <span className="ds-mono" style={{ color: "var(--warning)" }}>Sem próximo passo</span>
        <b className="ds-h3">Toda viagem aberta precisa de um próximo passo com data</b>
        <span className="ds-muted">Assim ela aparece na sua agenda e não fica esquecida.</span>
        <div className="ds-row"><Button variant="primary" icon={<Plus weight="bold" aria-hidden />} onClick={() => setAberto(true)}>Definir próximo passo</Button></div>
      </Card>
    );
  }
  return (
    <HighlightCard className="ds-proximo">
      <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>{semPasso ? "Definir próximo passo" : "E agora, qual o próximo passo?"}</span>
      <CamposPasso titulo={titulo} setTitulo={setTitulo} quando={quando} setQuando={setQuando} data={data} setData={setData} erro={tentou && !titulo.trim() ? "Escreva o próximo passo." : undefined} />
      <div className="ds-row">
        <Button
          variant="primary"
          loading={salvar.isPending}
          onClick={() => {
            setTentou(true);
            if (titulo.trim() && (quando !== "data" || data)) salvar.mutate();
          }}
        >
          Salvar próximo passo
        </Button>
        <Button variant="link" onClick={() => (onCancelar ? onCancelar() : setAberto(false))}>Agora não</Button>
      </div>
    </HighlightCard>
  );
}

// ── Resumo ─────────────────────────────────────────────────────────
function Linha({ termo, children, vazio = "Não informado" }: { termo: string; children?: ReactNode; vazio?: string }) {
  const tem = children !== undefined && children !== null && children !== "";
  return (
    <>
      <dt>{termo}</dt>
      <dd className={tem ? undefined : "ds-nd"}>{tem ? children : vazio}</dd>
    </>
  );
}

function Resumo({ viagem: v, viajante, onAbrirViajante }: { viagem: Lead; viajante: import("@/lib/types").Client | null; onAbrirViajante: () => void }) {
  const prefs = [campoDoPerfil(v, "flight_class"), campoDoPerfil(v, "hotel_category"), campoDoPerfil(v, "room_type"), campoDoPerfil(v, "preferences")].filter(Boolean).join(" · ");
  const passaporte = situacaoPassaporte(viajante?.passport_expiry);
  const temPassaporte = campoDoPerfil(v, "has_passport");
  const milhas = (v.benefits?.miles ?? []).filter((m) => m.program);
  const extras = (v.benefits?.perks ?? []).map((p) => [p.type, p.description].filter(Boolean).join(": ")).filter(Boolean);
  const milhasTexto = [campoDoPerfil(v, "loyalty_programs"), campoDoPerfil(v, "points_miles")].filter(Boolean).join(" · ");
  const obs = campoDoPerfil(v, "trip_notes") || (v.notes ?? "").trim();

  return (
    <div className="ds-stack" style={{ gap: 24 }}>
      <section className="ds-stack" style={{ gap: 10 }}>
        <span className="ds-mono">Viagem</span>
        <dl className="ds-dados">
          <Linha termo="Destino" vazio="A definir">{v.destination}</Linha>
          <Linha termo="Saída de">{campoDoPerfil(v, "departure")}</Linha>
          <Linha termo="Quando" vazio="A definir">{quandoTexto(v)}</Linha>
          <Linha termo="Passageiros">{passageirosTexto(v)}</Linha>
          <Linha termo="Tipo">{campoDoPerfil(v, "trip_type")}</Linha>
          {prefs && <Linha termo="Preferências">{prefs}</Linha>}
          {obs && <Linha termo="Observações">{obs}</Linha>}
        </dl>
      </section>

      <section className="ds-stack" style={{ gap: 10 }}>
        <span className="ds-mono">Viajante</span>
        <dl className="ds-dados">
          <Linha termo="WhatsApp">{v.phone || viajante?.whatsapp || viajante?.phone}</Linha>
          <Linha termo="E-mail">{v.email || viajante?.email}</Linha>
          <Linha termo="Passaporte">
            {passaporte ? (
              <>{passaporte.texto} <Chip tone={passaporte.tom}>{passaporte.tom === "ok" ? "OK" : passaporte.tom === "warn" ? "Renovar" : "Vencido"}</Chip></>
            ) : temPassaporte ? temPassaporte : undefined}
          </Linha>
        </dl>
        {v.client_id && (
          <button type="button" className="ds-link" style={{ alignSelf: "flex-start" }} onClick={onAbrirViajante}>
            Abrir na base de viajantes <ArrowRight aria-hidden />
          </button>
        )}
      </section>

      <section className="ds-stack" style={{ gap: 10 }}>
        <span className="ds-mono">Milhas e benefícios</span>
        {milhas.length > 0 ? (
          <HBars label="Milhas por programa" bars={milhas.map((m) => ({ label: m.program, value: Number(m.amount) || 0, display: m.amount ? `${(Number(m.amount) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : "—" }))} />
        ) : null}
        {milhas.length === 0 && milhasTexto && <span>{milhasTexto}</span>}
        {extras.length > 0 && <span className="ds-muted">{extras.join(" · ")}</span>}
        {milhas.length === 0 && !milhasTexto && extras.length === 0 && <span className="ds-muted">Nenhum programa registrado.</span>}
      </section>
    </div>
  );
}

// ── Histórico ──────────────────────────────────────────────────────
function Historico({ viagem: v, atividades, textoRef, onRegistrado }: { viagem: Lead; atividades: LeadActivity[]; textoRef: React.RefObject<HTMLTextAreaElement | null>; onRegistrado: () => void }) {
  const [tipo, setTipo] = useState<TipoRegistro>("whatsapp");
  const [texto, setTexto] = useState("");
  const [tentou, setTentou] = useState(false);

  const registrar = useMutation({
    mutationFn: async () => {
      const label = TIPOS_REGISTRO.find((t) => t.value === tipo)!.label;
      const r = await createLeadActivity(v.id, { type: tipo, title: label, details: texto.trim() });
      if (!r) throw new Error("falhou");
    },
    onSuccess: () => { setTexto(""); setTentou(false); toast("Registrado no histórico"); onRegistrado(); },
    onError: () => toast.error("Não foi possível registrar. Tente de novo."),
  });

  // Ordena aqui: registros novos não gravam `created_at` e vêm sem ordem do banco.
  const ordenadas = [...atividades].sort((a, b) => (parseData(b.created_at)?.getTime() ?? 0) - (parseData(a.created_at)?.getTime() ?? 0));
  const entradas: HistoryEntry[] = ordenadas.map((a) => {
    const nome = NOME_ATIVIDADE[a.type] ?? "";
    const atrasada = !!a.due_date && !a.completed && (parseData(a.due_date)?.getTime() ?? Infinity) < new Date(new Date().toDateString()).getTime();
    const tarefa = !!a.due_date;
    const corpo = tarefa
      ? <>{atrasada ? "Tarefa atrasada: " : a.completed ? "Feito: " : "Tarefa: "}<b>{a.title}</b>{a.details ? ` · ${a.details}` : ""}</>
      : <>{nome && a.title === nome ? `${nome}: ` : nome ? `${nome} · ${a.title}: ` : `${a.title}: `}{a.details || ""}</>;
    const quem = a.author?.name ? ` · ${a.author.name.split(" ")[0]}` : "";
    return {
      id: a.id,
      icon: atrasada ? <Warning aria-hidden /> : tarefa ? (a.completed ? <Check aria-hidden /> : <ClipboardText aria-hidden />) : ICONE_ATIVIDADE[a.type] ?? <Kanban aria-hidden />,
      text: corpo,
      meta: atrasada ? `Venceu ${dataCurta(a.due_date)}${quem}` : `${tarefa && !a.completed ? `Para ${quandoPasso(a.due_date).toLowerCase()} · ` : ""}${dataHora(a.created_at)}${quem}`,
      bad: atrasada,
    };
  });
  entradas.sort((a, b) => Number(b.bad) - Number(a.bad));
  entradas.push({ id: "criada", icon: <Plus aria-hidden />, text: `Viagem criada${v.origin ? ` a partir de ${origemTexto(v.origin)}` : ""}`, meta: dataCurta(v.created_at) });

  return (
    <div className="ds-stack">
      <form
        className="ds-registro"
        onSubmit={(e) => {
          e.preventDefault();
          setTentou(true);
          if (texto.trim()) registrar.mutate();
        }}
      >
        <Seg label="Tipo de registro" value={tipo} onChange={setTipo} options={TIPOS_REGISTRO.map((t) => ({ value: t.value, label: t.label }))} />
        <TextField ref={textoRef} label="O que aconteceu" rows={2} placeholder="O que aconteceu nesse contato?" value={texto} onChange={(e) => setTexto(e.target.value)} error={tentou && !texto.trim() ? "Escreva o que aconteceu." : undefined} />
        <div className="ds-row" style={{ justifyContent: "flex-end" }}>
          <Button type="submit" loading={registrar.isPending}>Registrar</Button>
        </div>
      </form>
      <History entries={entradas} />
    </div>
  );
}

// ── Orçamento ──────────────────────────────────────────────────────
function Orcamento({ viagem: v }: { viagem: Lead }) {
  const { data: itens = [], isLoading } = useQuery({ queryKey: ["trip-expenses", v.id], queryFn: () => fetchTripExpenses(v.id) });
  const trouxe = Number(v.budget_client) || valorDe(v);
  const proposta = Number(v.budget_osv) || itens.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const economia = trouxe && proposta ? trouxe - proposta : 0;
  const pct = trouxe && proposta ? Math.round((proposta / trouxe) * 100) : null;

  return (
    <div className="ds-stack" style={{ gap: 22 }}>
      <KpiRow
        items={[
          { label: "Cliente trouxe", value: trouxe ? dinheiroCurto(trouxe) : "A definir", delta: { text: "Orçamento que ele pesquisou", direction: "flat" } },
          {
            label: "Proposta da agência",
            value: proposta ? dinheiroCurto(proposta) : "Ainda não montada",
            delta: economia > 0 ? { text: `${dinheiroCurto(economia)} de economia`, direction: "up" } : economia < 0 ? { text: `${dinheiroCurto(-economia)} acima do orçamento`, direction: "down" } : undefined,
          },
        ]}
      />
      {pct !== null && (
        <Meter
          label="Uso do orçamento"
          value={proposta}
          max={trouxe}
          display={`${pct}%`}
          state={pct <= 100 ? "ok" : pct <= 110 ? "warn" : "bad"}
          status={pct <= 100 ? "Proposta dentro do orçamento" : "Proposta acima do orçamento"}
        />
      )}
      {isLoading ? (
        <Skeleton height={120} radius={16} />
      ) : itens.length ? (
        <table className="ds-tbl">
          <thead><tr><th>Item</th><th>Pago com</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id}>
                <td>{CATEGORIA[i.category] ?? i.category}{i.description ? <small className="ds-muted" style={{ display: "block" }}>{i.description}</small> : null}</td>
                <td>{PAGO_COM[i.paid_with] ?? i.paid_with}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{dinheiro(Number(i.amount) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ds-muted" style={{ margin: 0 }}>Os itens aparecem aqui quando a proposta for montada, com a forma de pagamento de cada um.</p>
      )}
    </div>
  );
}

