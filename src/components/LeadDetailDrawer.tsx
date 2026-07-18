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
  updateTask,
  cleanTaskDescription,
} from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, formatDate, initials, maskPhone, maskCurrency, parseCurrency } from "@/lib/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { NewLeadModal } from "@/routes/_app.leads";
import { useAuth, isAdminUser } from "@/lib/auth";
import type { Itinerary, Lead, LeadStatus, Task, TripBenefits, TripExpense } from "@/lib/types";


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
  { key: "outros", label: "Outros", icon: ClipboardList },
];

function activityMeta(type?: string | null) {
  // Tarefas antigas eram gravadas com o tipo "task"; tratamos como "Outros".
  const key = type === "task" ? "outros" : type;
  return ACTIVITY_TYPES.find((t) => t.key === key) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}


const PRIO_META: Record<string, { label: string; cls: string }> = {
  low: { label: "Baixa", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  normal: { label: "Média", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  high: { label: "Alta", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
};




export function LeadDetailDrawer({
  leadId,
  onClose,
  highlightTask,
}: {
  leadId: string;
  onClose: () => void;
  highlightTask?: Task | null;
}) {
  useBackButtonClose(true, onClose);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { member, session } = useAuth();
  const isAdmin = isAdminUser(member, session?.user?.email);
  const [tab, setTab] = useState<TabKey>(highlightTask ? "atividades" : "checklist");
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

              <details className="group relative mt-3 rounded-xl border border-border bg-muted/30 open:bg-muted/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted/60">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      {lead.destination || "Sem destino"}
                      {(() => {
                        const dates = String(p.travel_dates || "").trim();
                        return dates ? <> · <span className="text-foreground">{dates}</span></> : null;
                      })()}
                    </span>
                    {lead.assigned_to && (
                      <span className="ml-auto hidden shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-foreground sm:inline">
                        {team.find((m) => m.id === lead.assigned_to)?.name || "—"}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>

                <div className="space-y-3 px-3 pb-3 pt-1">
                  <TripSummaryStrip
                    clientName={lead.name}
                    destination={lead.destination}
                    travelDates={String(p.travel_dates || "")}
                    clientNotes={String(p.trip_notes || "")}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={openWhatsApp}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold hover:bg-muted"
                    >
                      <MessageCircle className="h-4 w-4 text-[var(--success)]" /> WhatsApp
                    </button>
                    <button
                      onClick={handleEdit}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
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
                </div>
              </details>

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
              {tab === "financeiro" && (
                <FinanceiroTab
                  lead={lead}
                  isAdmin={isAdmin}
                  onUpdate={(u) => update.mutate(u)}
                />
              )}
              {tab === "beneficios" && (
                <BeneficiosTab
                  lead={lead}
                  onUpdate={(b) => update.mutate({ benefits: b as unknown as Record<string, unknown> })}
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
              {(() => {
                const blocked = lead?.status === "closed" || lead?.status === "lost";
                return (
                  <button
                    onClick={handleCreateRoteiro}
                    disabled={createRoteiro.isPending || blocked}
                    title={blocked ? "Não é possível criar roteiro para leads fechados ou perdidos" : undefined}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MapIcon className="h-4 w-4" /> Criar Roteiro
                  </button>
                );
              })()}
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

function TripSummaryStrip({
  clientName,
  destination,
  travelDates,
  clientNotes,
}: {
  clientName?: string | null;
  destination?: string | null;
  travelDates?: string;
  clientNotes?: string;
}) {
  const m = /^(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})$/.exec((travelDates || "").trim());
  const startISO = m?.[1] || null;
  const endISO = m?.[2] || null;
  let countdown: string | null = null;
  if (startISO) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(`${startISO}T00:00:00`);
    const end = endISO ? new Date(`${endISO}T00:00:00`) : null;
    const diffDays = Math.round((start.getTime() - today.getTime()) / 86400000);
    if (diffDays > 0) countdown = `Faltam ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
    else if (end && today.getTime() <= end.getTime()) countdown = "Viagem em andamento";
    else if (diffDays === 0) countdown = "Começa hoje";
    else countdown = `Concluída há ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "dia" : "dias"}`;
  }
  const dateLabel = startISO
    ? `${formatDate(startISO)}${endISO ? " – " + formatDate(endISO) : ""}`
    : (travelDates?.trim() || null);

  const hasAny = clientName || destination || dateLabel || countdown || clientNotes;
  if (!hasAny) return null;

  return (
    <div className="relative mt-3 rounded-lg border border-border bg-muted/50 p-3 text-xs">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {clientName && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary" />
            <span className="truncate"><span className="text-muted-foreground">Cliente: </span><span className="font-medium text-foreground">{clientName}</span></span>
          </div>
        )}
        {destination && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="truncate"><span className="text-muted-foreground">Destino: </span><span className="font-medium text-foreground">{destination}</span></span>
          </div>
        )}
        {dateLabel && (
          <div className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            <span className="truncate"><span className="text-muted-foreground">Datas: </span><span className="font-medium text-foreground">{dateLabel}</span></span>
          </div>
        )}
        {countdown && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">{countdown}</span>
          </div>
        )}
      </div>
      {clientNotes && (
        <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="whitespace-pre-wrap text-muted-foreground line-clamp-4">{clientNotes}</p>
        </div>
      )}
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
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Salvar
            </button>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
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
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            )}
            <button
              onClick={() => register.mutate()}
              disabled={register.isPending || !dueDate}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
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
        "Os itens do template atual serão removidos imediatamente da listagem. Escolha o novo template em seguida.",
      confirmLabel: "Trocar",
      destructive: true,
    });
    if (!ok) return;
    // Remove imediatamente os itens do template anterior da listagem
    persist({ items: {}, extras: [] });
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
        <div className="flex items-center gap-2">
          <button
            onClick={changeTemplate}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Trocar template
          </button>
          <button
            onClick={async () => {
              const doneCount = Object.values(state.items).filter(Boolean).length;
              const totalCount = Object.keys(state.items).length;
              const extrasCount = (state.extras || []).length;
              const tplName = state.templateName || "Checklist personalizado";
              const ok = await confirm({
                title: "Remover checklist deste cliente?",
                description:
                  `Serão apagados:\n• Template: ${tplName}\n• Marcações: ${doneCount} de ${totalCount} itens concluídos\n• Itens extras: ${extrasCount}\n\nVocê poderá desfazer por alguns segundos após remover.`,
                confirmLabel: "Remover",
                destructive: true,
              });
              if (!ok) return;
              const snapshot = state;
              persist({ items: {}, extras: [] });
              setPickerOpen(false);
              const SECONDS = 6;
              const tid = `undo-checklist-${Date.now()}`;
              let remaining = SECONDS;
              let undone = false;
              const render = () =>
                toast(
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Checklist removido</span>
                      <span className="text-xs text-muted-foreground">
                        Desfazendo em {remaining}s…
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        undone = true;
                        clearInterval(iv);
                        persist(snapshot);
                        toast.dismiss(tid);
                        toast.success("Checklist restaurado");
                      }}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      Desfazer
                    </button>
                  </div>,
                  { id: tid, duration: Infinity },
                );
              render();
              const iv = setInterval(() => {
                remaining -= 1;
                if (undone) return;
                if (remaining <= 0) {
                  clearInterval(iv);
                  toast.dismiss(tid);
                  return;
                }
                render();
              }, 1000);
            }}
            className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Remover
          </button>
        </div>
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

      {state.sections?.map((section) => {
        const sectionItemIds = section.groups.flatMap((g) => g.items.map((i) => i.id));
        const sectionDone = sectionItemIds.filter((id) => state.items[id]).length;
        const sectionTotal = sectionItemIds.length;
        const pct = sectionTotal > 0 ? Math.round((sectionDone / sectionTotal) * 100) : 0;
        return (
          <details
            key={section.id}
            className="group rounded-xl border border-border [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-1.5 border-b border-border px-3 py-2 text-sm font-semibold">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 transition-transform group-open:rotate-0" />
                  {section.title}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {sectionDone}/{sectionTotal}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-red-500">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </summary>
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
          </details>
        );
      })}

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

// ═══════════════════════ Financeiro / Benefícios ═══════════════════════

const EXPENSE_CATEGORIES = [
  { key: "passagem", label: "Passagem" },
  { key: "hospedagem", label: "Hospedagem" },
  { key: "seguro", label: "Seguro" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "transporte", label: "Transporte" },
  { key: "extra", label: "Extra" },
  { key: "outro", label: "Outro" },
];

const PAID_WITH = [
  { key: "dinheiro", label: "Dinheiro/Pix" },
  { key: "cartao", label: "Cartão" },
  { key: "milhas", label: "Milhas/Pontos" },
  { key: "beneficio", label: "Benefício/Cortesia" },
];

function FinanceiroTab({
  lead,
  isAdmin,
  onUpdate,
}: {
  lead: Lead;
  isAdmin: boolean;
  onUpdate: (u: Partial<Lead>) => void;
}) {
  const qc = useQueryClient();
  const { data: expenses = [] } = useQuery({
    queryKey: ["trip-expenses", lead.id],
    queryFn: () => fetchTripExpenses(lead.id),
  });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TripExpense | null>(null);
  const [editingBudgets, setEditingBudgets] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["trip-expenses", lead.id] });

  const del = useMutation({
    mutationFn: (id: string) => deleteTripExpense(id),
    onSuccess: () => { invalidate(); toast.success("Gasto removido"); },
  });

  const total = Number(lead.budget_total || 0);
  const client = Number(lead.budget_client || 0);
  const osv = Number(lead.budget_osv || 0);
  const consultancy = Number(((lead.profile as Record<string, unknown> | undefined)?.consultancy_fee as number) || 0);
  const gasto = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const savings = expenses.reduce((s, e) => s + Number(e.savings || 0), 0);
  const brought = client && osv ? client - osv : 0;
  const totalSavings = savings + Math.max(brought, 0);
  const saldo = total - gasto;
  const pct = total > 0 ? Math.min(100, (gasto / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Orçamento total" value={formatCurrency(total)} />
        <SummaryCard label="Gasto até agora" value={formatCurrency(gasto)} tone={gasto > total && total > 0 ? "danger" : undefined} />
        <SummaryCard label="Saldo restante" value={formatCurrency(saldo)} tone={saldo < 0 ? "danger" : "ok"} />
        <SummaryCard label="Economia gerada" value={formatCurrency(totalSavings)} tone="ok" />
      </div>

      {total > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Uso do orçamento</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Orçamentos */}
      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h4 className="text-sm font-semibold">Orçamentos</h4>
          <button
            onClick={() => setEditingBudgets((v) => !v)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {editingBudgets ? "Fechar" : "Editar"}
          </button>
        </div>
        {editingBudgets ? (
          <BudgetsForm
            lead={lead}
            onSave={(patch) => { onUpdate(patch); setEditingBudgets(false); }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-3">
            <BudgetLine label="Total planejado" value={total} />
            <BudgetLine label="Valor trazido pelo cliente" value={client} />
            <BudgetLine label="Valor OSV" value={osv} />
          </div>
        )}
        {client > 0 && osv > 0 && (
          <div className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Diferença cliente × OSV:{" "}
            <span className={brought > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
              {formatCurrency(brought)}
            </span>
          </div>
        )}
      </div>

      {/* Consultoria (admin) */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Valor da consultoria (admin)
          </p>
          <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(consultancy)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Editável na aba Perfil → Financeiro (admin).
          </p>
        </div>
      )}

      {/* Lista de gastos */}
      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h4 className="text-sm font-semibold">Gastos ({expenses.length})</h4>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
        {showForm && (
          <ExpenseForm
            leadId={lead.id}
            expense={editing}
            onClose={() => { setShowForm(false); setEditing(null); }}
            onSaved={() => { invalidate(); setShowForm(false); setEditing(null); }}
          />
        )}
        {expenses.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum gasto registrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {expenses.map((e) => {
              const cat = EXPENSE_CATEGORIES.find((c) => c.key === e.category)?.label || e.category;
              const pw = PAID_WITH.find((p) => p.key === e.paid_with)?.label || e.paid_with;
              return (
                <li key={e.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.description || cat}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {cat} • {pw}
                      {e.occurred_at && <> • {formatDate(e.occurred_at)}</>}
                      {Number(e.savings) > 0 && (
                        <> • <span className="text-emerald-600">economia {formatCurrency(Number(e.savings))}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{formatCurrency(Number(e.amount))}</p>
                    <button
                      onClick={() => { setEditing(e); setShowForm(true); }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => del.mutate(e.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger";
}) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-red-600"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-bold ${toneCls}`}>{value}</p>
    </div>
  );
}

function BudgetLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value ? formatCurrency(value) : "—"}</p>
    </div>
  );
}

function BudgetsForm({
  lead,
  onSave,
}: {
  lead: Lead;
  onSave: (patch: Partial<Lead>) => void;
}) {
  const toStr = (n?: number | null) =>
    n && Number(n) > 0 ? maskCurrency(String(Math.round(Number(n) * 100))) : "";
  const [total, setTotal] = useState<string>(toStr(lead.budget_total));
  const [client, setClient] = useState<string>(toStr(lead.budget_client));
  const [osv, setOsv] = useState<string>(toStr(lead.budget_osv));

  return (
    <div className="space-y-3 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Total planejado</span>
          <input
            value={total}
            onChange={(e) => setTotal(maskCurrency(e.target.value))}
            placeholder="R$ 0,00"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Trazido pelo cliente</span>
          <input
            value={client}
            onChange={(e) => setClient(maskCurrency(e.target.value))}
            placeholder="R$ 0,00 (opcional)"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Valor OSV</span>
          <input
            value={osv}
            onChange={(e) => setOsv(maskCurrency(e.target.value))}
            placeholder="R$ 0,00 (opcional)"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() =>
            onSave({
              budget_total: parseCurrency(total) || null,
              budget_client: parseCurrency(client) || null,
              budget_osv: parseCurrency(osv) || null,
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function ExpenseForm({
  leadId,
  expense,
  onClose,
  onSaved,
}: {
  leadId: string;
  expense: TripExpense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!expense;
  const [category, setCategory] = useState(expense?.category || "outro");
  const [paidWith, setPaidWith] = useState(expense?.paid_with || "dinheiro");
  const [description, setDescription] = useState(expense?.description || "");
  const [amount, setAmount] = useState(
    expense ? maskCurrency(String(Math.round(Number(expense.amount) * 100))) : "",
  );
  const [savings, setSavings] = useState(
    expense && Number(expense.savings) > 0
      ? maskCurrency(String(Math.round(Number(expense.savings) * 100)))
      : "",
  );
  const [occurredAt, setOccurredAt] = useState(
    expense?.occurred_at || new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  async function submit() {
    const amt = parseCurrency(amount);
    if (!amt || amt <= 0) {
      toast.error("Informe um valor");
      return;
    }
    setSaving(true);
    const payload: Partial<TripExpense> = {
      category,
      paid_with: paidWith,
      description: description.trim() || null,
      amount: amt,
      savings: parseCurrency(savings) || 0,
      occurred_at: occurredAt,
    };
    const res = isEdit
      ? await updateTripExpense(expense!.id, payload)
      : await createTripExpense(leadId, payload);
    setSaving(false);
    if (!res) {
      toast.error("Não foi possível salvar");
      return;
    }
    toast.success(isEdit ? "Gasto atualizado" : "Gasto registrado");
    onSaved();
  }

  return (
    <div className="space-y-3 border-b border-border bg-muted/20 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted-foreground">Categoria</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Forma de pagamento</span>
          <select
            value={paidWith}
            onChange={(e) => setPaidWith(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {PAID_WITH.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Descrição</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Passagem GRU-CDG"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Valor</span>
          <input
            value={amount}
            onChange={(e) => setAmount(maskCurrency(e.target.value))}
            placeholder="R$ 0,00"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Economia</span>
          <input
            value={savings}
            onChange={(e) => setSavings(maskCurrency(e.target.value))}
            placeholder="R$ 0,00 (opcional)"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Data</span>
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isEdit ? "Salvar" : "Registrar"}
        </button>
      </div>
    </div>
  );
}

function BeneficiosTab({
  lead,
  onUpdate,
}: {
  lead: Lead;
  onUpdate: (b: TripBenefits) => void;
}) {
  const initial: TripBenefits = (lead.benefits as TripBenefits) || {};
  const [miles, setMiles] = useState(initial.miles || []);
  const [perks, setPerks] = useState(initial.perks || []);
  const [newProgram, setNewProgram] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newPerkType, setNewPerkType] = useState("");
  const [newPerkDesc, setNewPerkDesc] = useState("");

  function persist(next: TripBenefits) {
    onUpdate(next);
  }

  function addMile() {
    if (!newProgram.trim()) return;
    const updated = [...miles, { program: newProgram.trim(), amount: Number(newAmount) || null, notes: null }];
    setMiles(updated);
    setNewProgram(""); setNewAmount("");
    persist({ miles: updated, perks });
  }
  function removeMile(i: number) {
    const updated = miles.filter((_, idx) => idx !== i);
    setMiles(updated);
    persist({ miles: updated, perks });
  }
  function addPerk() {
    if (!newPerkType.trim()) return;
    const updated = [...perks, { type: newPerkType.trim(), description: newPerkDesc.trim() || null, used: false }];
    setPerks(updated);
    setNewPerkType(""); setNewPerkDesc("");
    persist({ miles, perks: updated });
  }
  function togglePerk(i: number) {
    const updated = perks.map((p, idx) => idx === i ? { ...p, used: !p.used } : p);
    setPerks(updated);
    persist({ miles, perks: updated });
  }
  function removePerk(i: number) {
    const updated = perks.filter((_, idx) => idx !== i);
    setPerks(updated);
    persist({ miles, perks: updated });
  }

  return (
    <div className="space-y-5">
      {/* Milhas */}
      <section className="rounded-xl border border-border">
        <h4 className="border-b border-border px-3 py-2 text-sm font-semibold">
          Milhas & Pontos
        </h4>
        <div className="p-3">
          {miles.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">Nenhum programa adicionado.</p>
          ) : (
            <ul className="mb-3 space-y-2">
              {miles.map((m, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{m.program}</p>
                    {m.amount != null && (
                      <p className="text-xs text-muted-foreground">
                        {Number(m.amount).toLocaleString("pt-BR")} pontos
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeMile(i)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={newProgram}
              onChange={(e) => setNewProgram(e.target.value)}
              placeholder="Programa (ex.: Smiles)"
              className="flex-1 min-w-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="Pontos"
              className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={addMile}
              disabled={!newProgram.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="rounded-xl border border-border">
        <h4 className="border-b border-border px-3 py-2 text-sm font-semibold">
          Cortesias & Sala VIP
        </h4>
        <div className="p-3">
          {perks.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">Nenhuma cortesia registrada.</p>
          ) : (
            <ul className="mb-3 space-y-2">
              {perks.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <button
                    onClick={() => togglePerk(i)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${
                        p.used ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      }`}
                    >
                      {p.used && <Check className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0">
                      <p className={`font-medium ${p.used ? "line-through text-muted-foreground" : ""}`}>
                        {p.type}
                      </p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </div>
                  </button>
                  <button
                    onClick={() => removePerk(i)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={newPerkType}
              onChange={(e) => setNewPerkType(e.target.value)}
              placeholder="Tipo (ex.: Sala VIP GRU)"
              className="flex-1 min-w-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={newPerkDesc}
              onChange={(e) => setNewPerkDesc(e.target.value)}
              placeholder="Descrição (opcional)"
              className="flex-1 min-w-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={addPerk}
              disabled={!newPerkType.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
