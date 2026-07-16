import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ListChecks, Check, CalendarClock, MoreVertical, ExternalLink, Pencil, Trash2, RotateCcw, CheckCircle2 } from "lucide-react";
import { fetchTasks, updateTask, deleteTask, cleanTaskDescription, isOverdue } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/QueryError";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { PageHeader } from "@/components/PageHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ConfirmDialog";
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


function TarefasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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

  const removeTask = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: (ok) => {
      if (!ok) return toast.error("Erro ao excluir tarefa.");
      toast.success("Tarefa excluída.");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Erro ao excluir tarefa."),
  });

  async function handleDelete(t: Task) {
    const ok = await confirm({
      title: "Excluir tarefa?",
      description: `“${t.title}” será removida definitivamente.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok === true) removeTask.mutate(t.id);
  }


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
  const hasFilters = statusFilter !== "all" || fromDate !== "" || toDate !== "";
  const clearFilters = () => {
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  };

  const pending = allTasks.filter((t) => !t.completed).sort(byDue);
  const done = allTasks.filter((t) => t.completed).sort(byDue);
  const showPending = statusFilter !== "done";
  const showDone = statusFilter !== "pending";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Tarefas"
        subtitle={`${pending.length} pendente${pending.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Criar Tarefa
          </Button>
        }
      />

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
            <TaskList
              tasks={pending}
              onToggle={(t) => toggle.mutate(t)}
              onOpenTask={setDetailTask}
              onEditTask={setEditTask}
              onDeleteTask={handleDelete}
            />
          )}
          {showDone && done.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                Concluídas ({done.length})
              </h2>
              <TaskList
                tasks={done}
                onToggle={(t) => toggle.mutate(t)}
                onOpenTask={setDetailTask}
                onEditTask={setEditTask}
                onDeleteTask={handleDelete}
              />
            </div>
          )}
        </div>
      )}

      <CreateTaskModal open={open} onOpenChange={setOpen} />
      <CreateTaskModal
        open={!!editTask}
        onOpenChange={(v) => !v && setEditTask(null)}
        task={editTask}
      />
      {detailTask?.lead_id && (
        <LeadDetailDrawer
          leadId={detailTask.lead_id}
          highlightTask={detailTask}
          onClose={() => setDetailTask(null)}
        />
      )}

    </div>
  );
}


function TaskList({
  tasks,
  onToggle,
  onOpenTask,
  onEditTask,
  onDeleteTask,
}: {
  tasks: Task[];
  onToggle: (t: Task) => void;
  onOpenTask: (t: Task) => void;
  onEditTask: (t: Task) => void;
  onDeleteTask: (t: Task) => void;
}) {
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const prio = PRIORITY_META[t.priority] ?? PRIORITY_META.normal;
        const clickable = !!t.itinerary_id;
        return (
          <li
            key={t.id}
            onClick={() => clickable && onOpenTask(t)}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={(e) => {
              if (clickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onOpenTask(t);
              }
            }}

            className={`flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm ${
              clickable ? "cursor-pointer transition hover:border-primary hover:bg-muted/40" : ""
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(t); }}
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
                <span className={`inline-flex items-center gap-1 ${isOverdue(t.due_date, t.completed) ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDue(t.due_date)}
                </span>
                {isOverdue(t.due_date, t.completed) && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                    Atrasada
                  </span>
                )}
                {t.lead?.name && <span>👤 {t.lead.name}</span>}
                {t.assigned?.name && <span>• {t.assigned.name}</span>}
              </div>
              {cleanTaskDescription(t.description) && (
                <p className="mt-1 text-xs text-muted-foreground">{cleanTaskDescription(t.description)}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prio.cls}`}>
                {prio.label}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Ações da tarefa"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {clickable && (
                    <DropdownMenuItem onSelect={() => onOpenTask(t)}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Abrir
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => onEditTask(t)}>
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onToggle(t)}>
                    {t.completed ? (
                      <>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como concluída
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onDeleteTask(t)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

