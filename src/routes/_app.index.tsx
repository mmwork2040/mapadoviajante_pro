import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CircleDollarSign,
  Users,
  TrendingUp,
  PieChart,
  Plus,
  ArrowRight,
  CalendarDays,
  BarChart3,
  ListChecks,
  CalendarClock,

} from "lucide-react";
import { fetchDashboardStats, createTask, cleanTaskDescription } from "@/lib/services";
import { formatCurrency } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  negotiating: "Negociando",
  closed: "Fechado",
  lost: "Perdido",
};

const WEEK_DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function timeAgo(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
  });

  const [chartMode, setChartMode] = useState<"revenue" | "count">("revenue");
  const [agendaMode, setAgendaMode] = useState<"week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [taskTitle, setTaskTitle] = useState("");

  const week = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const monthGrid = useMemo(() => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);

  const createTaskMutation = useMutation({
    mutationFn: (vars: { title: string; due: string }) =>
      createTask({ title: vars.title, due_date: vars.due }),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar agendamento.");
      toast.success("Agendamento criado!");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedDay(null);
      setTaskTitle("");
    },
    onError: () => toast.error("Erro ao criar agendamento."),
  });

  function submitTask() {
    if (!selectedDay) return;
    if (!taskTitle.trim()) return toast.error("Informe o título.");
    const due = new Date(selectedDay);
    due.setHours(9, 0, 0, 0);
    createTaskMutation.mutate({ title: taskTitle.trim(), due: due.toISOString() });
  }


  if (isError) {
    return <QueryError message="Não foi possível carregar o painel." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Carregando painel…</p>;
  }

  const monthRevenue = data.chartData.revenue[data.chartData.revenue.length - 1] ?? 0;
  const conversion = data.totalLeads > 0 ? Math.round((data.closed / data.totalLeads) * 100) : 0;
  const activeLeads = data.totalLeads - data.closed - data.lost;

  const cards = [
    {
      label: "Vendas do Mês",
      value: formatCurrency(monthRevenue),
      hint: "no mês atual",
      icon: CircleDollarSign,
      ring: "bg-amber-100 text-amber-600",
    },
    {
      label: "Leads Ativos",
      value: String(activeLeads),
      hint: `${data.newLeads} novos`,
      icon: Users,
      ring: "bg-blue-100 text-blue-600",
    },
    {
      label: "Pipeline",
      value: formatCurrency(data.totalPipeline),
      hint: `${data.negotiating} em negociação`,
      icon: TrendingUp,
      ring: "bg-pink-100 text-pink-600",
    },
    {
      label: "Taxa de Conversão",
      value: `${conversion}%`,
      hint: `${data.closed} fechados`,
      icon: PieChart,
      ring: "bg-emerald-100 text-emerald-600",
    },
  ];

  const series = chartMode === "revenue" ? data.chartData.revenue : data.chartData.count;
  const maxVal = Math.max(1, ...series);
  const todayKey = new Date().toDateString();




  const todayTasks = data.tasks
    .filter(
      (t) => t.due_date && new Date(t.due_date).toDateString() === todayKey && !t.completed,
    )
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

  const recentLeads = [...data.leads]
    .sort(
      (a, b) =>
        new Date(b.last_activity_at || b.created_at || 0).getTime() -
        new Date(a.last_activity_at || a.created_at || 0).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Painel</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas vendas e operações.</p>
        </div>
        <Link
          to="/roteiros"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo Roteiro
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11 ${c.ring}`}>
                <c.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground sm:text-sm">{c.label}</p>
                <p className="mt-1 truncate text-lg font-bold leading-tight sm:text-2xl">{c.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{c.hint}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tarefas de Hoje */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:text-base">
            <ListChecks className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Tarefas de Hoje</span>
          </h2>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {todayTasks.length}
          </span>
        </div>
        {todayTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma tarefa para hoje.
          </p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((t) => {
              const desc = cleanTaskDescription(t.description);
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl border border-border p-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CalendarClock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    {t.lead?.name && (
                      <p className="truncate text-xs text-muted-foreground">👤 {t.lead.name}</p>
                    )}
                    {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {new Date(t.due_date!).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>




      {/* Chart */}
      <div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex w-full min-w-0 items-center gap-2 text-sm font-semibold sm:w-auto sm:text-base">
              <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">Vendas — Últimos 6 Meses</span>
            </h2>
            <div className="flex max-w-full shrink-0 rounded-full bg-muted p-1 text-xs font-medium">
              <button
                onClick={() => setChartMode("revenue")}
                className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                  chartMode === "revenue" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Receita
              </button>
              <button
                onClick={() => setChartMode("count")}
                className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                  chartMode === "count" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Nº Vendas
              </button>
            </div>
          </div>

          {series.every((v) => !v) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma venda registrada nos últimos 6 meses</p>
          ) : (
          <div className="flex h-56 items-end gap-3">
            {data.chartData.labels.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary"
                    style={{ height: `${Math.max(2, (series[i] / maxVal) * 100)}%` }}
                    title={chartMode === "revenue" ? formatCurrency(series[i]) : String(series[i])}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>


      {/* Agenda da Semana */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex w-full min-w-0 items-center gap-2 text-sm font-semibold sm:w-auto sm:text-base">
            <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">
              {agendaMode === "week" ? "Agenda da Semana" : "Agenda do Mês"}
            </span>
          </h2>
          <div className="flex max-w-full shrink-0 rounded-full bg-muted p-1 text-xs font-medium">
            <button
              onClick={() => setAgendaMode("week")}
              className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                agendaMode === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setAgendaMode("month")}
              className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                agendaMode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Mês
            </button>
          </div>
        </div>

        {agendaMode === "week" ? (
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
            {week.map((d, i) => {
              const isToday = d.toDateString() === todayKey;
              const count = data.tasks.filter(
                (t) => t.due_date && new Date(t.due_date).toDateString() === d.toDateString() && !t.completed,
              ).length;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`flex min-h-[96px] min-w-0 flex-col items-center border-r border-border p-1 text-center transition last:border-r-0 hover:bg-accent sm:min-h-[120px] sm:p-2 ${
                    isToday ? "bg-primary/5" : ""
                  }`}
                >
                  <p className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">{WEEK_DAYS[d.getDay()]}</p>
                  <span
                    className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm ${
                      isToday ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
                    {count > 0 ? count : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">

            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {WEEK_DAYS.map((wd) => (
                <div key={wd} className="py-2 text-center text-[11px] font-medium text-muted-foreground">
                  {wd}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid.map((d, i) => {
                const isToday = d.toDateString() === todayKey;
                const inMonth = d.getMonth() === new Date().getMonth();
                const count = data.tasks.filter(
                  (t) => t.due_date && new Date(t.due_date).toDateString() === d.toDateString() && !t.completed,
                ).length;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`flex min-h-[56px] min-w-0 flex-col border-b border-r border-border p-1 text-left transition hover:bg-accent sm:min-h-[84px] sm:p-1.5 ${
                      isToday ? "bg-primary/5" : ""
                    } ${inMonth ? "" : "opacity-40"}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {count > 0 && (
                      <span className="mt-0.5 block truncate text-[10px] text-primary">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {MONTH_NAMES[(agendaMode === "week" ? week[0] : new Date()).getMonth()]}{" "}
            {(agendaMode === "week" ? week[0] : new Date()).getFullYear()}
          </span>
          <span>{data.pendingTasks} compromissos pendentes</span>
        </div>
      </div>

      {/* Modal de agendamento */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Agenda do dia
              {selectedDay && (
                <span className="ml-1 font-normal text-muted-foreground">
                  — {selectedDay.getDate()}/{selectedDay.getMonth() + 1}/{selectedDay.getFullYear()}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (() => {
            const dayTasks = data.tasks.filter(
              (t) => t.due_date && new Date(t.due_date).toDateString() === selectedDay.toDateString(),
            );
            return (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Compromissos do dia ({dayTasks.length})
                </p>
                {dayTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                    Nenhum compromisso neste dia.
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto scrollbar-thin">
                    {dayTasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start gap-2 rounded-lg border border-border p-2"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <CalendarClock className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-medium ${t.completed ? "text-muted-foreground line-through" : ""}`}>
                            {t.title}
                          </p>
                          {t.lead?.name && (
                            <p className="truncate text-xs text-muted-foreground">👤 {t.lead.name}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
          <div className="space-y-2">
            <Label htmlFor="task-title">Novo compromisso</Label>
            <Input
              id="task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Ex.: Ligar para o cliente"
              onKeyDown={(e) => e.key === "Enter" && submitTask()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDay(null)}>
              Cancelar
            </Button>
            <Button onClick={submitTask} disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? "Salvando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Leads Recentes */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold sm:text-base">
            <Users className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Leads Recentes</span>
          </h2>
          <Link to="/leads" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {/* Mobile: cards */}
        <div className="space-y-3 md:hidden">
          {recentLeads.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">Nenhum lead encontrado</p>
          )}
          {recentLeads.map((l) => (
            <div key={l.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate font-medium">{l.name}</p>
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  {STATUS_LABEL[l.status] || l.status}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{l.destination || "—"}</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">{formatCurrency(l.value)}</span>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(l.last_activity_at || l.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Destino</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Última Atividade</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum lead encontrado
                  </td>
                </tr>
              )}
              {recentLeads.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-2 font-medium">{l.name}</td>
                  <td className="py-2 text-muted-foreground">{l.destination || "—"}</td>
                  <td className="py-2">{formatCurrency(l.value)}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {STATUS_LABEL[l.status] || l.status}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{timeAgo(l.last_activity_at || l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
