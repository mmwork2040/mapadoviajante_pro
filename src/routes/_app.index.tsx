import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AirplaneTilt, ArrowRight, Check, CheckSquare, Kanban, Plus, Warning, WhatsappLogo } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth";
import { cleanTaskDescription, fetchItineraries, fetchLeads, fetchTasks, getMemberId, updateTask } from "@/lib/services";
import { useResolvedImageUrl } from "@/hooks/useResolvedImageUrl";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import {
  Avatar,
  Button,
  Chip,
  DataTable,
  Empty,
  ErrorBox,
  Funnel,
  HighlightCard,
  IconBox,
  KpiRow,
  Mini,
  PageTitle,
  Progress,
  SectionHeader,
  Seg,
  Skeleton,
  buttonClass,
} from "@/components/ds";
import {
  agendaDo,
  comecePorAqui,
  dinheiro,
  dinheiroCurto,
  estaAtrasada,
  etapaLabel,
  funil,
  numerosDoMes,
  parseData,
  periodoCurto,
  progressoChecklist,
  proximosEmbarques,
  semResposta,
  whatsappLink,
  type Periodo,
  diaMes,
} from "@/data/viagens";
import type { Itinerary, Lead, Task } from "@/lib/types";

export const Route = createFileRoute("/_app/")({ component: Hoje });

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Hoje() {
  const { member } = useAuth();
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  const viagensQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}) });
  const tarefasQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const roteirosQ = useQuery({ queryKey: ["itineraries"], queryFn: fetchItineraries });

  // Hoje é o painel de quem está usando: só o que é dela (ou sem responsável).
  const meuId = getMemberId();
  const meu = (dono?: string | null) => !dono || !meuId || dono === meuId;
  const viagens = useMemo(() => (viagensQ.data ?? []).filter((v) => !v.archived_at && meu(v.assigned_to)), [viagensQ.data, meuId]);
  const tarefas = useMemo(() => (tarefasQ.data ?? []).filter((t) => meu(t.assigned_to)), [tarefasQ.data, meuId]);
  const roteiros = roteirosQ.data ?? [];

  const concluir = useMutation({
    mutationFn: (t: Task) => updateTask(t.id, { completed: true }),
    onSuccess: (_r, t) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast(`Concluído: ${t.title}`);
    },
    onError: () => toast.error("Não foi possível concluir. Tente de novo."),
  });

  const hojeItens = agendaDo(tarefas, "hoje");
  const pendentes = hojeItens.filter((t) => !t.completed && !estaAtrasada(t)).length;
  const atrasados = hojeItens.filter(estaAtrasada).length;
  const contagem = { hoje: hojeItens.length, amanha: agendaDo(tarefas, "amanha").length, semana: agendaDo(tarefas, "semana").length };
  const itens = agendaDo(tarefas, periodo);
  const foco = useMemo(() => comecePorAqui(viagens, tarefas), [viagens, tarefas]);
  const n = useMemo(() => numerosDoMes(viagens, roteiros), [viagens, roteiros]);
  const paradas = useMemo(() => semResposta(viagens).slice(0, 6), [viagens]);
  const etapas = useMemo(() => funil(viagens), [viagens]);
  const embarques = useMemo(() => proximosEmbarques(roteiros, 120).slice(0, 4), [roteiros]);
  const porId = useMemo(() => new Map((viagensQ.data ?? []).map((v) => [v.id, v])), [viagensQ.data]);

  const carregando = viagensQ.isLoading || tarefasQ.isLoading;
  const erro = viagensQ.isError || tarefasQ.isError;
  const primeiroNome = (member?.name || "").trim().split(/\s+/)[0];
  const dataHoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageTitle
        eyebrow={dataHoje}
        title={primeiroNome ? `${saudacao()}, ${primeiroNome}` : saudacao()}
        summary={
          carregando ? (
            "Carregando o seu dia…"
          ) : pendentes + atrasados === 0 ? (
            "Nada na agenda de hoje."
          ) : (
            <>
              Você tem <b>{plural(pendentes, "compromisso", "compromissos")}</b> hoje
              {atrasados > 0 && <> e <b>{plural(atrasados, "atrasado", "atrasados")}</b></>}.
            </>
          )
        }
      />

      {erro && (
        <ErrorBox onRetry={() => { viagensQ.refetch(); tarefasQ.refetch(); }}>Não foi possível carregar as suas viagens e a agenda.</ErrorBox>
      )}

      {foco && (
        <HighlightCard className="ds-focus" role="region" aria-label="Comece por aqui">
          <IconBox accent><Warning size={20} aria-hidden /></IconBox>
          <div>
            <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>Comece por aqui</span>
            <b className="ds-h3">
              {foco.tipo === "passo-atrasado" && `${foco.passo.tarefa.title} · ${foco.viagem.name}`}
              {foco.tipo === "sem-contato" && `${foco.viagem.name} está sem resposta há ${plural(foco.dias, "dia", "dias")}`}
              {foco.tipo === "nova" && `${foco.viagem.name} pediu uma viagem e ainda não teve contato`}
            </b>
            <p>
              {foco.tipo === "passo-atrasado" && `O próximo passo desta viagem está atrasado. Ela está em ${etapaLabel(foco.viagem.status)}${foco.viagem.value ? `, com ${dinheiro(Number(foco.viagem.value))} em jogo` : ""}.`}
              {foco.tipo === "sem-contato" && `${foco.viagem.destination || "Destino a definir"} · ${etapaLabel(foco.viagem.status)}${foco.viagem.value ? ` · ${dinheiro(Number(foco.viagem.value))}` : ""}. Um contato hoje mantém a negociação viva.`}
              {foco.tipo === "nova" && `${foco.viagem.destination || "Destino a definir"}. O primeiro contato rápido é o que mais pesa para fechar.`}
            </p>
          </div>
          <Button variant="primary" onClick={() => setAberta(foco.viagem.id)}>
            Abrir <ArrowRight weight="bold" aria-hidden />
          </Button>
        </HighlightCard>
      )}

      <section aria-label="Seus números do mês">
        {carregando ? (
          <Skeleton height={86} radius={14} />
        ) : (
          <KpiRow
            items={[
              {
                label: `Vendido em ${n.mes}`,
                value: dinheiroCurto(n.vendido),
                delta: n.variacao === null ? { text: `Sem vendas em ${n.mesAnterior} para comparar` } : { text: `${Math.abs(n.variacao)}% ${n.variacao >= 0 ? "sobre" : "abaixo de"} ${n.mesAnterior}`, direction: n.variacao >= 0 ? "up" : "down" },
              },
              { label: "Em negociação", value: dinheiroCurto(n.emNegociacao), delta: { text: `${plural(n.negociando, "viagem", "viagens")} · ${plural(n.abertas, "aberta", "abertas")} no total` } },
              { label: "Conversão em 90 dias", value: n.conversao === null ? "—" : `${n.conversao}%`, delta: { text: n.conversao === null ? "Nenhuma viagem criada em 90 dias" : `${plural(n.fechadas90, "fechada", "fechadas")} de ${n.criadas90}` } },
              { label: "Embarques em 60 dias", value: roteirosQ.isError ? "—" : n.embarques, delta: { text: roteirosQ.isError ? "Não foi possível carregar" : n.diasProximo === null ? "Nenhum embarque marcado" : n.diasProximo === 0 ? "O próximo é hoje" : `${plural(n.diasProximo, "dia", "dias")} para o próximo` } },
            ]}
          />
        )}
      </section>

      <div className="ds-side2">
        <div className="ds-stack" style={{ gap: 30 }}>
          <section className="ds-stack" aria-labelledby="ag-t">
            <SectionHeader title={<span id="ag-t">Agenda</span>} wrap>
              <Seg
                label="Período"
                value={periodo}
                onChange={setPeriodo}
                options={[
                  { value: "hoje", label: "Hoje", count: contagem.hoje },
                  { value: "amanha", label: "Amanhã", count: contagem.amanha },
                  { value: "semana", label: "Semana", count: contagem.semana },
                ]}
              />
            </SectionHeader>
            {tarefasQ.isLoading ? (
              <div className="ds-stack"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>
            ) : itens.length === 0 ? (
              <Empty title={periodo === "hoje" ? "Nada para hoje" : periodo === "amanha" ? "Nada para amanhã" : "Semana livre"} action={<Button icon={<Plus weight="bold" aria-hidden />} onClick={() => setNova(true)}>Nova tarefa</Button>}>
                Tarefas e compromissos com data aparecem aqui.
              </Empty>
            ) : (
              <div>
                {itens.map((t) => (
                  <LinhaAgenda key={t.id} tarefa={t} viagem={t.lead_id ? porId.get(t.lead_id) : undefined} periodo={periodo} onAbrir={setAberta} onConcluir={() => concluir.mutate(t)} ocupado={concluir.isPending} />
                ))}
              </div>
            )}
            <Link to="/tarefas" className="ds-link">Ver agenda completa <ArrowRight aria-hidden /></Link>
          </section>

          <section className="ds-stack" aria-labelledby="pa-t">
            <SectionHeader title={<span id="pa-t">Negociações sem resposta</span>}>
              <Link to="/leads" className="ds-link">Ver comercial <ArrowRight aria-hidden /></Link>
            </SectionHeader>
            {viagensQ.isLoading ? (
              <Skeleton height={120} radius={14} />
            ) : paradas.length === 0 ? (
              <Empty title="Nenhuma negociação parada">Toda viagem aberta teve contato nos últimos 3 dias.</Empty>
            ) : (
              <DataTable
                caption="Viagens em negociação sem contato há 3 dias ou mais"
                rows={paradas}
                rowKey={(p) => p.viagem.id}
                onRowClick={(p) => setAberta(p.viagem.id)}
                columns={[
                  { id: "quem", header: "Viajante", cell: (p) => <span className="ds-row" style={{ gap: 10 }}><Avatar name={p.viagem.name} size="sm" />{p.viagem.name}</span> },
                  { id: "destino", header: "Destino", cell: (p) => p.viagem.destination || "A definir" },
                  { id: "etapa", header: "Etapa", cell: (p) => <Chip tone={p.viagem.status === "new" ? "now" : "neutral"}>{etapaLabel(p.viagem.status)}</Chip> },
                  { id: "valor", header: "Valor", numeric: true, cell: (p) => (p.viagem.value ? dinheiro(Number(p.viagem.value)) : "A definir") },
                  { id: "dias", header: "Sem contato", numeric: true, cell: (p) => <b style={{ color: p.dias >= 5 ? "var(--destructive)" : "var(--foreground)" }}>{plural(p.dias, "dia", "dias")}</b> },
                  { id: "acao", header: "", cell: (p) => <BotaoWhats nome={p.viagem.name} telefone={p.viagem.phone} /> },
                ]}
              />
            )}
          </section>
        </div>

        <aside className="ds-stack" style={{ gap: 30 }}>
          <section className="ds-stack" aria-labelledby="fu-t">
            <SectionHeader title={<span id="fu-t">Seu funil</span>} />
            {viagensQ.isLoading ? <Skeleton height={220} radius={14} /> : (
              <Funnel rows={etapas.map((e) => ({ id: e.id, label: e.label, count: e.count, note: e.valor > 0 ? dinheiroCurto(e.valor) : undefined, muted: e.muted }))} />
            )}
          </section>

          <section className="ds-stack" aria-labelledby="em-t">
            <SectionHeader title={<span id="em-t">Próximos embarques</span>} />
            {roteirosQ.isLoading ? (
              <Skeleton height={120} radius={14} />
            ) : roteirosQ.isError ? (
              <ErrorBox onRetry={() => roteirosQ.refetch()}>Não foi possível carregar os embarques.</ErrorBox>
            ) : embarques.length === 0 ? (
              <Empty title="Nenhum embarque marcado">Viagens com data de ida aparecem aqui.</Empty>
            ) : (
              <div>
                {embarques.map((e) => (
                  <LinhaEmbarque key={e.roteiro.id} roteiro={e.roteiro} dias={e.dias} viagem={e.roteiro.lead_id ? porId.get(e.roteiro.lead_id) : undefined} />
                ))}
              </div>
            )}
            <Link to="/roteiros" className={buttonClass("link")} style={{ alignSelf: "flex-start" }}>Ver preparação e viagem <ArrowRight aria-hidden /></Link>
          </section>
        </aside>
      </div>

      {aberta && <LeadDetailDrawer leadId={aberta} onClose={() => setAberta(null)} />}
      <CreateTaskModal open={nova} onOpenChange={setNova} />
    </>
  );
}

function BotaoWhats({ nome, telefone }: { nome: string; telefone?: string | null }) {
  const link = whatsappLink(telefone);
  if (!link) return null;
  return (
    <a className="ds-mini" href={link} target="_blank" rel="noreferrer" aria-label={`Chamar ${nome} no WhatsApp`} title="WhatsApp" onClick={(e) => e.stopPropagation()}>
      <WhatsappLogo aria-hidden />
    </a>
  );
}

function LinhaAgenda({ tarefa: t, viagem, periodo, onAbrir, onConcluir, ocupado }: {
  tarefa: Task;
  viagem?: Lead;
  periodo: Periodo;
  onAbrir: (id: string) => void;
  onConcluir: () => void;
  ocupado: boolean;
}) {
  const d = parseData(t.due_date);
  const atrasada = estaAtrasada(t);
  const temHora = !!d && /T\d{2}:\d{2}/.test(t.due_date || "") && !(d.getHours() === 0 && d.getMinutes() === 0) && !(d.getHours() === 12 && d.getMinutes() === 0);
  const quando = !d ? "—" : atrasada ? diaMes(t.due_date) : periodo === "semana" ? d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") : temHora ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Hoje";
  const sub = periodo === "semana" && temHora && d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : t.itinerary ? "Viagem" : "Tarefa";
  const nota = cleanTaskDescription(t.description);
  return (
    <div className={`ds-ag${atrasada ? " ds-late" : ""}`}>
      <time dateTime={t.due_date || undefined}>
        {quando}
        <small>{sub}</small>
      </time>
      <div className="ds-ag-bd">
        <b className={t.completed ? "ds-feito" : undefined}>{t.title}</b>
        <span>
          {t.itinerary ? <AirplaneTilt aria-hidden /> : t.lead ? <Kanban aria-hidden /> : <CheckSquare aria-hidden />}
          {viagem ? (
            <button type="button" className="ds-link" style={{ fontSize: 13, color: "inherit" }} onClick={() => onAbrir(viagem.id)}>
              {viagem.name} · {etapaLabel(viagem.status)}
            </button>
          ) : (
            t.lead?.name || t.itinerary?.title || nota?.slice(0, 80) || "Sem viagem ligada"
          )}
          {atrasada && <Chip tone="bad" icon={<Warning weight="fill" aria-hidden />}>Atrasada</Chip>}
          {t.completed && <Chip tone="ok" icon={<Check weight="bold" aria-hidden />}>Feito</Chip>}
        </span>
      </div>
      {!t.completed && (
        <div className="ds-ag-acts">
          {viagem && <BotaoWhats nome={viagem.name} telefone={viagem.phone} />}
          <Mini label={`Concluir: ${t.title}`} done disabled={ocupado} onClick={onConcluir}>
            <Check aria-hidden />
          </Mini>
        </div>
      )}
    </div>
  );
}

function LinhaEmbarque({ roteiro: r, dias, viagem }: { roteiro: Itinerary; dias: number; viagem?: Lead }) {
  const { url } = useResolvedImageUrl(r.cover_image);
  const ck = progressoChecklist(viagem?.checklists);
  return (
    <Link to="/roteiros/$id" params={{ id: r.id }} className="ds-trip">
      {url ? <img className="ds-trip-img" src={url} alt="" /> : <span className="ds-trip-img"><AirplaneTilt aria-hidden /></span>}
      <div>
        <b>{r.client_name || r.lead?.name || r.title}</b>
        <span>{[r.destination, periodoCurto(r.start_date, r.end_date)].filter(Boolean).join(" · ")}</span>
        {ck && (
          <span className="ds-row" style={{ gap: 8, marginTop: 4 }}>
            <span style={{ width: 90 }}><Progress label="Checklist da viagem" value={ck.feitos} max={ck.total} /></span>
            <small className="ds-muted">{ck.feitos}/{ck.total} itens</small>
          </span>
        )}
      </div>
      <div className="ds-trip-d">
        <strong>{dias}</strong>
        <small>{dias === 1 ? "dia" : "dias"}</small>
      </div>
    </Link>
  );
}
