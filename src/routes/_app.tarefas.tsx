import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ListChecks, Check, CalendarClock } from "lucide-react";
import { fetchTasks, updateTask, cleanTaskDescription } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_app/tarefas")({
  component: TarefasPage,
});

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  low: { label: "Baixa", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  normal: { label: "Média", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  high: { label: "Alta", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function formatDue(iso?: string | null) {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const todayStr = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

function TarefasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
  });

  const toggle = useMutation({
    mutationFn: (t: Task) => updateTask(t.id, { completed: !t.completed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Erro ao atualizar tarefa."),
  });

  const byDue = (a: Task, b: Task) => {
    const ta = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const tb = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return ta - tb;
  };

  const inDateRange = (t: Task) => {
    if (!fromDate && !toDate) return true;
    if (!t.due_date) return false;
    const due = new Date(t.due_date).getTime();
    if (fromDate && due < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && due > new Date(`${toDate}T23:59:59`).getTime()) return false;
    return true;
  };

  const allTasks = (data ?? []).filter(inDateRange);
  const hasFilters = statusFilter !== "all" || fromDate !== todayStr() || toDate !== todayStr();
  const clearFilters = () => {
    setStatusFilter("all");
    setFromDate(todayStr());
    setToDate(todayStr());
  };

  const pending = allTasks.filter((t) => !t.completed).sort(byDue);
  const done = allTasks.filter((t) => t.completed).sort(byDue);
  const showPending = statusFilter !== "done";
  const showDone = statusFilter !== "pending";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ListChecks className="h-6 w-6 text-primary" />
            Tarefas
          </h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} pendente{pending.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Criar Tarefa
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Status</label>
          <div className="flex rounded-full bg-muted p-1 text-xs font-medium">
            {([
              { key: "all", label: "Todas" },
              { key: "pending", label: "Pendentes" },
              { key: "done", label: "Concluídas" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1 transition ${
                  statusFilter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">De</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Até</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar
          </Button>
        )}
      </div>

      {isError ? (
        <QueryError message="Não foi possível carregar as tarefas." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : allTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">Nenhuma tarefa encontrada</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros ou crie uma nova tarefa.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {showPending && pending.length > 0 && (
            <TaskList tasks={pending} onToggle={(t) => toggle.mutate(t)} />
          )}
          {showDone && done.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                Concluídas ({done.length})
              </h2>
              <TaskList tasks={done} onToggle={(t) => toggle.mutate(t)} />
            </div>
          )}
        </div>
      )}

      <CreateTaskModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function TaskList({ tasks, onToggle }: { tasks: Task[]; onToggle: (t: Task) => void }) {
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const prio = PRIORITY_META[t.priority] ?? PRIORITY_META.normal;
        return (
          <li
            key={t.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
          >
            <button
              onClick={() => onToggle(t)}
              aria-label={t.completed ? "Reabrir tarefa" : "Concluir tarefa"}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                t.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary"
              }`}
            >
              {t.completed && <Check className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${t.completed ? "text-muted-foreground line-through" : ""}`}>
                {t.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDue(t.due_date)}
                </span>
                {t.lead?.name && <span>👤 {t.lead.name}</span>}
                {t.assigned?.name && <span>• {t.assigned.name}</span>}
              </div>
              {cleanTaskDescription(t.description) && (
                <p className="mt-1 text-xs text-muted-foreground">{cleanTaskDescription(t.description)}</p>

              )}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${prio.cls}`}>
              {prio.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
