import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  MapPin,
  MessageCircle,
  Map as MapIcon,
  Columns,
  User,
  Plane,
  ClipboardList,
  ListChecks,
  StickyNote,
  Phone,
  Mail,
  Users,
  Video,
  FileText,
  HandHelping,
  Send,
  Check,
  Clock,
  CreditCard,
  Info,
  ChevronDown,
  Trash2,

} from "lucide-react";
import { toast } from "sonner";
import {
  createItinerary,
  createLeadActivity,
  deleteLeadActivity,
  fetchLeadActivities,
  fetchLeadById,
  fetchTeamMembers,
  updateLead,
} from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, formatDate, initials, maskPhone } from "@/lib/ui";
import type { Lead, LeadStatus } from "@/lib/types";

const STATUSES: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Novo" },
  { key: "contacted", label: "Contatado" },
  { key: "negotiating", label: "Negociando" },
  { key: "closed", label: "Fechado" },
  { key: "lost", label: "Perdido" },
];

const TABS = [
  { key: "perfil", label: "Perfil", icon: User },
  { key: "viagem", label: "Viagem", icon: Plane },
  { key: "atividades", label: "Atividades", icon: ClipboardList },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "notas", label: "Notas", icon: StickyNote },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const ACTIVITY_TYPES = [
  { key: "call", label: "Ligação", icon: Phone },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "meeting", label: "Reunião", icon: Video },
  { key: "request", label: "Solicitação", icon: HandHelping },
  { key: "note", label: "Observação", icon: StickyNote },
  { key: "document", label: "Documento", icon: FileText },
];

function activityMeta(type?: string | null) {
  return ACTIVITY_TYPES.find((t) => t.key === type) ?? { label: "Atividade", icon: ClipboardList };
}

export function LeadDetailDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("perfil");

  const { data: lead } = useQuery({ queryKey: ["lead", leadId], queryFn: () => fetchLeadById(leadId) });
  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: () => fetchLeadActivities(leadId),
  });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeamMembers });

  const update = useMutation({
    mutationFn: (updates: Partial<Lead>) => updateLead(leadId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Erro ao atualizar lead."),
  });

  const createRoteiro = useMutation({
    mutationFn: () =>
      createItinerary({
        lead_id: leadId,
        title: `Roteiro - ${lead?.name}`,
        client_name: lead?.name,
        destination: lead?.destination || "",
        budget: Number(lead?.value) || 0,
        status: "draft",
      }),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar roteiro.");
      toast.success("Roteiro criado!");
      navigate({ to: "/roteiros/$id", params: { id: res.id } });
    },
    onError: () => toast.error("Erro ao criar roteiro."),
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const p = ((lead?.profile as Record<string, string>) || {});
  const phoneDigits = (lead?.phone || "").replace(/\D/g, "");

  function openWhatsApp() {
    if (!phoneDigits) return toast.error("Lead sem telefone cadastrado.");
    window.open(`https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : "55" + phoneDigits}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-card shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {!lead ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">Carregando…</div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-border p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                  {initials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold">{lead.name}</h2>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {lead.destination || "—"}
                  </p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(lead.value)}</p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="relative">
                  <select
                    value={lead.status}
                    onChange={(e) => update.mutate({ status: e.target.value as LeadStatus })}
                    className="appearance-none rounded-full border border-primary/40 bg-primary/10 py-1.5 pl-3 pr-8 text-xs font-bold uppercase tracking-wide text-primary outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Criado: {formatDate(lead.created_at)}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={openWhatsApp}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted"
                >
                  <MessageCircle className="h-4 w-4 text-[var(--success)]" /> WhatsApp
                </button>
                <button
                  onClick={() => createRoteiro.mutate()}
                  disabled={createRoteiro.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                >
                  <MapIcon className="h-4 w-4" /> Criar Roteiro
                </button>
                <button
                  onClick={() => navigate({ to: "/leads/$leadId", params: { leadId } })}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Columns className="h-4 w-4" /> Pipeline
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-border px-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition ${
                    tab === t.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {t.key === "checklist" && (
                    <span className="text-xs text-muted-foreground">
                      {checklistCount((lead.checklists as Record<string, boolean>) || {})}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === "perfil" && <PerfilTab lead={lead} activities={activities} />}
              {tab === "viagem" && <ViagemTab lead={lead} p={p} />}
              {tab === "atividades" && (
                <AtividadesTab leadId={leadId} team={team} activities={activities} />
              )}
              {tab === "checklist" && (
                <ChecklistTab
                  checklists={(lead.checklists as Record<string, boolean>) || {}}
                  onSave={(c) => update.mutate({ checklists: c })}
                />
              )}
              {tab === "notas" && (
                <NotasTab
                  notes={lead.notes || ""}
                  activities={activities}
                  onSave={(notes) => update.mutate({ notes })}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 border-t border-border p-4">
              <button
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <X className="h-4 w-4" /> Fechar
              </button>
              <button
                onClick={() => createRoteiro.mutate()}
                disabled={createRoteiro.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <MapIcon className="h-4 w-4" /> Criar Roteiro
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function checklistCount(c: Record<string, boolean>) {
  const entries = Object.values(c);
  const done = entries.filter(Boolean).length;
  return `${done}/${entries.length}`;
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" /> {children}
    </h3>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function PerfilTab({ lead, activities }: { lead: Lead; activities: import("@/lib/types").LeadActivity[] }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={User}>Dados de contato</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Field label="E-mail" value={lead.email} />
          <Field label="WhatsApp" value={lead.phone ? maskPhone(lead.phone) : null} />
          <Field label="Orçamento" value={formatCurrency(lead.value)} />
          <Field label="Origem" value={lead.origin} />
        </div>
      </section>
      <section>
        <SectionTitle icon={Clock}>Atividade recente</SectionTitle>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="space-y-3">
            {activities.slice(0, 4).map((a) => (
              <li key={a.id} className="relative rounded-xl bg-muted/50 p-3 pl-5">
                <span className="absolute left-2 top-4 h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm font-medium">{a.title}</p>
                {a.details && <p className="text-xs text-muted-foreground">{a.details}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ViagemTab({ lead, p }: { lead: Lead; p: Record<string, string> }) {
  const hasMiles = p.loyalty_programs || p.points_miles;
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={Plane}>Dados da viagem</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Destino" value={lead.destination} />
          <Field label="Ponto de partida" value={p.departure} />
          <Field label="Data pretendida" value={p.travel_dates} />
          <Field label="Nº pessoas" value={p.passengers} />
          <Field label="Hospedagem" value={p.hotel_category} />
          <Field label="Flexibilidade" value={p.preferences || p.trip_type} />
        </div>
      </section>
      <section>
        <SectionTitle icon={CreditCard}>Cartões & milhas</SectionTitle>
        {hasMiles ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Programas" value={p.loyalty_programs} />
            <Field label="Pontos / milhas" value={p.points_miles} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-6 text-center">
            <Info className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum cartão ou milha registrado.
              <br />
              Esses dados são preenchidos no formulário de cadastro.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function AtividadesTab({
  leadId,
  team,
  activities,
}: {
  leadId: string;
  team: import("@/lib/types").AgencyMember[];
  activities: import("@/lib/types").LeadActivity[];
}) {
  const qc = useQueryClient();
  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [assigned, setAssigned] = useState("");

  const register = useMutation({
    mutationFn: () =>
      createLeadActivity(leadId, {
        type,
        title: title.trim() || ACTIVITY_TYPES.find((t) => t.key === type)?.label || "Atividade",
        details,
        assigned_to_id: assigned || null,
      }),
    onSuccess: () => {
      setTitle("");
      setDetails("");
      toast.success("Atividade registrada.");
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    },
    onError: () => toast.error("Erro ao registrar atividade."),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border p-4">
        <SectionTitle icon={ClipboardList}>Registrar atividade</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                type === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da atividade…"
          className="mb-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Detalhes…"
          className="mb-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="flex items-center gap-2">
          <select
            value={assigned}
            onChange={(e) => setAssigned(e.target.value)}
            className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Ninguém</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => register.mutate()}
            disabled={register.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Registrar
          </button>
        </div>
      </section>

      <section>
        <SectionTitle icon={Clock}>
          Histórico de atividades{" "}
          <span className="ml-auto font-normal normal-case text-muted-foreground">
            {activities.length} registros
          </span>
        </SectionTitle>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
                {a.details && <p className="mt-1 text-sm text-muted-foreground">{a.details}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChecklistTab({
  checklists,
  onSave,
}: {
  checklists: Record<string, boolean>;
  onSave: (c: Record<string, boolean>) => void;
}) {
  const [items, setItems] = useState<Record<string, boolean>>(checklists);
  const [newItem, setNewItem] = useState("");
  const entries = Object.entries(items);

  function toggle(key: string) {
    const next = { ...items, [key]: !items[key] };
    setItems(next);
    onSave(next);
  }
  function add() {
    const label = newItem.trim();
    if (!label || items[label] !== undefined) return;
    const next = { ...items, [label]: false };
    setItems(next);
    setNewItem("");
    onSave(next);
  }
  function remove(key: string) {
    const next = { ...items };
    delete next[key];
    setItems(next);
    onSave(next);
  }

  return (
    <div>
      <SectionTitle icon={ListChecks}>Checklist</SectionTitle>
      <ul className="space-y-2">
        {entries.length === 0 && <li className="text-sm text-muted-foreground">Nenhum item.</li>}
        {entries.map(([key, done]) => (
          <li key={key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <button
              onClick={() => toggle(key)}
              className={`flex h-5 w-5 items-center justify-center rounded border ${
                done ? "border-primary bg-primary text-primary-foreground" : "border-input"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
            </button>
            <span className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}>{key}</span>
            <button onClick={() => remove(key)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Novo item…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button onClick={add} className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          Adicionar
        </button>
      </div>
    </div>
  );
}

function NotasTab({
  notes,
  activities,
  onSave,
}: {
  notes: string;
  activities: import("@/lib/types").LeadActivity[];
  onSave: (notes: string) => void;
}) {
  const [value, setValue] = useState(notes);
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={StickyNote}>Observações</SectionTitle>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => value !== notes && onSave(value)}
          rows={5}
          placeholder="Anotações sobre o lead…"
          className="w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
        />
      </section>
      <section>
        <SectionTitle icon={Clock}>Histórico de contato</SectionTitle>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum contato registrado.</p>
        ) : (
          <ul className="space-y-3 border-l-2 border-border pl-4">
            {activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-card" />
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.details || formatDate(a.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
