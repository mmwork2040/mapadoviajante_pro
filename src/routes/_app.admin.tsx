import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Check, UserPlus, X, Webhook } from "lucide-react";
import { toast } from "sonner";
import {
  WEBHOOK_EVENTS,
  getWebhookConfig,
  saveWebhookConfig,
  type WebhookConfig,
} from "@/lib/webhook";
import {
  createTask,
  fetchTasks,
  fetchTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  updateTask,
} from "@/lib/services";
import { formatDate, initials } from "@/lib/ui";
import { useAuth } from "@/lib/auth";
import { QueryError } from "@/components/QueryError";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_app/admin")({
  component: AdminPage,
});

const ROLES = ["admin", "agent", "viewer"];
const PRIORITIES = ["low", "normal", "high"];

function AdminPage() {
  const qc = useQueryClient();
  const { member } = useAuth();
  const isAdmin = member?.role === "admin";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [task, setTask] = useState<Partial<Task>>({ priority: "normal" });

  const teamQ = useQuery({ queryKey: ["team"], queryFn: fetchTeamMembers });
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks({}) });
  const team = teamQ.data ?? [];
  const tasks = tasksQ.data ?? [];

  const addTask = useMutation({
    mutationFn: () => createTask(task),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar tarefa.");
      setTask({ priority: "normal" });
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

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateMemberRole(id, role),
    onSuccess: (ok) => {
      if (!ok) return toast.error("Erro ao alterar cargo.");
      toast.success("Cargo atualizado.");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: () => toast.error("Erro ao alterar cargo."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração</h1>
        <p className="text-sm text-muted-foreground">Equipe e tarefas da agência.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Equipe</h2>
            {isAdmin && (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <UserPlus className="h-4 w-4" /> Convidar
              </button>
            )}
          </div>
          {teamQ.isError ? (
            <QueryError message="Não foi possível carregar a equipe." onRetry={() => teamQ.refetch()} />
          ) : (
            <ul className="space-y-3">
              {team.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: m.avatar_color || "#ff7a1a" }}
                  >
                    {initials(m.name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {isAdmin ? (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs capitalize outline-none focus:border-primary"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Tarefas</h2>
          <div className="mb-4 space-y-2">
            <input
              value={task.title || ""}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              placeholder="Nova tarefa…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <select
                value={task.priority || "normal"}
                onChange={(e) => setTask({ ...task, priority: e.target.value })}
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm capitalize outline-none focus:border-primary"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={task.assigned_to || ""}
                onChange={(e) => setTask({ ...task, assigned_to: e.target.value || null })}
                className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Sem responsável</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={task.due_date || ""}
                onChange={(e) => setTask({ ...task, due_date: e.target.value || null })}
                className="rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => task.title?.trim() && addTask.mutate()}
                className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {tasksQ.isError ? (
            <QueryError message="Não foi possível carregar as tarefas." onRetry={() => tasksQ.refetch()} />
          ) : (
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
                    {t.priority && t.priority !== "normal" && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs capitalize">{t.priority}</span>
                    )}
                  </span>
                  {t.due_date && <span className="text-xs text-muted-foreground">{formatDate(t.due_date)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isAdmin && <WebhookCard />}

      <p className="text-xs text-muted-foreground">
        Logado como <strong>{member?.name}</strong> ({member?.role}).
      </p>


      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false);
            qc.invalidateQueries({ queryKey: ["team"] });
          }}
        />
      )}
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "agent" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await inviteTeamMember(form);
    setSaving(false);
    if (res) {
      toast.success("Membro adicionado à equipe!");
      onInvited();
    } else toast.error("Erro ao convidar membro.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Convidar Membro</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">E-mail</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Cargo</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-primary"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function WebhookCard() {
  const [config, setConfig] = useState<WebhookConfig>(() => getWebhookConfig());
  const [saved, setSaved] = useState(false);
  const disabled = !config.enabled;

  useEffect(() => {
    setConfig(getWebhookConfig());
  }, []);

  function update(patch: Partial<WebhookConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
    setSaved(false);
  }

  function toggleEvent(id: WebhookConfig["events"][number]) {
    update({
      events: config.events.includes(id)
        ? config.events.filter((e) => e !== id)
        : [...config.events, id],
    });
  }

  function save() {
    saveWebhookConfig(config);
    setSaved(true);
    toast.success("Configuração de webhook salva.");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Webhook</h2>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {config.enabled ? "Habilitado" : "Desabilitado"}
          </span>
          <button
            type="button"
            onClick={() => update({ enabled: !config.enabled })}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              config.enabled ? "bg-primary" : "bg-muted"
            }`}
            aria-pressed={config.enabled}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                config.enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Quando desabilitado, nenhum evento é disparado e as opções abaixo ficam inativas.
      </p>

      <div className={`space-y-4 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">URL do webhook</span>
          <input
            value={config.url}
            disabled={disabled}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://exemplo.com/webhook"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Segredo (opcional)</span>
          <input
            value={config.secret}
            disabled={disabled}
            onChange={(e) => update({ secret: e.target.value })}
            placeholder="Enviado no header X-Webhook-Secret"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed"
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium">Eventos disparados</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={config.events.includes(ev.id)}
                  onChange={() => toggleEvent(ev.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{ev.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        {saved ? "Salvo ✓" : "Salvar configuração"}
      </button>
    </div>
  );
}

