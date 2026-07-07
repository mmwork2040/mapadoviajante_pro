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

function TarefasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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

  const tasks = data ?? [];
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

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

      {isError ? (
        <QueryError message="Não foi possível carregar as tarefas." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <ListChecks className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium">Nenhuma tarefa ainda</p>
          <p className="text-sm text-muted-foreground">Crie sua primeira tarefa para começar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <TaskList tasks={pending} onToggle={(t) => toggle.mutate(t)} />
          {done.length > 0 && (
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
