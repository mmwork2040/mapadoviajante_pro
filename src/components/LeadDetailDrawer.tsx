import { useEffect, useRef, useState } from "react";
import { ScrollLock } from "@/components/ScrollLock";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  X,
  MapPin,
  MessageCircle,
  Map as MapIcon,
  
  User,
  Plane,
  Gift,
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
  Pencil,
  Clock,
  CalendarClock,
  CreditCard,
  Info,
  ChevronDown,
  Trash2,
  Plus,
  RotateCcw,
  CheckCircle2,
  Maximize2,
  Minimize2,
  CircleDollarSign,

} from "lucide-react";
import { toast } from "sonner";
import {
  createItinerary,
  createLeadActivity,
  createNotification,
  createTripExpense,
  deleteTripExpense,
  fetchTripExpenses,
  updateTripExpense,
  getMemberId,
  deleteLead,
  deleteLeadActivity,
  fetchItinerariesByLead,
  fetchClientTripHistory,
  fetchLeadActivities,
  fetchLeadById,
  fetchTeamMembers,
  resolveDisplayImageUrl,
  isOverdue,
  setLeadActivityCompleted,
  updateItinerary,
  updateLead,
  updateLeadActivity,
} from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, formatDate, initials, maskPhone, maskCurrency, parseCurrency } from "@/lib/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { NewLeadModal } from "@/routes/_app.leads";
import { useAuth, isAdminUser } from "@/lib/auth";
import type { Itinerary, Lead, LeadStatus, TripBenefits, TripExpense } from "@/lib/types";

const STATUSES: { key: LeadStatus; label: string; dot: string }[] = [
  { key: "new", label: "Novo", dot: "bg-blue-500" },
  { key: "contacted", label: "Contatado", dot: "bg-sky-500" },
  { key: "negotiating", label: "Negociando", dot: "bg-amber-400" },
  { key: "closed", label: "Fechado", dot: "bg-emerald-500" },
  { key: "lost", label: "Perdido", dot: "bg-red-500" },
];

const TABS = [
  { key: "perfil", label: "Perfil", icon: User },
  { key: "viagem", label: "Viagem", icon: Plane },
  { key: "atividades", label: "Atividades", icon: ClipboardList },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "financeiro", label: "Financeiro", icon: CircleDollarSign },
  { key: "beneficios", label: "Benefícios", icon: Gift },
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
  useBackButtonClose(true, onClose);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { member, session } = useAuth();
  const isAdmin = isAdminUser(member, session?.user?.email);
  const [tab, setTab] = useState<TabKey>("perfil");
  const [editOpen, setEditOpen] = useState(false);
  const [linkedItinerary, setLinkedItinerary] = useState<Itinerary | null>(null);
  const [fullscreen, setFullscreen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("lead-panel-fullscreen") === "1";
  });
  const toggleFullscreen = () => {
    setFullscreen((v) => {
      const next = !v;
      try { window.localStorage.setItem("lead-panel-fullscreen", next ? "1" : "0"); } catch {}
      return next;
    });
  };
  const tabsRef = useRef<HTMLDivElement>(null);

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

  const assign = useMutation({
    mutationFn: (memberId: string) => updateLead(leadId, { assigned_to: memberId || null }),
    onSuccess: async (_res, memberId) => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      if (memberId && memberId !== getMemberId()) {
        await createNotification({
          recipientId: memberId,
          type: "lead_assigned",
          title: "Lead atribuído a você",
          body: lead?.name || "",
          link: `/leads?lead=${leadId}`,
          leadId,
        });
        toast.success("Lead atribuído e notificação enviada.");
      } else {
        toast.success("Lead atribuído.");
      }
    },
    onError: () => toast.error("Erro ao atribuir lead."),
  });

  async function handleAssign(memberId: string) {
    if (memberId === (lead?.assigned_to || "")) return;
    const member = team.find((m) => m.id === memberId);
    const ok = await confirm({
      title: "Atribuir lead",
      description: member
        ? `Deseja atribuir este lead a ${member.name}?`
        : "Deseja remover a atribuição deste lead?",
      confirmLabel: "Confirmar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    assign.mutate(memberId);
  }

  async function handleStatusChange(status: LeadStatus) {
    if (status === lead?.status) return;
    update.mutate(
      { status },
      {
        onSuccess: async () => {
          const responsible = lead?.assigned_to;
          if (responsible && responsible !== getMemberId()) {
            const label = STATUSES.find((s) => s.key === status)?.label || status;
            await createNotification({
              recipientId: responsible,
              type: "lead_status",
              title: "Status de lead atualizado",
              body: `${lead?.name || "Lead"} — ${label}`,
              link: `/leads?lead=${leadId}`,
              leadId,
            });
          }
        },
      },
    );
  }



  async function handleDelete() {
    const ok = await confirm({
      title: "Excluir viajante",
      description: `Tem certeza que deseja excluir "${lead?.name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    const done = await deleteLead(leadId);
    if (done) {
      toast.success("Viajante excluído.");
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    } else {
      toast.error("Erro ao excluir viajante.");
    }
  }

  const createRoteiro = useMutation({
    mutationFn: () => {
      const p = (lead?.profile || {}) as Record<string, unknown>;
      const pax = Number(p.passengers);
      const dates = /^(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})$/.exec(
        String(p.travel_dates || "").trim(),
      );
      return createItinerary({
        lead_id: leadId,
        title: `Roteiro - ${lead?.name}`,
        client_name: lead?.name,
        destination: lead?.destination || "",
        budget: Number(lead?.value) || 0,
        passengers: Number.isFinite(pax) && pax > 0 ? pax : 1,
        start_date: dates?.[1] || null,
        end_date: dates?.[2] || null,
        status: "draft",
      });
    },

    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar roteiro.");
      toast.success("Roteiro criado!");
      navigate({ to: "/roteiros/$id", params: { id: res.id } });
    },
    onError: () => toast.error("Erro ao criar roteiro."),
  });

  async function handleCreateRoteiro() {
    if (createRoteiro.isPending) return;
    const existing = await fetchItinerariesByLead(leadId);
    const openOne = existing.find((it) => it.status === "draft" || it.status === "active");
    if (openOne) {
      const choice = await confirm({
        title: "Roteiro em aberto",
        description: `Este lead já possui um roteiro em ${
          openOne.status === "draft" ? "rascunho" : "andamento"
        }. Deseja abri-lo em vez de criar outro?`,
        confirmLabel: "Abrir existente",
        cancelLabel: "Criar novo",
        thirdLabel: "Fechar",
      });
      if (choice === "third") return;
      if (choice === true) {
        navigate({ to: "/roteiros/$id", params: { id: openOne.id } });
        return;
      }
    }
    const ok = await confirm({
      title: "Criar roteiro",
      description: "Deseja criar um novo roteiro para este lead?",
      confirmLabel: "Criar",
    });
    if (ok) createRoteiro.mutate();
  }





  const ITINERARY_STATUS_LABELS: Record<string, string> = {
    draft: "Rascunho",
    active: "Em andamento",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  async function handleEdit() {
    const existing = await fetchItinerariesByLead(leadId);
    const linked = existing.find((it) => it.status !== "cancelled") ?? null;

    // Sem roteiro vinculado: edição normal, sem impacto.
    if (!linked) {
      setLinkedItinerary(null);
      setEditOpen(true);
      return;
    }

    if (linked.status === "draft") {
      const ok = await confirm({
        title: "Roteiro em rascunho",
        description:
          "Este viajante possui um roteiro em rascunho. As alterações feitas aqui podem afetar o rascunho diretamente. Deseja continuar?",
        confirmLabel: "Continuar",
        cancelLabel: "Cancelar",
      });
      if (!ok) return;
      setLinkedItinerary(linked);
      setEditOpen(true);
      return;
    }

    // Roteiro em outro status: precisa voltar para rascunho antes de editar.
    const ok = await confirm({
      title: "Roteiro não editável",
      description: `Este viajante possui um roteiro em "${
        ITINERARY_STATUS_LABELS[linked.status] || linked.status
      }". Para editar o viajante, o roteiro será movido para Rascunho. Deseja continuar?`,
      confirmLabel: "Mover para Rascunho",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    const moved = await updateItinerary(linked.id, { status: "draft" });
    if (!moved) {
      toast.error("Erro ao mover o roteiro para rascunho.");
      return;
    }
    toast.success("Roteiro movido para rascunho.");
    setLinkedItinerary(moved);
    setEditOpen(true);
  }


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
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    resolveDisplayImageUrl(p.cover_image).then((url) => { if (active) setCoverUrl(url); });
    return () => { active = false; };
  }, [p.cover_image]);

  function openWhatsApp() {
    if (!phoneDigits) return toast.error("Lead sem telefone cadastrado.");
    window.open(`https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : "55" + phoneDigits}`, "_blank");
  }

  return (
    <div className={`fixed inset-0 z-50 flex bg-black/40 ${fullscreen ? "justify-center" : "justify-end"}`} onClick={onClose}>
      <ScrollLock />
      <aside
        className={`flex h-full flex-col bg-card shadow-2xl animate-in duration-200 ${
          fullscreen
            ? "w-full max-w-none fade-in"
            : "w-full max-w-md slide-in-from-right"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {!lead ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">Carregando…</div>
        ) : (
          <>
            {/* Header */}
            <div className="relative border-b border-border p-5">
              {coverUrl && (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
                    style={{ backgroundImage: `url(${coverUrl})` }}
                    aria-hidden
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-card/40 to-card/70" aria-hidden />
                </>
              )}
              <div className="relative flex items-start gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                  {initials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-bold">{lead.name}</h2>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {lead.destination || "—"}
                  </p>
                  <p className="text-lg font-bold text-primary" title="Orçamento da viagem">
                    {formatCurrency(lead.value)}
                    <span className="ml-1 text-[11px] font-medium text-muted-foreground">orçamento</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={toggleFullscreen}
                    aria-label={fullscreen ? "Reduzir painel" : "Expandir para tela cheia"}
                    title={fullscreen ? "Reduzir" : "Tela cheia"}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                  >
                    {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative mt-3 flex items-center justify-between gap-2">
                <StatusDropdown
                  value={lead.status}
                  onChange={(status) => handleStatusChange(status)}
                />
                <span className="text-xs text-muted-foreground">Criado: {formatDate(lead.created_at)}</span>
                {lead.updated_at && (
                  <span className="text-xs text-muted-foreground">Atualizado: {formatDate(lead.updated_at)}</span>
                )}
              </div>

              <div className="relative mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={openWhatsApp}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted"
                >
                  <MessageCircle className="h-4 w-4 text-[var(--success)]" /> WhatsApp
                </button>
                <button
                  onClick={handleEdit}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
              </div>

              <div className="relative mt-2 flex items-center gap-2">
                <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-muted-foreground">
                  <User className="h-4 w-4 text-primary" /> Atribuir a:
                </span>
                <select
                  value={lead.assigned_to || ""}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={assign.isPending}
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-2 text-xs outline-none focus:border-primary disabled:opacity-60"
                >
                  <option value="">Ninguém</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              {lead.assigned_to && (
                <p className="relative mt-1 pl-6 text-[11px] text-muted-foreground">
                  Responsável:{" "}
                  <span className="font-medium text-foreground">
                    {team.find((m) => m.id === lead.assigned_to)?.name || "—"}
                  </span>
                </p>
              )}
            </div>



            {/* Tabs */}
            <div
              ref={tabsRef}
              onWheel={(e) => {
                if (e.deltaY === 0) return;
                e.currentTarget.scrollLeft += e.deltaY;
              }}
              className="flex overflow-x-auto scrollbar-thin border-b border-border px-2"
            >
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
                      {checklistCount(lead.checklists as unknown)}
                    </span>
                  )}

                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
              {tab === "perfil" && (
                <PerfilTab
                  lead={lead}
                  team={team}
                  activities={activities}
                  onUpdate={(u) => update.mutate(u)}
                  onOpenActivities={() => setTab("atividades")}
                />
              )}
              {tab === "viagem" && (
                <ViagemTab
                  lead={lead}
                  p={p}
                  isAdmin={isAdmin}
                  onUpdateProfile={(patch) =>
                    update.mutate({
                      profile: { ...((lead.profile as Record<string, unknown>) || {}), ...patch },
                    })
                  }
                />
              )}
              {tab === "atividades" && (
                <AtividadesTab leadId={leadId} team={team} activities={activities} />
              )}
              {tab === "checklist" && (
                <ChecklistTab
                  checklists={lead.checklists as unknown}
                  onSave={(c) => update.mutate({ checklists: c as unknown as Record<string, unknown> })}
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
                onClick={handleCreateRoteiro}
                disabled={createRoteiro.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <MapIcon className="h-4 w-4" /> Criar Roteiro
              </button>
            </div>
          </>
        )}
      </aside>
      {editOpen && lead && (
        <div onClick={(e) => e.stopPropagation()}>
          <NewLeadModal
            lead={lead}
            linkedItinerary={linkedItinerary}
            onClose={() => setEditOpen(false)}
            onDelete={handleDelete}
            onCreated={() => {
              setEditOpen(false);
              setLinkedItinerary(null);
              qc.invalidateQueries({ queryKey: ["lead", leadId] });
              qc.invalidateQueries({ queryKey: ["leads"] });
            }}
          />
        </div>
      )}
    </div>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: LeadStatus;
  onChange: (status: LeadStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = STATUSES.find((s) => s.key === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1.5 pl-3 pr-2 text-xs font-semibold text-foreground"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${current?.dot || "bg-muted-foreground"}`} />
        {current?.label || "—"}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 z-10 mt-1 min-w-40 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                onChange(s.key);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted ${
                s.key === value ? "font-semibold" : ""
              }`}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function checklistCount(raw: unknown) {
  const norm = normalizeChecklist(raw);
  const values = Object.values(norm.items);
  const done = values.filter(Boolean).length;
  return `${done}/${values.length}`;
}


function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" /> {children}
    </h3>
  );
}

function Field({ label, value, wrap }: { label: string; value?: string | null; wrap?: boolean }) {
  const text = value || "—";
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xs font-medium ${wrap ? "whitespace-pre-wrap break-words" : "truncate"}`}>{text}</p>
    </div>
  );
}

function CollapsibleSection({
  icon: Icon,
  title,
  count,
  children,
  controlledOpen,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  children: React.ReactNode;
  controlledOpen?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const open = controlledOpen ?? internal;
  return (
    <section>
      <button
        type="button"
        onClick={() => (onToggle ? onToggle(!open) : setInternal((v) => !v))}
        className="mb-3 flex w-full items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
      >
        <Icon className="h-4 w-4 text-primary" /> {title}
        {typeof count === "number" && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary">
            {count}
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && children}
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium">{value ?? "—"}</p>
    </div>
  );
}

function ResponsibleField({
  value,
  team,
  onSave,
}: {
  value?: string | null;
  team: import("@/lib/types").AgencyMember[];
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const current = team.find((m) => m.id === value);

  function start() {
    setDraft(value ?? "");
    setEditing(true);
  }
  function save() {
    if ((draft ?? "") !== (value ?? "")) onSave(draft);
    setEditing(false);
  }

  return (
    <div className="group relative col-span-2 rounded-xl bg-muted/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Responsável</p>
      {editing ? (
        <div className="mt-1 flex items-center gap-1">
          <select
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(value ?? "");
                setEditing(false);
              }
            }}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
          >
            <option value="">Sem responsável</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            title="Salvar"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="mt-0.5 flex items-center gap-1">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{current?.name || "—"}</p>
          <button
            onClick={start}
            title="Editar"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}


function PerfilTab({
  lead,
  team,
  activities,
  onUpdate,
  onOpenActivities,
}: {
  lead: Lead;
  team: import("@/lib/types").AgencyMember[];
  activities: import("@/lib/types").LeadActivity[];
  onUpdate: (updates: Partial<Lead>) => void;
  onOpenActivities?: () => void;
}) {
  return (
    <div className="space-y-6">
      <CollapsibleSection icon={User} title="Dados de contato">
        <div className="grid grid-cols-2 gap-2">
          <ReadOnlyField label="E-mail" value={lead.email} />
          <ReadOnlyField label="WhatsApp" value={lead.phone ? maskPhone(lead.phone) : null} />
          <ReadOnlyField label="Orçamento" value={formatCurrency(lead.value)} />
          <ReadOnlyField label="Origem" value={lead.origin} />
          <ResponsibleField
            value={lead.assigned_to}
            team={team}
            onSave={(v) => onUpdate({ assigned_to: v || null })}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={Clock} title="Atividade recente" count={activities.length}>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="space-y-3">
            {activities.slice(0, 4).map((a) => {
              const meta = activityMeta(a.type);
              return (
                <li key={a.id} className="flex gap-3 rounded-xl bg-muted/50 p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {meta.label}
                    </p>
                    {a.details && <p className="text-xs text-muted-foreground">{a.details}</p>}
                    {a.due_date && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="h-3 w-3" /> {formatDate(a.due_date)}
                      </p>
                    )}
                  </div>
                  {onOpenActivities && (
                    <button
                      onClick={onOpenActivities}
                      className="shrink-0 self-start inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/20"
                      title="Ver detalhes na aba Atividades"
                    >
                      <Plus className="h-3 w-3" /> info
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

        )}
      </CollapsibleSection>
    </div>
  );
}

function ViagemTab({
  lead,
  p,
  isAdmin,
  onUpdateProfile,
}: {
  lead: Lead;
  p: Record<string, string>;
  isAdmin: boolean;
  onUpdateProfile: (patch: Record<string, unknown>) => void;
}) {
  const hasBenefits = p.loyalty_programs || p.points_miles || p.has_passport || p.preferences;
  return (
    <div className="space-y-6">
      <CollapsibleSection icon={Plane} title="Detalhes da viagem">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ponto de partida" value={p.departure} />
          <Field label="Destino" value={lead.destination} />
          <Field label="Orçamento da viagem" value={lead.value ? formatCurrency(lead.value) : ""} />
          <Field label="Data pretendida" value={p.travel_dates} />
          <Field label="Nº de passageiros" value={p.passengers} />
          <Field label="Tipo de viagem" value={p.trip_type} />
        </div>
        {p.trip_notes && (
          <div className="mt-2">
            <Field label="Detalhes e expectativas" value={p.trip_notes} />
          </div>
        )}
      </CollapsibleSection>
      <CollapsibleSection icon={Gift} title="Benefícios & fidelidade">
        {hasBenefits ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Programas de fidelidade" value={p.loyalty_programs} />
              <Field label="Pontos / milhas" value={p.points_miles} />
              <Field label="Possui passaporte?" value={p.has_passport} />
            </div>
            {p.preferences && <Field label="Preferências do cliente" value={p.preferences} wrap />}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-6 text-center">
            <Info className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum benefício ou fidelidade registrado.
              <br />
              Esses dados são preenchidos no formulário de cadastro.
            </p>
          </div>
        )}
      </CollapsibleSection>

      {isAdmin && <FinanceiroSection p={p} onUpdateProfile={onUpdateProfile} />}

      <ClientTripHistory lead={lead} />
    </div>
  );
}

function FinanceiroSection({
  p,
  onUpdateProfile,
}: {
  p: Record<string, string>;
  onUpdateProfile: (patch: Record<string, unknown>) => void;
}) {
  const current = p.consultancy_fee || "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(
    current ? maskCurrency(String(Math.round(Number(current) * 100))) : "",
  );
  useEffect(() => {
    setValue(current ? maskCurrency(String(Math.round(Number(current) * 100))) : "");
  }, [current]);

  const save = () => {
    const num = parseCurrency(value);
    onUpdateProfile({ consultancy_fee: num });
    setEditing(false);
    toast.success("Valor de consultoria atualizado.");
  };

  return (
    <CollapsibleSection icon={CircleDollarSign} title="Financeiro (admin)">
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Valor da consultoria
        </p>
        {editing ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(maskCurrency(e.target.value))}
              placeholder="R$ 0,00"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={save}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Salvar
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-lg font-bold text-primary">
              {current ? formatCurrency(Number(current)) : "—"}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              {current ? "Editar" : "Definir"}
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Visível apenas para administradores. Não afeta o orçamento da viagem.
        </p>
      </div>
    </CollapsibleSection>
  );
}

function ClientTripHistory({ lead }: { lead: Lead }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["client-trip-history", lead.id, lead.email, lead.phone],
    queryFn: () => fetchClientTripHistory(lead),
  });
  return (
    <CollapsibleSection icon={MapIcon} title="Histórico de viagens do cliente" count={data.length}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma viagem anterior encontrada.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((it) => (
            <li key={it.id}>
              <Link
                to="/roteiros/$id"
                params={{ id: it.id }}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:border-primary hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.title || it.destination || "Roteiro"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[it.destination, it.lead_name].filter(Boolean).join(" • ") || "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {it.start_date ? formatDate(it.start_date) : "s/ data"}
                    {it.end_date ? ` → ${formatDate(it.end_date)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {it.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
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
  const confirm = useConfirm();
  const [type, setType] = useState("note");
  const [title, setTitle] = useState(
    ACTIVITY_TYPES.find((t) => t.key === "note")?.label || "Observação",
  );
  const [details, setDetails] = useState("");
  const [assigned, setAssigned] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  function resetForm() {
    setEditingId(null);
    setType("note");
    setTitle(ACTIVITY_TYPES.find((t) => t.key === "note")?.label || "Observação");
    setDetails("");
    setAssigned("");
    setDueDate("");
  }

  function startEdit(a: import("@/lib/types").LeadActivity) {
    setEditingId(a.id);
    setType(a.type);
    setTitle(a.title);
    setDetails(a.details || "");
    setAssigned(a.assigned?.id || "");
    setDueDate(a.due_date ? a.due_date.slice(0, 10) : "");
    setRegisterOpen(true);
  }

  const register = useMutation({
    mutationFn: async () => {
      if (!dueDate) throw new Error("A data de execução é obrigatória.");
      if (!details.trim()) throw new Error("Os detalhes são obrigatórios.");
      if (details.trim().length > 250) throw new Error("Os detalhes devem ter no máximo 250 caracteres.");
      const payload = {
        type,
        title: title.trim() || ACTIVITY_TYPES.find((t) => t.key === type)?.label || "Atividade",
        details: details.trim(),
        assigned_to_id: assigned || null,
        due_date: new Date(`${dueDate}T09:00:00`).toISOString(),
      };
      if (editingId) return updateLeadActivity(editingId, payload);
      await createLeadActivity(leadId, payload);
      return true;
    },
    onSuccess: (res) => {
      if (editingId && !res) return toast.error("Erro ao atualizar atividade.");
      toast.success(editingId ? "Atividade atualizada." : "Atividade registrada.");
      resetForm();
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar atividade."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLeadActivity(id),
    onSuccess: (ok) => {
      if (!ok) return toast.error("Erro ao excluir atividade.");
      toast.success("Atividade excluída.");
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Erro ao excluir atividade."),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      setLeadActivityCompleted(id, completed),
    onSuccess: (ok) => {
      if (!ok) return toast.error("Erro ao alterar o status.");
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Erro ao alterar o status."),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border p-4">
        <CollapsibleSection
          icon={ClipboardList}
          title={editingId ? "Editar atividade" : "Registrar atividade"}
          controlledOpen={registerOpen}
          onToggle={setRegisterOpen}
        >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                setTitle(t.label);
              }}
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
          maxLength={250}
          placeholder="Detalhes…"
          className="mb-2 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <label className="mb-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-primary">
            <CalendarClock className="h-4 w-4" /> Data de execução:
          </span>
          <input
            type="date"
            value={dueDate}
            required
            onChange={(e) => setDueDate(e.target.value)}
            className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-red-600">
            <User className="h-4 w-4" /> Atribuir a:
          </span>
          <select
            value={assigned}
            onChange={(e) => setAssigned(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Ninguém</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {editingId && (
              <button
                onClick={resetForm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            )}
            <button
              onClick={() => register.mutate()}
              disabled={register.isPending || !dueDate}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {editingId ? "Salvar" : "Registrar"}
            </button>
          </div>
        </div>
        </CollapsibleSection>
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
            {activities.map((a) => {
              const meta = activityMeta(a.type);
              const isOpen = expanded.has(a.id);
              return (
                <li key={a.id} className="group flex gap-3 rounded-xl border border-border p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(a.id)}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                      />
                      <span className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug">{a.title}</span>
                      {a.completed && (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Concluída
                        </span>
                      )}
                      {isOverdue(a.due_date, a.completed) && (
                        <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          Atrasada
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                    </button>
                    {isOpen && (
                      <div className="mt-1 pl-6">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {meta.label}
                        </p>
                        {a.details && <p className="mt-1 text-sm text-muted-foreground">{a.details}</p>}
                        {a.due_date && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="h-3 w-3" /> Execução: <span className="font-medium text-foreground">{formatDate(a.due_date)}</span>
                          </p>
                        )}
                        {a.assigned?.name && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" /> Atribuído a: <span className="font-medium text-foreground">{a.assigned.name}</span>
                          </p>
                        )}
                      </div>
                    )}
                   </div>
                  <div className="flex shrink-0 flex-col items-center gap-2 self-start">
                    <button
                      onClick={() => startEdit(a)}
                      title="Editar atividade"
                      className="text-muted-foreground transition hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {a.due_date && (
                      <button
                        onClick={async () => {
                          const next = !a.completed;
                          const ok = await confirm({
                            title: next ? "Concluir atividade" : "Reabrir atividade",
                            description: next
                              ? `Marcar "${a.title}" como concluída?`
                              : `Reabrir "${a.title}" como pendente?`,
                            confirmLabel: next ? "Concluir" : "Reabrir",
                          });
                          if (ok) toggleStatus.mutate({ id: a.id, completed: next });
                        }}
                        disabled={toggleStatus.isPending}
                        title={a.completed ? "Reabrir atividade" : "Concluir atividade"}
                        className={`transition ${
                          a.completed
                            ? "text-emerald-600 hover:text-muted-foreground dark:text-emerald-400"
                            : "text-muted-foreground hover:text-emerald-600"
                        }`}
                      >
                        {a.completed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Excluir atividade",
                          description: `Deseja excluir "${a.title}"? Esta ação não pode ser desfeita.`,
                          confirmLabel: "Excluir",
                          destructive: true,
                        });
                        if (ok) remove.mutate(a.id);
                      }}
                      disabled={remove.isPending}
                      title="Excluir atividade"
                      className="text-muted-foreground transition hover:text-destructive"
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

        )}
      </section>
    </div>
  );
}

type LeadChecklistState = {
  templateId?: string;
  templateName?: string;
  sections?: import("@/lib/checklist-templates.functions").ChecklistSection[];
  items: Record<string, boolean>;
  extras?: { id: string; label: string }[];
};

function normalizeChecklist(raw: unknown): LeadChecklistState {
  if (!raw || typeof raw !== "object") return { items: {}, extras: [] };
  const obj = raw as Record<string, unknown>;
  if (obj.items && typeof obj.items === "object") {
    return {
      templateId: typeof obj.templateId === "string" ? obj.templateId : undefined,
      templateName: typeof obj.templateName === "string" ? obj.templateName : undefined,
      sections: Array.isArray(obj.sections) ? (obj.sections as never) : undefined,
      items: obj.items as Record<string, boolean>,
      extras: Array.isArray(obj.extras) ? (obj.extras as { id: string; label: string }[]) : [],
    };
  }
  // Legado: Record<label, boolean>
  const items: Record<string, boolean> = {};
  const extras: { id: string; label: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const id = `legacy:${k}`;
    items[id] = !!v;
    extras.push({ id, label: k });
  }
  return { items, extras };
}

function ChecklistTab({
  checklists,
  onSave,
}: {
  checklists: unknown;
  onSave: (c: LeadChecklistState) => void;
}) {
  const [state, setState] = useState<LeadChecklistState>(() => normalizeChecklist(checklists));
  const [templates, setTemplates] = useState<
    import("@/lib/checklist-templates.functions").ChecklistTemplate[]
  >([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newItem, setNewItem] = useState("");
  const confirm = useConfirm();

  useEffect(() => {
    setState(normalizeChecklist(checklists));
  }, [checklists]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { listChecklistTemplates } = await import("@/lib/checklist-templates.functions");
        const res = await listChecklistTemplates();
        if (!active) return;
        setTemplates(res.templates);
        setDefaultId(res.defaultId);
      } catch {
        // silently ignore — usuário pode continuar com checklist livre
      } finally {
        if (active) setLoadingTpl(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function persist(next: LeadChecklistState) {
    setState(next);
    onSave(next);
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const items: Record<string, boolean> = {};
    for (const s of tpl.sections)
      for (const g of s.groups) for (const it of g.items) items[it.id] = false;
    persist({
      templateId: tpl.id,
      templateName: tpl.name,
      sections: tpl.sections,
      items,
      extras: [],
    });
    setPickerOpen(false);
  }

  async function changeTemplate() {
    const ok = await confirm({
      title: "Trocar template?",
      description:
        "Todas as marcações atuais deste checklist serão substituídas pelo template selecionado.",
      confirmLabel: "Trocar",
      destructive: true,
    });
    if (!ok) return;
    setPickerOpen(true);
  }

  function toggle(id: string) {
    persist({ ...state, items: { ...state.items, [id]: !state.items[id] } });
  }

  function addExtra() {
    const label = newItem.trim();
    if (!label) return;
    const id = `extra:${Date.now().toString(36)}`;
    persist({
      ...state,
      items: { ...state.items, [id]: false },
      extras: [...(state.extras || []), { id, label }],
    });
    setNewItem("");
  }

  function removeExtra(id: string) {
    const items = { ...state.items };
    delete items[id];
    persist({
      ...state,
      items,
      extras: (state.extras || []).filter((e) => e.id !== id),
    });
  }

  const hasTemplate = !!state.sections && state.sections.length > 0;
  const totalItems = Object.keys(state.items).length;
  const doneItems = Object.values(state.items).filter(Boolean).length;

  if (!hasTemplate && (state.extras || []).length === 0) {
    // Sem template aplicado ainda
    return (
      <div className="space-y-4">
        <SectionTitle icon={ListChecks}>Checklist</SectionTitle>
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum checklist aplicado ainda.
          </p>
          {loadingTpl ? (
            <p className="mt-2 text-xs text-muted-foreground">Carregando templates…</p>
          ) : templates.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nenhum template disponível.</p>
          ) : (
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Aplicar template</label>
              <select
                defaultValue={defaultId || templates[0]?.id}
                onChange={(e) => applyTemplate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.id === defaultId ? "(padrão)" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() => applyTemplate(defaultId || templates[0].id)}
                className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Template
          </p>
          <p className="text-sm font-medium">
            {state.templateName || "Checklist personalizado"}
          </p>
          <p className="text-xs text-muted-foreground">
            {doneItems}/{totalItems} concluídos
          </p>
        </div>
        <button
          onClick={changeTemplate}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Trocar template
        </button>
      </div>

      {pickerOpen && (
        <div className="rounded-xl border border-border p-3">
          <label className="text-xs text-muted-foreground">Selecione um template</label>
          <div className="mt-2 space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>
                  {t.name}
                  {t.id === defaultId && (
                    <span className="ml-2 text-xs text-muted-foreground">(padrão)</span>
                  )}
                </span>
                <span className="text-xs text-primary">Aplicar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.sections?.map((section) => (
        <section key={section.id} className="rounded-xl border border-border">
          <h4 className="border-b border-border px-3 py-2 text-sm font-semibold">
            {section.title}
          </h4>
          <div className="space-y-4 p-3">
            {section.groups.map((group) => (
              <div key={group.id}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                <ul className="space-y-1.5">
                  {group.items.map((it) => {
                    const done = !!state.items[it.id];
                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => toggle(it.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              done
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input"
                            }`}
                          >
                            {done && <Check className="h-3 w-3" />}
                          </span>
                          <span className={done ? "text-muted-foreground line-through" : ""}>
                            {it.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Itens extras
        </p>
        <ul className="space-y-1.5">
          {(state.extras || []).map((e) => {
            const done = !!state.items[e.id];
            return (
              <li key={e.id} className="flex items-center gap-2">
                <button
                  onClick={() => toggle(e.id)}
                  className="flex flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      done ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}
                  >
                    {done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={done ? "text-muted-foreground line-through" : ""}>
                    {e.label}
                  </span>
                </button>
                <button
                  onClick={() => removeExtra(e.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExtra()}
            placeholder="Novo item…"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={addExtra}
            disabled={!newItem.trim()}
            className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      </section>
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
          placeholder="Detalhes…"
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
