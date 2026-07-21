import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  User as UserIcon,
  IdCard,
  MapPin,
  StickyNote,
  Sparkles,
  Users,
  Plane,
  Pencil,
  Plus,
  Cake,
  Globe2,
  Trash2,
  MoreVertical,
  Calendar,
  ChevronDown,
  FileText,
  FolderOpen,
  DollarSign,
  ListChecks,
  Activity as ActivityIcon,
  CalendarClock,
  Map as MapIcon,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  fetchClientById,
  fetchLeadsByClient,
  fetchItineraries,
  fetchTripExpenses,
  fetchLeadActivities,
  deleteClient,
  getAgencyId,
  loadAgencyContext,
} from "@/lib/services";
import type {
  Client,
  Itinerary,
  Lead,
  LeadStatus,
  LeadActivity,
  Task,
  TripExpense,
} from "@/lib/types";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { NewLeadModal } from "@/routes/_app.leads";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { extractMembers, type ClientMember } from "@/routes/_app.clientes";
import { ClientFormDrawer, type Tab as ClientTab } from "@/routes/_app.clientes.index";
import { updateClient } from "@/lib/services";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDate, initials } from "@/lib/ui";
import { useResolvedImageUrl } from "@/hooks/useResolvedImageUrl";
import itineraryPlaceholder from "@/assets/itinerary-placeholder.jpg";
import { supabase } from "@/integrations/supabase/client";
import { isImageDoc, isLinkDoc, type LeadDocument } from "@/lib/lead-documents";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: ClientProfilePage,
  head: () => ({
    meta: [
      { title: "Perfil do Viajante" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type HistoryTab =
  | "viagens"
  | "documentos"
  | "financeiro"
  | "tarefas"
  | "timeline"
  | "preferencias"
  | "datas"
  | "destinos"
  | "anotacoes";


const LEAD_STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  contacted: { label: "Contatado", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  negotiating: { label: "Em Negociação", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-300" },
  closed: { label: "Fechado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  lost: { label: "Perdido", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

function normalizeWhatsPhone(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return "";
  return d;
}
function waLink(phone: string | null | undefined, name: string | null | undefined) {
  const p = normalizeWhatsPhone(phone);
  if (!p) return null;
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const text = encodeURIComponent(`Olá, ${first}! Tudo bem?`);
  return `https://wa.me/${p}?text=${text}`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {description && (
          <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ClientProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClientById(id),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["client-trips", id],
    queryFn: () => fetchLeadsByClient(id),
  });

  const tripIds = trips.map((t) => t.id);
  const { data: itineraries = [] } = useQuery({
    queryKey: ["client-itineraries", id, tripIds.join(",")],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const all = await fetchItineraries();
      const set = new Set(tripIds);
      return all.filter((it) => it.lead_id && set.has(it.lead_id));
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", id, tripIds.join(",")],
    queryFn: async () => {
      const ctx = getAgencyId() ?? (await loadAgencyContext())?.agency_id ?? null;
      const client = (
        supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
      ).from("crm_lead_documents");
      const results: LeadDocument[] = [];
      if (tripIds.length > 0) {
        const { data } = await client
          .select("*")
          .in("lead_id", tripIds)
          .order("created_at", { ascending: false });
        if (data) results.push(...(data as unknown as LeadDocument[]));
      }
      if (ctx) {
        const prefix = `${ctx}/client/${id}/`;
        const { data } = await (
          supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
        )
          .from("crm_lead_documents")
          .select("*")
          .is("lead_id", null)
          .eq("agency_id", ctx)
          .like("file_path", `${prefix}%`)
          .order("created_at", { ascending: false });
        if (data) results.push(...(data as unknown as LeadDocument[]));
      }
      return results;
    },
  });


  // Tasks vinculadas às viagens do cliente
  const { data: tasks = [] } = useQuery({
    queryKey: ["client-tasks", id, tripIds.join(",")],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select(
          "*, assigned:agency_members!crm_tasks_assigned_to_fkey(name, avatar_color), lead:crm_leads!crm_tasks_lead_id_fkey(name)",
        )
        .in("lead_id", tripIds)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) return [] as Task[];
      return (data as unknown as Task[]) || [];
    },
  });

  // Atividades/timeline agregadas de todas as viagens
  const { data: activities = [] } = useQuery({
    queryKey: ["client-activities", id, tripIds.join(",")],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(tripIds.map((lid) => fetchLeadActivities(lid)));
      return lists
        .flat()
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    },
  });

  // Despesas agregadas
  const { data: expenses = [] } = useQuery({
    queryKey: ["client-expenses", id, tripIds.join(",")],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(tripIds.map((lid) => fetchTripExpenses(lid)));
      return lists.flat();
    },
  });

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openNewProposal, setOpenNewProposal] = useState(false);
  const [openNewTask, setOpenNewTask] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<ClientTab | undefined>(undefined);
  const [editSaving, setEditSaving] = useState(false);
  const [tab, setTab] = useState<HistoryTab>("viagens");
  const [previewDoc, setPreviewDoc] = useState<LeadDocument | null>(null);


  const delMut = useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clientes" });
    },
  });

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando perfil…</div>;
  }
  if (!client) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        <Link to="/clientes" className="text-sm font-semibold text-primary hover:underline">
          Voltar para clientes
        </Link>
      </div>
    );
  }

  const members = extractMembers(client.preferences);
  const wa = waLink(client.whatsapp, client.name);
  const openEdit = (initialTab?: ClientTab) => {
    setEditTab(initialTab);
    setEditOpen(true);
  };
  const openNew = () => setOpenNewProposal(true);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={UserIcon}
        title={client.name}
        subtitle="Perfil do Viajante — informações reutilizáveis em todas as viagens"
        actions={
          <>
            <Link
              to="/clientes"
              className="flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button
              onClick={() => setOpenNewProposal(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nova proposta
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Mais opções"
                  className="rounded-md border border-input p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => openEdit()}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar cadastro
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={async () => {
                    const ok = await confirm({
                      title: "Remover cliente?",
                      description: `Deseja remover ${client.name}? As viagens vinculadas serão desvinculadas.`,
                      confirmLabel: "Remover",
                      destructive: true,
                    });
                    if (ok) delMut.mutate();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Collapsible icon={UserIcon} title="Contato">
        <div className="space-y-2">
          <InfoRow icon={Mail} label="E-mail">
            {client.email ? (
              <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                {client.email}
              </a>
            ) : "—"}
          </InfoRow>
          <InfoRow icon={Phone} label="Telefone">{client.phone || "—"}</InfoRow>
          <InfoRow icon={MessageCircle} label="WhatsApp">
            {client.whatsapp ? (
              wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {client.whatsapp}
                </a>
              ) : client.whatsapp
            ) : "—"}
          </InfoRow>
          <InfoRow icon={Cake} label="Nascimento">{fmtDate(client.birth_date)}</InfoRow>
        </div>
      </Collapsible>

      <Collapsible icon={IdCard} title="Documentos pessoais">
        <div className="space-y-2">
          <InfoRow label="CPF">{client.cpf || "—"}</InfoRow>
          <InfoRow label="Passaporte">{client.passport_number || "—"}</InfoRow>
          <InfoRow icon={Globe2} label="País emissor">{client.passport_country || "—"}</InfoRow>
          <InfoRow label="Validade">{fmtDate(client.passport_expiry)}</InfoRow>
        </div>
      </Collapsible>

      <Collapsible icon={MapPin} title="Endereço">
        {(() => {
          const line1 = [client.address_street, client.address_number].filter(Boolean).join(", ");
          const line2 = [client.address_neighborhood, client.address_complement].filter(Boolean).join(" • ");
          const line3 = [
            [client.address_city, client.address_state].filter(Boolean).join(" - "),
            client.address_zip,
          ].filter(Boolean).join(" · ");
          const hasAny = line1 || line2 || line3 || client.address_country;
          if (!hasAny) return <p className="text-sm text-muted-foreground">Endereço não cadastrado.</p>;
          return (
            <div className="space-y-1 text-sm">
              {line1 && <div>{line1}</div>}
              {line2 && <div className="text-muted-foreground">{line2}</div>}
              {line3 && <div className="text-muted-foreground">{line3}</div>}
              {client.address_country && <div className="text-muted-foreground">{client.address_country}</div>}
            </div>
          );
        })()}
      </Collapsible>

      <Collapsible icon={Users} title="Membros da viagem" badge={members.length}>
        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum membro cadastrado"
            description="Adicione familiares ou companheiros de viagem no cadastro do cliente."
            actionLabel="Adicionar membros"
            onAction={() => openEdit("membros")}
          />
        ) : (
          <div className="-mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-3 pt-1 scrollbar-thin [-webkit-overflow-scrolling:touch]">
            {members.map((m: ClientMember) => (
              <div
                key={m.id}
                className="flex w-[220px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-background p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[240px]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    {m.relationship && (
                      <div className="truncate text-xs text-muted-foreground">{m.relationship}</div>
                    )}
                  </div>
                </div>
                {m.client_id ? (
                  <Link
                    to="/clientes/$id"
                    params={{ id: m.client_id }}
                    className="mt-auto inline-flex items-center justify-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-semibold text-primary hover:bg-muted"
                  >
                    Abrir perfil
                  </Link>
                ) : (
                  <span className="mt-auto inline-flex items-center justify-center rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    Sem cadastro
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Collapsible>




      {/* Histórico do cliente com múltiplas abas */}
      <Collapsible icon={FolderOpen} title="Histórico do cliente" defaultOpen>
        <div className="mb-3 -mx-1 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain scroll-smooth rounded-lg border border-border bg-muted/40 p-2 pr-3 pt-3 scrollbar-thin [-webkit-overflow-scrolling:touch]">
          <TabPill active={tab === "viagens"} onClick={() => setTab("viagens")} icon={Plane} count={itineraries.length || trips.length}>Viagens</TabPill>
          <TabPill active={tab === "documentos"} onClick={() => setTab("documentos")} icon={FileText} count={documents.length}>Documentos</TabPill>
          <TabPill active={tab === "financeiro"} onClick={() => setTab("financeiro")} icon={DollarSign} count={expenses.length}>Financeiro</TabPill>
          <TabPill active={tab === "tarefas"} onClick={() => setTab("tarefas")} icon={ListChecks} count={tasks.length}>Tarefas</TabPill>
          <TabPill active={tab === "timeline"} onClick={() => setTab("timeline")} icon={ActivityIcon} count={activities.length}>Timeline</TabPill>
          <TabPill active={tab === "destinos"} onClick={() => setTab("destinos")} icon={MapIcon}>Destinos</TabPill>
          <TabPill active={tab === "datas"} onClick={() => setTab("datas")} icon={CalendarClock}>Datas</TabPill>
          <TabPill active={tab === "preferencias"} onClick={() => setTab("preferencias")} icon={Sparkles}>Preferências</TabPill>
          <TabPill active={tab === "anotacoes"} onClick={() => setTab("anotacoes")} icon={StickyNote}>Anotações</TabPill>
        </div>

        <div className="min-h-[360px]">
        {tab === "viagens" && (
          <TripsCarousel itineraries={itineraries} trips={trips} clientId={client.id} onOpenLead={(lid) => setOpenLeadId(lid)} onNew={() => setOpenNewProposal(true)} />
        )}
        {tab === "documentos" && (
          <DocumentsCarousel documents={documents} onPreview={setPreviewDoc} clientId={client.id} onUploaded={() => qc.invalidateQueries({ queryKey: ["client-documents", id] })} />
        )}
        {tab === "financeiro" && <FinanceiroTab trips={trips} expenses={expenses} onNew={openNew} />}
        {tab === "tarefas" && <TarefasTab tasks={tasks} onOpenLead={(lid) => setOpenLeadId(lid)} onNewTask={() => setOpenNewTask(true)} />}
        {tab === "timeline" && <TimelineTab activities={activities} trips={trips} onOpenLead={(lid) => setOpenLeadId(lid)} onNew={openNew} />}
        {tab === "destinos" && <DestinosTab trips={trips} itineraries={itineraries} onNew={openNew} />}
        {tab === "datas" && <DatasTab client={client} onEdit={() => openEdit("contato")} />}
        {tab === "preferencias" && <PreferencesView prefs={client.preferences} onEdit={() => openEdit("preferencias")} />}
        {tab === "anotacoes" && (
          client.notes?.trim() ? (
            <p className="whitespace-pre-wrap text-sm text-foreground">{client.notes}</p>
          ) : (
            <EmptyState
              icon={StickyNote}
              title="Nenhuma anotação registrada"
              description="Anote preferências, restrições ou observações importantes sobre o cliente."
              actionLabel="Adicionar anotação"
              onAction={() => openEdit("notas")}
            />
          )
        )}
        </div>
      </Collapsible>




      {openLeadId && (
        <LeadDetailDrawer
          leadId={openLeadId}
          onClose={() => {
            setOpenLeadId(null);
            qc.invalidateQueries({ queryKey: ["client-trips", id] });
          }}
        />
      )}

      {openNewProposal && (
        <NewLeadModal
          onClose={() => setOpenNewProposal(false)}
          onCreated={() => {
            setOpenNewProposal(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
            qc.invalidateQueries({ queryKey: ["client-trips", id] });
          }}
          clientId={client.id}
          initialForm={{
            name: client.name || "",
            email: client.email || "",
            phone: client.phone || "",
          }}
        />
      )}
      <CreateTaskModal
        open={openNewTask}
        onOpenChange={setOpenNewTask}
        initial={trips[0] ? { leadId: trips[0].id } : null}
      />

      {editOpen && (
        <ClientFormDrawer
          initial={client}
          isEdit
          saving={editSaving}
          initialTab={editTab}
          onClose={() => setEditOpen(false)}
          onSubmit={async (payload) => {
            try {
              setEditSaving(true);
              await updateClient(client.id, payload);
              await qc.invalidateQueries({ queryKey: ["client", id] });
              await qc.invalidateQueries({ queryKey: ["clients"] });
              toast.success("Cliente atualizado");
              setEditOpen(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao salvar");
            } finally {
              setEditSaving(false);
            }
          }}
        />
      )}


      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}

function Collapsible({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof badge === "number" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function TabPill({
  active,
  onClick,
  icon: Icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-[84px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-md px-4 py-2.5 text-xs font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-none">{children}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={`absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-md border px-1 text-[10px] font-bold leading-none shadow-sm ${
            active
              ? "border-primary/30 bg-background text-primary"
              : "border-border bg-primary text-primary-foreground"
          }`}

        >
          {count}
        </span>
      )}
    </button>
  );
}

function TabActionBar({ description, actionLabel, onAction }: { description?: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        {actionLabel}
      </button>
    </div>
  );
}


function TripsCarousel({
  itineraries,
  trips,
  clientId,
  onOpenLead,
  onNew,
}: {
  itineraries: Itinerary[];
  trips: Lead[];
  clientId: string;
  onOpenLead: (id: string) => void;
  onNew: () => void;
}) {
  if (itineraries.length === 0 && trips.length === 0) {
    return (
      <EmptyState
        icon={Plane}
        title="Nenhuma viagem registrada"
        description="Comece uma nova proposta para este cliente e acompanhe todo o pipeline por aqui."
        actionLabel="Nova proposta"
        onAction={onNew}
      />
    );
  }
  if (itineraries.length > 0) {
    return (
      <div>
        <TabActionBar description="Roteiros e propostas vinculadas ao cliente." actionLabel="Nova proposta" onAction={onNew} />
        <div className="-mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-3 pt-1 scrollbar-thin [-webkit-overflow-scrolling:touch]">
        {itineraries.map((it) => (
          <Link
            key={it.id}
            to="/roteiros/$id"
            params={{ id: it.id }}
            search={{ from: `/clientes/${clientId}` } as any}
            className="group flex w-[280px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-background shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[300px]"
          >
            <div className="relative flex w-24 shrink-0 flex-col justify-end overflow-hidden bg-muted/60 p-3">
              {it.cover_image ? (
                <CoverImage value={it.cover_image} alt={it.destination || "Destino"} />
              ) : (
                <img
                  src={itineraryPlaceholder}
                  alt="Destino sem imagem"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="relative flex items-center gap-1 text-xs font-bold text-white">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{it.destination || "—"}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                  {initials(it.client_name || it.title)}
                </span>
                <span className="truncate text-sm font-semibold">{it.client_name || it.title}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {it.start_date ? formatDate(it.start_date) : "—"}
                    {it.end_date ? ` – ${formatDate(it.end_date)}` : ""}
                  </span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {it.passengers || 1} {(it.passengers || 1) > 1 ? "viajantes" : "viajante"}
                </p>
              </div>
            </div>
          </Link>
        ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <TabActionBar description="Propostas e viagens do cliente." actionLabel="Nova proposta" onAction={onNew} />
      <div className="-mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-3 pt-1 scrollbar-thin [-webkit-overflow-scrolling:touch]">
      {trips.map((t) => {
        const meta = LEAD_STATUS_META[t.status] ?? { label: t.status, cls: "bg-muted" };
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenLead(t.id)}
            className="group flex min-h-[120px] w-[240px] shrink-0 snap-start flex-col justify-between gap-2 rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[260px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plane className="h-4 w-4" />
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                {meta.label}
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{t.name || "Viagem sem título"}</div>
              {t.destination && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.destination}</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function DocumentsCarousel({
  documents,
  onPreview,
  clientId,
  onUploaded,
}: {
  documents: LeadDocument[];
  onPreview: (d: LeadDocument) => void;
  clientId: string;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const agencyId = getAgencyId() ?? (await loadAgencyContext())?.agency_id ?? null;
      if (!agencyId) throw new Error("Sem agência ativa.");
      const { uploadLeadDocument } = await import("@/lib/lead-documents");
      for (const file of Array.from(files)) {
        await uploadLeadDocument({ file, agencyId, clientId });
      }
      toast.success(files.length === 1 ? "Arquivo enviado." : `${files.length} arquivos enviados.`);
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Documentos das viagens e arquivos anexados diretamente ao cliente.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" />
          {uploading ? "Enviando..." : "Anexar"}
        </button>
      </div>
      {documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum documento anexado"
          description="Anexe passaporte, vouchers, contratos ou qualquer arquivo enviado pelo cliente."
          actionLabel={uploading ? "Enviando..." : "Anexar arquivo"}
          onAction={() => inputRef.current?.click()}
        />
      ) : (
        <div className="-mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-3 pt-1 scrollbar-thin [-webkit-overflow-scrolling:touch]">
          {documents.map((d) => {
            const link = isLinkDoc(d);
            const img = isImageDoc(d);
            const Icon = link ? Globe2 : img ? FileText : FileText;
            const handleClick = () => {
              if (link) window.open(d.file_path, "_blank", "noopener,noreferrer");
              else onPreview(d);
            };
            return (
              <button
                key={d.id}
                type="button"
                onClick={handleClick}
                className="group flex w-[220px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[240px]"
              >
                <div className="flex h-24 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold" title={d.name}>{d.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {d.category && <span className="rounded bg-muted px-1.5 py-0.5">{d.category}</span>}
                    {d.created_at && <span>{fmtDate(d.created_at)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="min-w-0 text-right text-sm">{children}</div>
    </div>
  );
}

function PreferencesView({ prefs, onEdit }: { prefs: unknown; onEdit?: () => void }) {
  const empty = (
    <EmptyState
      icon={Sparkles}
      title="Nenhuma preferência cadastrada"
      description="Registre companhia aérea preferida, tipo de hospedagem, restrições alimentares e mais."
      actionLabel={onEdit ? "Adicionar preferências" : undefined}
      onAction={onEdit}
    />
  );
  if (!prefs || typeof prefs !== "object") {
    return empty;
  }
  const src = prefs as Record<string, unknown>;
  const { members: _m, ...rest } = src;
  const entries = Object.entries(rest);
  if (entries.length === 0) {
    return empty;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-border bg-background px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 break-words text-sm">
            {typeof v === "string" || typeof v === "number" || typeof v === "boolean"
              ? String(v)
              : (
                <code className="text-xs">{JSON.stringify(v)}</code>
              )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CoverImage({ value, alt }: { value: string; alt?: string }) {
  const { url, failed, onError } = useResolvedImageUrl(value);
  if (!url || failed) return null;
  return (
    <>
      <img
        src={url}
        alt=""
        aria-hidden
        loading="lazy"
        onError={onError}
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-60"
      />
      <img
        src={url}
        alt={alt || "Imagem do destino"}
        loading="lazy"
        onError={onError}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </>
  );
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function FinanceiroTab({ trips, expenses, onNew }: { trips: Lead[]; expenses: TripExpense[]; onNew: () => void }) {
  const totals = useMemo(() => {
    const totalOrcado = trips.reduce((s, t) => s + (t.budget_total || t.value || 0), 0);
    const totalGasto = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalEconomia = expenses.reduce((s, e) => s + (e.savings || 0), 0);
    const closed = trips.filter((t) => t.status === "closed");
    const totalFechado = closed.reduce((s, t) => s + (t.budget_total || t.value || 0), 0);
    const ticket = closed.length > 0 ? totalFechado / closed.length : 0;
    const byMethod: Record<string, number> = {};
    for (const e of expenses) byMethod[e.paid_with] = (byMethod[e.paid_with] || 0) + (e.amount || 0);
    return { totalOrcado, totalGasto, totalEconomia, ticket, closedCount: closed.length, byMethod };
  }, [trips, expenses]);

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="Sem dados financeiros"
        description="Vincule orçamentos e despesas a uma viagem para ver o resumo financeiro do cliente."
        actionLabel="Nova proposta"
        onAction={onNew}
      />
    );
  }
  return (
    <div className="space-y-3">
      <TabActionBar description="Resumo financeiro das viagens do cliente." actionLabel="Nova proposta" onAction={onNew} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Orçado total" value={fmtCurrency(totals.totalOrcado)} />
        <StatCard label="Gasto (viagens)" value={fmtCurrency(totals.totalGasto)} />
        <StatCard label="Economia" value={fmtCurrency(totals.totalEconomia)} />
        <StatCard label={`Ticket médio (${totals.closedCount} fech.)`} value={fmtCurrency(totals.ticket)} />
      </div>
      {Object.keys(totals.byMethod).length > 0 && (
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Por forma de pagamento</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals.byMethod).map(([k, v]) => (
              <span key={k} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                <span className="font-semibold capitalize">{k}</span> · {fmtCurrency(v)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function TarefasTab({ tasks, onOpenLead, onNewTask }: { tasks: Task[]; onOpenLead: (id: string) => void; onNewTask: () => void }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhuma tarefa vinculada"
        description="Crie tarefas nas viagens do cliente ou na página de Tarefas para acompanhá-las aqui."
        actionLabel="Nova tarefa"
        onAction={onNewTask}
        secondaryLabel="Abrir tarefas"
        onSecondary={() => { window.location.assign("/tarefas"); }}
      />
    );
  }
  return (
    <div>
      <TabActionBar description="Tarefas vinculadas às viagens do cliente." actionLabel="Nova tarefa" onAction={onNewTask} />
      <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
          {t.completed ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm font-semibold ${t.completed ? "text-muted-foreground line-through" : ""}`}>{t.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {t.due_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(t.due_date)}</span>}
              {t.priority && <span className="rounded bg-muted px-1.5 py-0.5">{t.priority}</span>}
              {t.lead_id && (
                <button
                  type="button"
                  onClick={() => onOpenLead(t.lead_id as string)}
                  className="text-primary hover:underline"
                >
                  {t.lead?.name || "Abrir viagem"}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
      </ul>
    </div>
  );
}

function TimelineTab({
  activities,
  trips,
  onOpenLead,
  onNew,
}: {
  activities: LeadActivity[];
  trips: Lead[];
  onOpenLead: (id: string) => void;
  onNew: () => void;
}) {
  const tripMap = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const t of trips) m.set(t.id, t);
    return m;
  }, [trips]);
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Sem atividades registradas"
        description="Cada contato, e-mail ou mudança de status nas viagens do cliente aparece aqui."
        actionLabel="Nova proposta"
        onAction={onNew}
      />
    );
  }
  return (
    <div>
      <TabActionBar description="Atividades registradas nas viagens do cliente." actionLabel="Nova proposta" onAction={onNew} />
    <ol className="space-y-2">
      {activities.slice(0, 50).map((a) => {
        const trip = a.lead_id ? tripMap.get(a.lead_id) : null;
        return (
          <li key={a.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{a.title}</div>
                {a.details && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.details}</div>}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(a.created_at)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 capitalize">{a.type}</span>
              {a.author?.name && <span>por {a.author.name}</span>}
              {trip && (
                <button type="button" onClick={() => onOpenLead(trip.id)} className="text-primary hover:underline">
                  {trip.name}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
    </div>
  );
}

function DestinosTab({ trips, itineraries, onNew }: { trips: Lead[]; itineraries: Itinerary[]; onNew: () => void }) {
  const list = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trips) if (t.destination) map.set(t.destination, (map.get(t.destination) || 0) + 1);
    for (const it of itineraries) if (it.destination) map.set(it.destination, (map.get(it.destination) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [trips, itineraries]);
  if (list.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="Nenhum destino registrado"
        description="Assim que houver propostas ou roteiros, os destinos aparecem aqui."
        actionLabel="Nova proposta"
        onAction={onNew}
      />
    );
  }
  return (
    <div>
      <TabActionBar description="Destinos das propostas e roteiros do cliente." actionLabel="Nova proposta" onAction={onNew} />
      <div className="flex flex-wrap gap-2">
      {list.map(([dest, count]) => (
        <span key={dest} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">{dest}</span>
          {count > 1 && <span className="rounded bg-muted px-1 text-[10px] font-bold text-muted-foreground">×{count}</span>}
        </span>
      ))}
      </div>
    </div>
  );
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function DatasTab({ client, onEdit }: { client: Client; onEdit: () => void }) {
  const items: { label: string; date?: string | null; hint?: string }[] = [
    { label: "Aniversário", date: client.birth_date, hint: "Data de nascimento" },
    { label: "Validade do passaporte", date: client.passport_expiry, hint: "Renovação" },
  ];
  const visible = items.filter((i) => i.date);
  if (visible.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nenhuma data importante"
        description="Cadastre data de nascimento e validade do passaporte para receber lembretes."
        actionLabel="Editar cadastro"
        onAction={onEdit}
      />
    );
  }
  return (
    <ul className="space-y-2">
      {visible.map((i) => {
        const d = daysUntil(i.date);
        return (
          <li key={i.label} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
            <div>
              <div className="text-sm font-semibold">{i.label}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.hint}</div>
            </div>
            {typeof d === "number" && (
              <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                d < 0 ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40"
                : d <= 30 ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40"
                : "border-border bg-muted/40 text-muted-foreground"
              }`}>
                {d < 0 ? `há ${Math.abs(d)}d` : d === 0 ? "hoje" : `em ${d}d`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// keep Client type referenced for TS consumers of this file
export type { Client };

