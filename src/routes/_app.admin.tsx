import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { createTask, fetchTasks, fetchTeamMembers, updateTask } from "@/lib/services";
import { formatDate, initials } from "@/lib/ui";
import { useAuth } from "@/lib/auth";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const { member } = useAuth();
  const [taskTitle, setTaskTitle] = useState("");

  const teamQ = useQuery({ queryKey: ["team"], queryFn: fetchTeamMembers });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks({}) });
  const team = teamQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const addTask = useMutation({
    mutationFn: () => createTask({ title: taskTitle, priority: "normal" }),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar tarefa.");
      setTaskTitle("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("Erro ao criar tarefa."),
  });

  const toggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      updateTask(id, { completed, completed_at: completed ? new Date().toISOString() : null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: () => toast.error("Erro ao atualizar tarefa."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração</h1>
        <p className="text-sm text-muted-foreground">Equipe e tarefas da agência.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Equipe</h2>
          <ul className="space-y-3">
            {team.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: m.avatar_color || "#ff7a1a" }}
                >
                  {initials(m.name)}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Tarefas</h2>
          <div className="mb-4 flex gap-2">
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Nova tarefa…"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => taskTitle.trim() && addTask.mutate()}
              className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {tasks.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma tarefa.</li>}
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <button
                  onClick={() => toggle.mutate({ id: t.id, completed: !t.completed })}
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    t.completed ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {t.completed && <Check className="h-3.5 w-3.5" />}
                </button>
                <span className={`flex-1 text-sm ${t.completed ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </span>
                {t.due_date && <span className="text-xs text-muted-foreground">{formatDate(t.due_date)}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Logado como <strong>{member?.name}</strong> ({member?.role}). Agência: {member?.agency_id}
      </p>
    </div>
  );
}
