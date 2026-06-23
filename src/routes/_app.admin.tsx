import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, Check, UserPlus, X, Webhook, Sparkles, Loader2, ChevronDown, BookOpen, FileText, Trash2, MessageSquare, Database, FolderOpen, Users, PieChart, Save, UploadCloud, ListChecks, Bell, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import {
  WEBHOOK_EVENTS,
  dispatchWebhook,
  getWebhookConfig,
  saveWebhookConfig,
  sendTestWebhook,
  type WebhookConfig,
} from "@/lib/webhook";
import {
  getNotifConfig,
  saveNotifConfig,
  requestPushToken,
  configIsComplete,
  type NotifConfig,
} from "@/lib/notifications";
import { sendGmail, getGmailStatus } from "@/lib/gmail.functions";
import { getGmailConfig, saveGmailConfig, type GmailConfig } from "@/lib/gmail-config";
import { sendTestPush, getPushStatus } from "@/lib/push.functions";
import {
  createTask,
  fetchAiConfig,
  fetchTasks,
  fetchTeamMembers,
  inviteTeamMember,
  saveAiConfig,
  updateMemberRole,
  updateTask,
} from "@/lib/services";
import { testAiConnection, extractKnowledgeDoc } from "@/lib/ai.functions";
import { formatDate, initials } from "@/lib/ui";
import { useAuth } from "@/lib/auth";
import { QueryError } from "@/components/QueryError";
import type { AiConfig, Task } from "@/lib/types";

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
      dispatchWebhook("task.created", res);
      setTask({ priority: "normal" });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("Erro ao criar tarefa."),
  });

  const toggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      updateTask(id, { completed, completed_at: completed ? new Date().toISOString() : null }),
    onSuccess: (_res, vars) => {
      if (vars.completed) dispatchWebhook("task.completed", { id: vars.id });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
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

      <CollapsibleSection
        icon={Users}
        color="#3b82f6"
        title="Equipe"
        subtitle="Gerencie os membros e cargos da agência"
        defaultOpen
        action={
          isAdmin ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setInviteOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  setInviteOpen(true);
                }
              }}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Convidar
            </span>
          ) : undefined
        }
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        icon={ListChecks}
        color="#10b981"
        title="Tarefas"
        subtitle="Organize e acompanhe as tarefas da equipe"
        defaultOpen
      >
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
      </CollapsibleSection>

      {isAdmin && (
        <CollapsibleSection
          icon={Webhook}
          color="#f97316"
          title="Webhook"
          subtitle="Integre eventos da agência com sistemas externos"
        >
          <WebhookCard />
        </CollapsibleSection>
      )}

      {isAdmin && (
        <CollapsibleSection
          icon={Sparkles}
          color="#7c5cff"
          title="Inteligência Artificial"
          subtitle="Configure e instrua a IA com base de conhecimento"
        >
          <AiConfigCard />
        </CollapsibleSection>
      )}

      {isAdmin && (
        <CollapsibleSection
          icon={Bell}
          color="#0ea5e9"
          title="Notificações"
          subtitle="Configure notificações push via Firebase (FCM)"
        >
          <NotificationsCard />
        </CollapsibleSection>
      )}

      {isAdmin && (
        <CollapsibleSection
          icon={Mail}
          color="#ea4335"
          title="E-mail (Gmail)"
          subtitle="Envie e-mails pela conta Gmail conectada à agência"
        >
          <GmailCard />
        </CollapsibleSection>
      )}


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
      dispatchWebhook("member.invited", res);
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

function CollapsibleSection({
  icon: Icon,
  title,
  subtitle,
  color = "#f97316",
  defaultOpen = false,
  action,
  children,
}: {
  icon: typeof Webhook;
  title: string;
  subtitle?: string;
  color?: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5"
        aria-expanded={open}
      >
        <span className="flex items-start gap-3 text-left">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold leading-tight">{title}</span>
            {subtitle && <span className="block text-sm text-muted-foreground">{subtitle}</span>}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {action}
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}



function WebhookCard() {
  const [config, setConfig] = useState<WebhookConfig>(() => getWebhookConfig());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const disabled = !config.enabled;
  const canTest = config.enabled && !!config.url.trim() && config.events.length > 0;

  async function runTest() {
    setTesting(true);
    const res = await sendTestWebhook(config);
    setTesting(false);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  }


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
    <div>
      <label className="mb-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => update({ enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            config.enabled ? "bg-primary" : "bg-muted"
          }`}
          aria-pressed={config.enabled}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
              config.enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-muted-foreground">
          {config.enabled ? "Habilitado" : "Desabilitado"}
        </span>
      </label>




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
                  className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                />
                <span className="min-w-0">{ev.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={disabled || !config.url.trim() || config.events.length === 0}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saved ? "Salvo ✓" : "Salvar configuração"}
        </button>
        <button
          type="button"
          onClick={runTest}
          disabled={!canTest || testing}
          className="rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? "Enviando…" : "Testar webhook"}
        </button>
      </div>

    </div>
  );
}

function NotificationsCard() {
  const [config, setConfig] = useState<NotifConfig>(() => getNotifConfig());
  const [token, setToken] = useState<string>("");
  const [activating, setActivating] = useState(false);
  const [testing, setTesting] = useState(false);
  const sendPush = useServerFn(sendTestPush);
  const statusQ = useQuery({ queryKey: ["push-status"], queryFn: () => getPushStatus() });

  useEffect(() => {
    setConfig(getNotifConfig());
  }, []);

  function update(patch: Partial<NotifConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  function save() {
    saveNotifConfig(config);
    toast.success("Configuração de notificações salva.");
  }

  async function activate() {
    setActivating(true);
    const res = await requestPushToken(config);
    setActivating(false);
    if (res.ok && res.token) {
      setToken(res.token);
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  }

  async function runTest() {
    if (!token) {
      toast.error("Ative as notificações neste dispositivo primeiro.");
      return;
    }
    setTesting(true);
    const res = await sendPush({
      data: { token, title: "Teste de notificação", body: "As notificações estão funcionando! 🎉" },
    });
    setTesting(false);
    res.ok ? toast.success(res.message) : toast.error(res.message);
  }

  const fields: { key: keyof NotifConfig; label: string; placeholder: string }[] = [
    { key: "apiKey", label: "API Key", placeholder: "AIza..." },
    { key: "authDomain", label: "Auth Domain", placeholder: "seu-app.firebaseapp.com" },
    { key: "projectId", label: "Project ID", placeholder: "seu-app" },
    { key: "messagingSenderId", label: "Messaging Sender ID", placeholder: "1234567890" },
    { key: "appId", label: "App ID", placeholder: "1:1234567890:web:abc123" },
    { key: "vapidKey", label: "VAPID Key (Web Push)", placeholder: "B*****" },
  ];

  const serverReady = statusQ.data?.configured;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cole a configuração web do seu projeto Firebase para habilitar notificações push neste navegador/dispositivo.
      </p>

      <label className="flex items-center gap-3 text-sm font-medium">
        <button
          type="button"
          onClick={() => update({ enabled: !config.enabled })}
          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${config.enabled ? "bg-primary" : "bg-muted"}`}
          aria-pressed={config.enabled}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white transition-transform ${config.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
          />
        </button>
        {config.enabled ? "Habilitado" : "Desabilitado"}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</span>
            <input
              value={(config[f.key] as string) || ""}
              onChange={(e) => update({ [f.key]: e.target.value } as Partial<NotifConfig>)}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      {!serverReady && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Para o envio funcionar, falta configurar a <strong>service account</strong> do Firebase no servidor.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Save className="h-4 w-4" /> Salvar
        </button>
        <button
          type="button"
          onClick={activate}
          disabled={activating || !config.enabled || !configIsComplete(config)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {activating ? "Ativando…" : "Ativar neste dispositivo"}
        </button>
        <button
          type="button"
          onClick={runTest}
          disabled={testing || !token || !serverReady}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {testing ? "Enviando…" : "Enviar teste"}
        </button>
      </div>
    </div>
  );
}

function GmailCard() {
  const [config, setConfig] = useState<GmailConfig>(() => getGmailConfig());
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(sendGmail);
  const statusQ = useQuery({ queryKey: ["gmail-status"], queryFn: () => getGmailStatus() });
  const connected = statusQ.data?.connected;

  useEffect(() => {
    const c = getGmailConfig();
    setConfig(c);
    setSubject((s) => s || c.defaultSubject);
  }, []);

  function update(patch: Partial<GmailConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  function save() {
    saveGmailConfig(config);
    toast.success("Configuração de e-mail salva.");
  }

  async function submit() {
    if (!config.enabled) {
      toast.error("Habilite o envio de e-mail primeiro.");
      return;
    }
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Preencha destinatário, assunto e mensagem.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      toast.error("Informe um e-mail de destinatário válido.");
      return;
    }
    const finalBody = config.signature ? `${body}\n\n${config.signature}` : body;
    setSending(true);
    const res = await send({ data: { to: to.trim(), subject: subject.trim(), body: finalBody } });
    setSending(false);
    if (res.ok) {
      toast.success(res.message);
      setSubject(config.defaultSubject);
      setBody("");
    } else {
      toast.error(res.message);
    }
  }

  const fields: { key: keyof GmailConfig; label: string; placeholder: string }[] = [
    { key: "senderName", label: "Nome do remetente", placeholder: "Sua Agência" },
    { key: "replyTo", label: "Responder para", placeholder: "contato@suaagencia.com" },
    { key: "defaultSubject", label: "Assunto padrão", placeholder: "Sobre sua viagem" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground"}`}
        />
        <span className="text-muted-foreground">
          {connected ? "Conta Gmail conectada." : "Gmail não conectado."}
        </span>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium">
        <button
          type="button"
          onClick={() => update({ enabled: !config.enabled })}
          className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${config.enabled ? "bg-primary" : "bg-muted"}`}
          aria-pressed={config.enabled}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white transition-transform ${config.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
          />
        </button>
        {config.enabled ? "Habilitado" : "Desabilitado"}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}</span>
            <input
              value={(config[f.key] as string) || ""}
              onChange={(e) => update({ [f.key]: e.target.value } as Partial<GmailConfig>)}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Assinatura</span>
          <textarea
            value={config.signature}
            onChange={(e) => update({ signature: e.target.value })}
            rows={2}
            placeholder="Atenciosamente, Equipe…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        <Save className="h-4 w-4" /> Salvar
      </button>

      <div className="border-t border-border pt-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Enviar e-mail de teste</p>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Destinatário</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="cliente@email.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Assunto</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Assunto do e-mail"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Mensagem</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Escreva a mensagem (HTML permitido)…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={sending || !connected || !config.enabled}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Enviando…" : "Enviar e-mail"}
          </button>
        </div>
      </div>
    </div>
  );
}


const AI_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1", "o1-mini"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    placeholder: "claude-3-5-sonnet-20241022",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
  },
  {
    id: "google",
    label: "Google Gemini",
    placeholder: "gemini-1.5-flash",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.0-pro"],
  },
];

function AiConfigCard() {
  const qc = useQueryClient();
  const test = useServerFn(testAiConnection);
  const extractDoc = useServerFn(extractKnowledgeDoc);
  const { data: config } = useQuery({ queryKey: ["ai-config"], queryFn: fetchAiConfig });

  const [form, setForm] = useState<AiConfig>({
    provider: "openai",
    model: "",
    api_key_encrypted: "",
    system_prompt: "",
    max_tokens: 1024,
    knowledge_sources: { status: "disconnected", data_sources: {}, documents: [] },
  });
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        provider: config.provider || "openai",
        model: config.model || "",
        api_key_encrypted: config.api_key_encrypted || "",
        system_prompt: config.system_prompt || "",
        max_tokens: config.max_tokens || 1024,
        knowledge_sources: {
          status: config.knowledge_sources?.status || "disconnected",
          last_tested_at: config.knowledge_sources?.last_tested_at,
          data_sources: config.knowledge_sources?.data_sources || {},
          documents: config.knowledge_sources?.documents || [],
        },
      });
    }
  }, [config]);

  const ks = form.knowledge_sources ?? {};
  const status = ks.status === "connected" ? "connected" : "disconnected";
  const documents = ks.documents ?? [];
  const dataSources = ks.data_sources ?? {};

  // Alterações de credencial invalidam a conexão, mas preservam base de conhecimento.
  function update(patch: Partial<AiConfig>) {
    setForm((c) => ({
      ...c,
      ...patch,
      knowledge_sources: { ...(c.knowledge_sources ?? {}), status: "disconnected" },
    }));
  }

  const saveMut = useMutation({
    mutationFn: (cfg: Partial<AiConfig>) => saveAiConfig(cfg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-config"] }),
  });

  // Persiste apenas as partes da base de conhecimento sem mexer no status.
  async function persistKnowledge(nextKs: NonNullable<AiConfig["knowledge_sources"]>) {
    const merged = { ...form, knowledge_sources: nextKs };
    setForm(merged);
    await saveMut.mutateAsync(merged);
  }

  function toggleSource(key: "library" | "leads" | "finance") {
    const next = {
      ...ks,
      data_sources: { ...dataSources, [key]: !dataSources[key] },
    };
    void persistKnowledge(next).catch(() =>
      toast.error("Não foi possível salvar as fontes de conhecimento."),
    );
  }

  async function saveOrientacoes() {
    try {
      await saveMut.mutateAsync(form);
      toast.success("Orientações salvas.");
    } catch {
      toast.error("Não foi possível salvar as orientações.");
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    if (!form.model.trim() || !(form.api_key_encrypted || "").trim()) {
      toast.error("Configure e conecte a IA antes de subir documentos.");
      return;
    }
    setUploading(true);
    try {
      const added: NonNullable<AiConfig["knowledge_sources"]>["documents"] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} excede 10MB.`);
          continue;
        }
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1] || "");
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const res = await extractDoc({
          data: {
            provider: form.provider,
            model: form.model,
            apiKey: form.api_key_encrypted || "",
            fileBase64: base64,
            mime: file.type || "application/octet-stream",
          },
        });
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          text: res.text,
        });
      }
      if (added.length) {
        await persistKnowledge({ ...ks, documents: [...documents, ...added] });
        toast.success(`${added.length} documento(s) adicionado(s) à base.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar documento.");
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(id: string) {
    try {
      await persistKnowledge({ ...ks, documents: documents.filter((d) => d.id !== id) });
    } catch {
      toast.error("Não foi possível remover o documento.");
    }
  }

  async function runTest() {
    if (!form.model.trim() || !(form.api_key_encrypted || "").trim()) {
      toast.error("Informe o modelo e a credencial.");
      return;
    }
    setTesting(true);
    try {
      const res = await test({
        data: { provider: form.provider, model: form.model, apiKey: form.api_key_encrypted || "" },
      });
      if (res.ok) {
        const nextKs = { ...ks, status: "connected", last_tested_at: new Date().toISOString() };
        await saveMut.mutateAsync({ ...form, knowledge_sources: nextKs });
        setForm((c) => ({ ...c, knowledge_sources: nextKs }));
        toast.success("IA conectada e configuração salva!");
      } else {
        await saveMut.mutateAsync({ ...form, knowledge_sources: { ...ks, status: "disconnected" } });
        toast.error(`Falha na conexão: ${res.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao testar conexão.");
    } finally {
      setTesting(false);
    }
  }

  const provider = AI_PROVIDERS.find((p) => p.id === form.provider);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === "connected"
              ? "bg-[var(--success)]/15 text-[var(--success)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {status === "connected" ? "Conectada" : "Não conectada"}
        </span>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Configure uma LLM com suas credenciais. A leitura de documentos só funciona após testar e conectar.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Provedor</span>
          <select
            value={form.provider}
            onChange={(e) => update({ provider: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Modelo</span>
          <select
            value={provider?.models.includes(form.model) ? form.model : "__custom"}
            onChange={(e) => update({ model: e.target.value === "__custom" ? "" : e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="" disabled>Selecione um modelo</option>
            {provider?.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="__custom">Outro (personalizado)…</option>
          </select>
          {!provider?.models.includes(form.model) && (
            <input
              value={form.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder={provider?.placeholder}
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Credencial (API key)</span>
          <input
            type="password"
            value={form.api_key_encrypted || ""}
            onChange={(e) => update({ api_key_encrypted: e.target.value })}
            placeholder="sk-..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={runTest}
        disabled={testing}
        className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {testing ? "Testando…" : "Testar e conectar"}
      </button>

      {/* ── Base de conhecimento ─────────────────────────────── */}
      <div className="mt-8 space-y-8 border-t border-border pt-6">
        {/* Orientações */}
        <div>
          <SectionHeader
            icon={<MessageSquare className="h-5 w-5" />}
            color="#7c5cff"
            title="Orientações para a Thay"
            subtitle="Defina a personalidade, tom de voz e regras de negócio que a IA deve seguir"
          />
          <textarea
            value={form.system_prompt || ""}
            onChange={(e) => update({ system_prompt: e.target.value.slice(0, 2000) })}
            rows={6}
            placeholder="Ex: Você é a Thay, assistente de viagens da agência O Segredo do Viajante. Sempre sugira destinos do Caribe e Europa. Use tom amigável e profissional. Mencione os diferenciais da agência: atendimento personalizado, guias exclusivos e suporte 24h durante a viagem…"
            className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {(form.system_prompt || "").length} / 2.000 caracteres
            </span>
            <button
              type="button"
              onClick={saveOrientacoes}
              disabled={saveMut.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Salvar orientações
            </button>
          </div>
        </div>

        {/* Fontes de Conhecimento */}
        <div>
          <SectionHeader
            icon={<Database className="h-5 w-5" />}
            color="#10b981"
            title="Fontes de Conhecimento"
            subtitle="Escolha quais dados a Thay pode consultar para gerar sugestões"
          />
          <div className="space-y-3">
            <SourceToggle
              icon={<BookOpen className="h-5 w-5" />}
              color="#f97316"
              label="Biblioteca de Roteiros"
              desc="Permite à IA consultar os roteiros cadastrados."
              checked={!!dataSources.library}
              onToggle={() => toggleSource("library")}
            />
            <SourceToggle
              icon={<Users className="h-5 w-5" />}
              color="#3b82f6"
              label="Base de Leads"
              desc="Contexto do cliente para personalizar respostas."
              checked={!!dataSources.leads}
              onToggle={() => toggleSource("leads")}
            />
            <SourceToggle
              icon={<PieChart className="h-5 w-5" />}
              color="#10b981"
              label="Dados Financeiros"
              desc="Comissões, receitas e custos."
              checked={!!dataSources.finance}
              onToggle={() => toggleSource("finance")}
            />
          </div>
        </div>

        {/* Materiais de Referência */}
        <div>
          <SectionHeader
            icon={<FolderOpen className="h-5 w-5" />}
            color="#3b82f6"
            title="Materiais de Referência"
            subtitle="Suba PDFs, guias, tabelas de preços e documentos para a Thay consultar"
          />
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-input bg-muted/30 px-4 py-12 text-center hover:border-primary ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="mb-3 h-8 w-8 text-primary" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {uploading ? (
                "Processando documento…"
              ) : (
                <>
                  Arraste arquivos aqui{" "}
                  <span className="font-normal text-muted-foreground">ou clique para selecionar</span>
                </>
              )}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">PDF, DOC, TXT, XLSX, CSV — máx. 10 MB cada</span>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {documents.length > 0 && (
            <ul className="mt-3 space-y-2">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => removeDoc(d.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover documento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  color,
  title,
  subtitle,
}: {
  icon: ReactNode;
  color: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {icon}
      </span>
      <div>
        <h3 className="font-bold leading-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function SourceToggle({
  icon,
  color,
  label,
  desc,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  desc: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-4 text-left transition-colors ${
        checked ? "border-primary/40" : "border-border"
      } hover:border-primary`}
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className={`block text-sm font-bold ${checked ? "" : "text-muted-foreground"}`}>{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}


