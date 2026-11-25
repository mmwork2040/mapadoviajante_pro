// Tela Agenda: tarefas, contatos e datas automáticas. Lista, Semana e Mês.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AirplaneTilt, CalendarBlank, CaretLeft, CaretRight, Check, Columns, Kanban, ListBullets, Plus, Warning, WhatsappLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, Chip, Empty, ErrorBox, IconButton, Janela, Mini, PageTitle, Seg, Skeleton, ViewSwitcher } from "@/components/ds";
import {
  TIPO_LABEL, datasAutomaticas, filtrarAgenda, gruposDaLista, hoje, inicioDaSemana, itensDasTarefas, mesmoDia, ordenar, rotuloDia, somaDias, ymd,
  type FiltroAgenda, type ItemAgenda,
} from "@/data/agenda";
import { estaAberta, etapaLabel, whatsappLink } from "@/data/viagens";
import {
  fetchActivityTypes, fetchAgendaMinePref, fetchClients, fetchItineraries, fetchLeads, fetchTasks, getMemberId, getMemberRole, setAgendaMinePref, updateTask,
} from "@/lib/services";
import { useViewPref } from "@/lib/view-prefs";
import type { Task } from "@/lib/types";
import { NovoNaAgenda } from "./NovoNaAgenda";

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function AgendaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const gestor = ["admin", "gerente"].includes(getMemberRole() ?? "");
  const eu = getMemberId();

  const tarefasQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const viagensQ = useQuery({ queryKey: ["leads", { search: "", archived: false }], queryFn: () => fetchLeads({ archived: "active" }) });
  const roteirosQ = useQuery({ queryKey: ["itineraries"], queryFn: fetchItineraries });
  const clientesQ = useQuery({ queryKey: ["clients", ""], queryFn: () => fetchClients() });
  const tiposQ = useQuery({ queryKey: ["activity-types"], queryFn: fetchActivityTypes });
  const minhaQ = useQuery({ queryKey: ["agenda-mine-pref"], queryFn: fetchAgendaMinePref });

  const [vista, setVista] = useViewPref("agenda", ["lista", "semana", "mes"] as const, "lista");
  const [filtro, setFiltro] = useState<FiltroAgenda>("todos");
  const [soMinha, setSoMinha] = useState(true);
  useEffect(() => { if (typeof minhaQ.data === "boolean" && gestor) setSoMinha(minhaQ.data); }, [minhaQ.data, gestor]);
  const [ref, setRef] = useState(hoje()); // semana ou mês exibido
  const [janela, setJanela] = useState<{ tarefa?: Task; dia?: string } | null>(null);
  const [diaAberto, setDiaAberto] = useState<Date | null>(null);

  const viagens = useMemo(() => new Map((viagensQ.data ?? []).map((v) => [v.id, v])), [viagensQ.data]);
  const roteiros = useMemo(() => new Map((roteirosQ.data ?? []).map((r) => [r.id, r])), [roteirosQ.data]);

  const todos = useMemo(() => {
    const minhas = (tarefasQ.data ?? []).filter((t) => !gestor || !soMinha || !t.assigned_to || t.assigned_to === eu);
    const tarefas = itensDasTarefas(minhas, viagens, roteiros, tiposQ.data ?? {});
    const ativos = new Set<string>();
    for (const v of viagensQ.data ?? []) if (v.client_id && (estaAberta(v) || v.status === "closed")) ativos.add(v.client_id);
    return [...tarefas, ...datasAutomaticas(clientesQ.data ?? [], roteirosQ.data ?? [], ativos)];
  }, [tarefasQ.data, viagens, roteiros, tiposQ.data, clientesQ.data, roteirosQ.data, viagensQ.data, gestor, soMinha, eu]);
  const itens = useMemo(() => filtrarAgenda(todos, filtro), [todos, filtro]);

  const h = hoje();
  const paraHoje = todos.filter((i) => mesmoDia(i.dia, h) && !i.feito && i.tipo !== "auto").length;
  const atrasadas = todos.filter((i) => i.atrasado).length;

  const concluir = useMutation({
    mutationFn: async (i: ItemAgenda) => { if (!i.tarefa || !(await updateTask(i.tarefa.id, { completed: true }))) throw new Error("falhou"); },
    onMutate: async (i) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      qc.setQueryData<Task[]>(["tasks"], (old) => (old ?? []).map((t) => (t.id === i.id ? { ...t, completed: true } : t)));
      return { prev };
    },
    onError: (_e, _i, ctx) => { if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev); toast.error("Não foi possível concluir."); },
    onSuccess: (_r, i) => toast(`Feito: ${i.titulo}`),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const abrir = (i: ItemAgenda) => {
    if (i.tarefa) return setJanela({ tarefa: i.tarefa });
    if (i.roteiro) return navigate({ to: "/roteiros/$id", params: { id: i.roteiro.id } });
  };
  const abrirViagem = (i: ItemAgenda) =>
    i.viagem ? navigate({ to: "/leads", search: { lead: i.viagem.id } }) : i.roteiro ? navigate({ to: "/roteiros/$id", params: { id: i.roteiro.id } }) : undefined;

  const carregando = tarefasQ.isLoading || viagensQ.isLoading;
  const linha = (i: ItemAgenda, comDia: false | "semana" | "adiante" = false) => (
    <LinhaAgenda key={i.id} item={i} comDia={comDia} onAbrir={() => abrir(i)} onViagem={() => abrirViagem(i)} onConcluir={() => concluir.mutate(i)} />
  );

  return (
    <>
      <PageTitle
        title="Agenda"
        summary={
          carregando ? "Carregando…" : (
            <>
              {paraHoje} para hoje · <span style={{ color: atrasadas ? "var(--destructive)" : undefined }}>{atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}</span>
              <span className="ds-so-desk"> · aniversários, passaportes e embarques entram sozinhos</span>
            </>
          )
        }
        actions={<Button variant="primary" icon={<Plus weight="bold" aria-hidden />} onClick={() => setJanela({})}>Novo na agenda</Button>}
      />

      <div className="ds-filtros">
        {gestor && (
          <Seg
            label="De quem"
            value={soMinha ? "minha" : "equipe"}
            onChange={(v) => { const m = v === "minha"; setSoMinha(m); qc.setQueryData(["agenda-mine-pref"], m); void setAgendaMinePref(m); }}
            options={[{ value: "minha", label: "Minha" }, { value: "equipe", label: "Toda a equipe" }]}
          />
        )}
        <Seg label="Tipo" value={filtro} onChange={setFiltro} options={[{ value: "todos", label: "Tudo" }, { value: "tarefas", label: "Tarefas" }, { value: "contatos", label: "Contatos" }, { value: "auto", label: "Datas automáticas" }]} />
        <span className="ds-filtros-sp" />
        <ViewSwitcher
          value={vista}
          onChange={(v) => { setVista(v); setRef(hoje()); }}
          options={[{ value: "lista", label: "Lista", icon: <ListBullets aria-hidden /> }, { value: "semana", label: "Semana", icon: <Columns aria-hidden /> }, { value: "mes", label: "Mês", icon: <CalendarBlank aria-hidden /> }]}
        />
      </div>

      {tarefasQ.isError ? (
        <ErrorBox onRetry={() => tarefasQ.refetch()}>Não foi possível carregar a agenda.</ErrorBox>
      ) : carregando ? (
        <div className="ds-stack"><Skeleton height={60} radius={14} /><Skeleton height={60} radius={14} /><Skeleton height={60} radius={14} /></div>
      ) : vista === "lista" ? (
        <Lista itens={itens} linha={linha} onNovo={() => setJanela({})} />
      ) : vista === "semana" ? (
        <Semana itens={itens} ref0={ref} setRef={setRef} onAbrir={abrir} onNovo={(d) => setJanela({ dia: ymd(d) })} />
      ) : (
        <Mes itens={itens} ref0={ref} setRef={setRef} onDia={setDiaAberto} />
      )}

      <Janela
        open={!!diaAberto}
        onOpenChange={(o) => !o && setDiaAberto(null)}
        eyebrow={diaAberto ? diaAberto.toLocaleDateString("pt-BR", { weekday: "long" }) : ""}
        title={diaAberto ? diaAberto.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : ""}
        footer={<Button variant="primary" icon={<Plus aria-hidden />} onClick={() => { const d = diaAberto!; setDiaAberto(null); setJanela({ dia: ymd(d) }); }}>Novo neste dia</Button>}
      >
        {diaAberto && (() => {
          const doDia = itens.filter((i) => mesmoDia(i.dia, diaAberto)).sort(ordenar);
          return doDia.length ? <div>{doDia.map((i) => linha(i))}</div> : <Empty title="Dia livre">Nada marcado para este dia.</Empty>;
        })()}
      </Janela>

      <NovoNaAgenda aberto={!!janela} tarefa={janela?.tarefa} dia={janela?.dia} onFechar={() => setJanela(null)} />
    </>
  );
}

function LinhaAgenda({ item: i, comDia, onAbrir, onViagem, onConcluir }: { item: ItemAgenda; comDia: false | "semana" | "adiante"; onAbrir: () => void; onViagem: () => void; onConcluir: () => void }) {
  const wa = i.tipo !== "checklist" ? whatsappLink(i.viagem?.phone) : null;
  const contexto = i.viagem ? `${i.viagem.name} · ${i.viagem.destination || "viagem"} · ${etapaLabel(i.viagem.status)}` : i.roteiro ? `${i.roteiro.client_name || i.roteiro.title} · ${i.roteiro.destination || "viagem"} · preparação` : i.pessoa ? `${i.pessoa}${i.nota ? ` · ${i.nota}` : ""}` : i.nota ?? "Sem viagem ligada";
  return (
    <div className={`ds-ag${i.atrasado ? " ds-late" : ""}${i.feito ? " ds-feito" : ""}`}>
      <time>
        {comDia && <span className="ds-ag-d">{comDia === "semana" ? rotuloDia(i.dia, false) : i.dia.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>}
        {i.atrasado ? `${i.dia.getDate()}/${i.dia.getMonth() + 1}` : comDia === "adiante" ? `${i.dia.getDate()}${i.hora ? ` · ${i.hora}` : ""}` : comDia === "semana" ? `${i.dia.getDate()}${i.hora ? ` · ${i.hora}` : ""}` : i.hora || (i.tipo === "auto" ? "" : "Dia")}
        <small>{TIPO_LABEL[i.tipo]}</small>
      </time>
      <div className="ds-ag-bd ds-ag-clic" role="button" tabIndex={0} onClick={onAbrir} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onAbrir())}>
        <b>{i.titulo}</b>
        <span>
          {i.viagem ? <Kanban aria-hidden /> : i.roteiro ? <AirplaneTilt aria-hidden /> : <CalendarBlank aria-hidden />}
          {contexto}
          {i.atrasado && <Chip tone="bad" icon={<Warning weight="fill" aria-hidden />}>Atrasada</Chip>}
          {i.prioridadeAlta && !i.feito && <Chip tone="warn">Prioridade alta</Chip>}
        </span>
      </div>
      <div className="ds-ag-acts">
        {i.feito ? (
          <Chip tone="ok" icon={<Check weight="bold" aria-hidden />}>Feito</Chip>
        ) : (
          <>
            {wa && (
              <a className="ds-mini" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${i.viagem?.name}`} title="WhatsApp"><WhatsappLogo aria-hidden /></a>
            )}
            {(i.viagem || i.roteiro) && (
              <Mini label="Abrir viagem" onClick={onViagem}>{i.viagem ? <Kanban aria-hidden /> : <AirplaneTilt aria-hidden />}</Mini>
            )}
            {i.tarefa && <Mini label={`Concluir: ${i.titulo}`} done onClick={onConcluir}><Check aria-hidden /></Mini>}
          </>
        )}
      </div>
    </div>
  );
}

function Lista({ itens, linha, onNovo }: { itens: ItemAgenda[]; linha: (i: ItemAgenda, comDia?: false | "semana" | "adiante") => React.ReactNode; onNovo: () => void }) {
  const grupos = gruposDaLista(itens);
  if (!grupos.length) return <Empty title="Agenda livre" action={<Button variant="primary" onClick={onNovo}>Novo na agenda</Button>}>Nada marcado para os próximos dias.</Empty>;
  return (
    <div className="ds-stack" style={{ gap: 26 }}>
      {grupos.map((g) => (
        <section key={g.id} className="ds-stack" style={{ gap: 2 }}>
          <h2 className="ds-h2" style={g.id === "atrasadas" ? { color: "var(--destructive)" } : undefined}>
            {g.titulo} <span className="ds-muted">· {g.itens.length}</span>
          </h2>
          <div>{g.itens.map((i) => linha(i, g.id === "semana" ? "semana" : g.id === "adiante" ? "adiante" : false))}</div>
        </section>
      ))}
    </div>
  );
}

function NavPeriodo({ rotulo, onAnterior, onProximo, onHoje }: { rotulo: string; onAnterior: () => void; onProximo: () => void; onHoje: () => void }) {
  return (
    <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}>
      <div className="ds-nav-per">
        <IconButton label="Anterior" onClick={onAnterior}><CaretLeft aria-hidden /></IconButton>
        <b>{rotulo}</b>
        <IconButton label="Próximo" onClick={onProximo}><CaretRight aria-hidden /></IconButton>
      </div>
      <Button onClick={onHoje}>Hoje</Button>
    </div>
  );
}

function Semana({ itens, ref0, setRef, onAbrir, onNovo }: { itens: ItemAgenda[]; ref0: Date; setRef: (d: Date) => void; onAbrir: (i: ItemAgenda) => void; onNovo: (d: Date) => void }) {
  const ini = inicioDaSemana(ref0);
  const dias = Array.from({ length: 7 }, (_, k) => somaDias(ini, k));
  const h = hoje();
  const fim = dias[6];
  const semanaDeHoje = dias.some((d) => mesmoDia(d, h));
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return (
    <>
      <NavPeriodo
        rotulo={`${ini.getDate()} ${mes(ini)} a ${fim.getDate()} ${mes(fim)}`}
        onAnterior={() => setRef(somaDias(ini, -7))}
        onProximo={() => setRef(somaDias(ini, 7))}
        onHoje={() => setRef(hoje())}
      />
      <div className="ds-sem">
        {dias.map((d, k) => {
          const eHoje = mesmoDia(d, h);
          const l = itens
            // Na semana atual, o que está atrasado sobe para hoje e sai do dia original.
            .filter((i) => (mesmoDia(i.dia, d) && !(semanaDeHoje && i.atrasado)) || (eHoje && i.atrasado))
            .sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || ordenar(a, b));
          return (
            <section key={k} className={`ds-sem-d${eHoje ? " ds-hoje" : ""}`} aria-label={rotuloDia(d)}>
              <header><span>{SEMANA[k]}</span><b>{d.getDate()}</b></header>
              {l.length ? l.map((i) => (
                <button key={i.id} type="button" className={`ds-sem-i${i.atrasado ? " ds-late" : ""}${i.feito ? " ds-feito" : ""}${i.tipo === "auto" ? " ds-auto" : ""}`} onClick={() => onAbrir(i)}>
                  <small>{i.atrasado ? "Atrasada" : i.hora || TIPO_LABEL[i.tipo]}</small>
                  {i.titulo}
                  {(i.pessoa || i.nota) && <span>{i.pessoa || i.nota}</span>}
                </button>
              )) : <span className="ds-sem-vazio">Livre</span>}
              <button type="button" className="ds-sem-add" aria-label={`Novo em ${rotuloDia(d)}`} onClick={() => onNovo(d)}><Plus aria-hidden /></button>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Mes({ itens, ref0, setRef, onDia }: { itens: ItemAgenda[]; ref0: Date; setRef: (d: Date) => void; onDia: (d: Date) => void }) {
  const ini = new Date(ref0.getFullYear(), ref0.getMonth(), 1);
  const dias = new Date(ref0.getFullYear(), ref0.getMonth() + 1, 0).getDate();
  const vazias = (ini.getDay() + 6) % 7;
  const h = hoje();
  const titulo = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return (
    <>
      <NavPeriodo
        rotulo={titulo.charAt(0).toUpperCase() + titulo.slice(1)}
        onAnterior={() => setRef(new Date(ini.getFullYear(), ini.getMonth() - 1, 1))}
        onProximo={() => setRef(new Date(ini.getFullYear(), ini.getMonth() + 1, 1))}
        onHoje={() => setRef(hoje())}
      />
      <div className="ds-mes">
        <div className="ds-mes-h">{SEMANA.map((s) => <span key={s}>{s}</span>)}</div>
        <div className="ds-mes-g">
          {Array.from({ length: vazias }, (_, k) => <div key={`f${k}`} className="ds-mes-c ds-fora" />)}
          {Array.from({ length: dias }, (_, k) => {
            const d = new Date(ini.getFullYear(), ini.getMonth(), k + 1);
            const l = itens.filter((i) => mesmoDia(i.dia, d)).sort(ordenar);
            return (
              <button key={k} type="button" className={`ds-mes-c${mesmoDia(d, h) ? " ds-hoje" : ""}${d < h ? " ds-passado" : ""}`} onClick={() => onDia(d)} aria-label={`${rotuloDia(d)}: ${l.length} ${l.length === 1 ? "item" : "itens"}`}>
                <b>{k + 1}</b>
                {l.slice(0, 2).map((i) => <span key={i.id} className={i.atrasado ? "ds-late" : i.feito ? "ds-feito" : i.tipo === "auto" ? "ds-auto" : undefined}>{i.titulo}</span>)}
                {l.length > 2 && <small>+{l.length - 2}</small>}
                {l.length > 0 && <em className="ds-mes-pts" aria-hidden>{l.slice(0, 4).map((i) => <i key={i.id} className={i.atrasado ? "ds-late" : undefined} />)}</em>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
