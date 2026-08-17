import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ScrollLock } from "@/components/ScrollLock";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, X, UserPlus, User, Plane, Gift, Hotel, ArrowRight, ArrowLeft, Check, Info, MoreVertical, Sparkles, Loader2, CalendarRange, Trash2, ImageIcon, AlertCircle, RefreshCw, Upload, Images, Bot, Map as MapIcon, Save, Archive, ArchiveRestore } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";

import { parseTravelPeriodFn } from "@/lib/ai.functions";
import { downloadDestinationImage } from "@/lib/destination-image.functions";
import { getTripTypes, addTripType } from "@/lib/trip-types.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createLead, deleteLead, fetchLeads, setLeadArchived, updateLead, updateItinerary, fetchItinerariesByLead, fetchLeadItineraryStatuses, fetchAiConfig, searchLibraryImageForDestination, resolveDisplayImageUrl, saveExternalImageToLibrary, uploadImageToLibraryForDestination, fetchLibraryItems, getLibraryAssetUrl, fetchLeadsMinePref, setLeadsMinePref, getMemberId, getMemberRole, fetchTeamMembers } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, maskCurrency, parseCurrency, maskPhone, maskCpfCnpj, maskMiles, initials } from "@/lib/ui";
import type { Itinerary, Lead, LeadStatus, AgencyMember } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/leads")({
  validateSearch: (search: { lead?: unknown }): { lead?: string } =>
    typeof search.lead === "string" ? { lead: search.lead } : {},
  component: LeadsRoute,
});

function LeadsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/leads" ? <LeadsPage /> : <Outlet />;
}

const COLUMNS: { key: LeadStatus; label: string; dot: string }[] = [
  { key: "new", label: "Novo", dot: "bg-blue-500" },
  { key: "contacted", label: "Contatado", dot: "bg-sky-500" },
  { key: "negotiating", label: "Em Negociação", dot: "bg-amber-400" },
  { key: "closed", label: "Fechado", dot: "bg-emerald-500" },
  { key: "lost", label: "Perdido", dot: "bg-red-500" },
];

// Resolve um valor de imagem (URL direto ou caminho do bucket) e renderiza a prévia.
function CoverImage({ value, className, alt }: { value: string; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    resolveDisplayImageUrl(value).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [value]);
  if (!url) return null;
  return <img src={url} alt={alt || "Imagem do destino"} className={className} loading="lazy" />;
}

function LeadsPage() {
  const qc = useQueryClient();
  const { lead: leadParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (leadParam) setDetailId(leadParam);
  }, [leadParam]);

  const { data: minePref } = useQuery({
    queryKey: ["leads-mine-pref"],
    queryFn: fetchLeadsMinePref,
  });
  useEffect(() => {
    if (typeof minePref === "boolean") setOnlyMine(minePref);
  }, [minePref]);

  async function toggleOnlyMine() {
    const next = !onlyMine;
    setOnlyMine(next);
    qc.setQueryData(["leads-mine-pref"], next);
    await setLeadsMinePref(next);
  }

  const { data: allLeads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", { search, archived: showArchived }],
    queryFn: () =>
      fetchLeads({ search: search || undefined, archived: showArchived ? "archived" : "active" }),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const myId = getMemberId();
  const memberRole = getMemberRole();
  const isManager = memberRole === "admin" || memberRole === "gerente";
  const effectiveOnlyMine = isManager ? onlyMine : true;
  const leads = effectiveOnlyMine ? allLeads.filter((l) => l.assigned_to === myId) : allLeads;

  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: fetchTeamMembers,
  });

  const { data: itineraryStatuses = {} } = useQuery({
    queryKey: ["lead-itinerary-statuses"],
    queryFn: fetchLeadItineraryStatuses,
    refetchInterval: 15000,
  });


  // Realtime: novos leads (ex.: criados via webhook do n8n) atualizam a lista.
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_leads" },
        () => {
          qc.invalidateQueries({ queryKey: ["leads"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);


  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const updated = await updateLead(id, { status });
      if (!updated) throw new Error("Não foi possível mover o lead.");
      return updated;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const key = ["leads", { search, archived: showArchived }];
      const prev = qc.getQueryData<Lead[]>(key);
      qc.setQueryData<Lead[]>(key, (old) =>
        (old ?? []).map((l) => (l.id === id ? { ...l, status } : l)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["leads", { search, archived: showArchived }], ctx.prev);
      toast.error("Não foi possível mover o lead.");
    },
    onSuccess: (_res, vars) => {
      dispatchWebhook("lead.status_changed", { id: vars.id, status: vars.status });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const ok = await deleteLead(id);
      if (!ok) throw new Error("Falha ao excluir");
      return id;
    },
    onSuccess: () => {
      toast.success("Venda excluída.");
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Não foi possível excluir a venda."),
  });

  const archiveMut = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const ok = await setLeadArchived(id, archived);
      if (!ok) throw new Error("Falha ao arquivar");
      return archived;
    },
    onSuccess: (archived) => {
      toast.success(archived ? "Venda arquivada." : "Venda desarquivada.");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Não foi possível arquivar a venda."),
  });


  function onDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    setOverCol(null);
    setDragId(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) {
      const current = leads.find((l) => l.id === id);
      if (current && current.status !== status) move.mutate({ id, status });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plane}
        title="Vendas"
        subtitle={showArchived ? "Vendas arquivadas." : "Funil de vendas (arraste para mover)."}
        actions={
          <>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar nome, e-mail, destino…"
              className="w-full sm:w-56"
            />


            {isManager && (
              <button
                onClick={toggleOnlyMine}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition sm:w-auto ${
                  onlyMine
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                <User className="h-4 w-4" /> {onlyMine ? "Minhas vendas" : "Todas as vendas"}
              </button>
            )}
            <button
              onClick={() => setShowArchived((v) => !v)}
              title={showArchived ? "Voltar para vendas ativas" : "Ver vendas arquivadas"}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition sm:w-auto ${
                showArchived ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"
              }`}
            >
              <Archive className="h-4 w-4" /> {showArchived ? "Arquivadas" : "Ver arquivadas"}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Nova Proposta
            </button>
          </>
        }
      />



      {isError ? (
        <QueryError message="Não foi possível carregar os leads." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = leads.filter((l) => l.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overCol !== col.key) setOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
                }}
                onDrop={(e) => onDrop(e, col.key)}
                className="flex flex-col"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="mb-3 h-px bg-border" />
                <div
                  className={`flex-1 space-y-2 rounded-2xl p-1 transition ${
                    overCol === col.key ? "bg-primary/10 ring-2 ring-primary/40" : ""
                  }`}
                >
                  {items.length === 0 ? (
                    <div className="flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-center text-sm font-medium text-primary">
                      {overCol === col.key ? "Solte aqui" : "Nenhum lead nesta etapa"}
                    </div>
                  ) : (
                    items.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        assignee={team.find((m) => m.id === l.assigned_to) || null}
                        itineraryStatus={itineraryStatuses[l.id]}
                        dragging={dragId === l.id}
                        onDragStart={() => setDragId(l.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        onMove={(status) => move.mutate({ id: l.id, status })}
                        onOpen={() => setDetailId(l.id)}
                        archived={showArchived}
                        onToggleArchive={() =>
                          archiveMut.mutate({ id: l.id, archived: !showArchived })
                        }
                        onDelete={() => setConfirmDeleteId(l.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>


      )}

      {open && (
        <NewLeadModal
          allLeads={leads}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}

      {detailId && <LeadDetailDrawer leadId={detailId} onClose={() => { setDetailId(null); if (leadParam) navigate({ search: {}, replace: true }); }} />}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A venda e seus dados vinculados serão removidos
              permanentemente. Se preferir mantê-la no histórico, use "Arquivar venda".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDeleteId) deleteMut.mutate(confirmDeleteId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ITINERARY_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function LeadCard({
  lead,
  assignee,
  itineraryStatus,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
  archived,
  onToggleArchive,
  onDelete,
}: {
  lead: Lead;
  assignee?: AgencyMember | null;
  itineraryStatus?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: LeadStatus) => void;
  onOpen: () => void;
  archived?: boolean;
  onToggleArchive?: () => void;
  onDelete?: () => void;
}) {
  


  const [dragEnabled, setDragEnabled] = useState(true);
  return (
    <div
      draggable={dragEnabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.setData("application/x-lead-id", lead.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab rounded-xl border border-border bg-card p-3 pr-16 shadow-sm transition hover:shadow-md hover:border-primary/40 active:cursor-grabbing ${
        dragging ? "opacity-50 ring-2 ring-primary" : ""
      }`}
    >
      <div
        className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-card/80 p-0.5 shadow-sm backdrop-blur"
        onMouseEnter={() => setDragEnabled(false)}
        onMouseLeave={() => setDragEnabled(true)}
      >
        <button
          type="button"
          aria-label="Ver detalhes do lead"
          title="Ver detalhes"
          draggable={false}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          <Info className="h-4 w-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mover lead"
              title="Mover para outra etapa"
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.filter((c) => c.key !== lead.status).map((c) => (
              <DropdownMenuItem
                key={c.key}
                onSelect={() => onMove(c.key)}
                className="gap-2"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                {c.label}
              </DropdownMenuItem>
            ))}
            {onToggleArchive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onToggleArchive} className="gap-2">
                  {archived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4" /> Desarquivar venda
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" /> Arquivar venda
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Excluir venda
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(() => {
        const cover = (lead.profile as Record<string, string> | undefined)?.cover_image;
        return cover ? (
          <div className="mb-2 -mr-12 overflow-hidden rounded-lg">
            <CoverImage value={cover} alt={lead.destination || "Destino"} className="h-24 w-full object-cover" />
          </div>
        ) : null;
      })()}
      <p className="font-medium">{lead.name}</p>
      <p className="text-xs text-muted-foreground">{lead.destination || "Sem destino"}</p>
      <div className="mt-2 -mr-12 flex flex-col items-start gap-1">
        <p className="text-sm font-semibold text-primary">{formatCurrency(lead.value)}</p>
        {itineraryStatus && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary" title="Roteiro vinculado">
            <MapIcon className="h-3 w-3" /> {ITINERARY_STATUS_LABELS[itineraryStatus] || itineraryStatus}
          </span>
        )}
      </div>

      {assignee && (
        <div className="mt-2 -mr-12 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ backgroundColor: assignee.avatar_color || "#ff7a1a" }}
          >
            {initials(assignee.name)}
          </span>
          <span className="truncate">{assignee.name}</span>
        </div>
      )}
    </div>
  );
}

type WizardForm = {
  name: string;
  email: string;
  phone: string;
  value: string;
  origin: string;
  origin_other: string;
  departure: string;
  destination: string;
  cover_image: string;
  travel_dates: string;
  passengers: string;
  trip_type: string;
  trip_notes: string;
  loyalty_programs: string;
  points_miles: string;
  has_passport: string;
  preferences: string;
  flight_class: string;
  airline_pref: string;
  hotel_category: string;
  room_type: string;
  hotel_notes: string;
};

const EMPTY_FORM: WizardForm = {
  name: "",
  email: "",
  phone: "",
  value: "",
  origin: "",
  origin_other: "",
  departure: "",
  destination: "",
  cover_image: "",
  travel_dates: "",
  passengers: "",
  trip_type: "",
  trip_notes: "",
  loyalty_programs: "",
  points_miles: "",
  has_passport: "",
  preferences: "",
  flight_class: "",
  airline_pref: "",
  hotel_category: "",
  room_type: "",
  hotel_notes: "",
};

const STEPS = [
  { label: "Pessoal", icon: User },
  { label: "Viagem", icon: Plane },
  { label: "Benefícios", icon: Gift },
  { label: "Voos & Hotel", icon: Hotel },
];

const ORIGINS = ["Indicação", "Instagram", "Facebook", "Google", "WhatsApp", "Site", "Outro"];

const DEFAULT_TRIP_TYPES = ["Lazer", "Lua de mel", "Negócios", "Família", "Aventura", "Cruzeiro"];

function normalizeTripType(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Combina os tipos padrão com os personalizados, sem duplicados (ignora caixa/acento/espaços).
function mergeTripTypes(custom: string[]): string[] {
  const out = [...DEFAULT_TRIP_TYPES];
  const seen = new Set(out.map(normalizeTripType));
  for (const t of custom) {
    const n = normalizeTripType(t);
    if (t.trim() && !seen.has(n)) {
      seen.add(n);
      out.push(t.trim());
    }
  }
  return out;
}


const AIRPORTS = [
  "GRU - São Paulo/Guarulhos",
  "CGH - São Paulo/Congonhas",
  "VCP - Campinas/Viracopos",
  "GIG - Rio de Janeiro/Galeão",
  "SDU - Rio de Janeiro/Santos Dumont",
  "BSB - Brasília",
  "CNF - Belo Horizonte/Confins",
  "PLU - Belo Horizonte/Pampulha",
  "CWB - Curitiba",
  "POA - Porto Alegre",
  "FLN - Florianópolis",
  "SSA - Salvador",
  "REC - Recife",
  "FOR - Fortaleza",
  "NAT - Natal",
  "MCZ - Maceió",
  "JPA - João Pessoa",
  "AJU - Aracaju",
  "BEL - Belém",
  "MAO - Manaus",
  "SLZ - São Luís",
  "THE - Teresina",
  "PMW - Palmas",
  "CGB - Cuiabá",
  "CGR - Campo Grande",
  "GYN - Goiânia",
  "VIX - Vitória",
  "IGU - Foz do Iguaçu",
  "NVT - Navegantes",
  "LDB - Londrina",
  "MGF - Maringá",
  "UDI - Uberlândia",
  "RAO - Ribeirão Preto",
  "PVH - Porto Velho",
  "RBR - Rio Branco",
  "BVB - Boa Vista",
  "MCP - Macapá",
  "LIS - Lisboa",
  "OPO - Porto",
  "MAD - Madri",
  "BCN - Barcelona",
  "CDG - Paris/Charles de Gaulle",
  "ORY - Paris/Orly",
  "LHR - Londres/Heathrow",
  "FCO - Roma/Fiumicino",
  "FRA - Frankfurt",
  "AMS - Amsterdã",
  "MIA - Miami",
  "JFK - Nova York/JFK",
  "MCO - Orlando",
  "LAX - Los Angeles",
  "EZE - Buenos Aires/Ezeiza",
  "SCL - Santiago",
  "PTY - Cidade do Panamá",
  "DXB - Dubai",
  "DOH - Doha",
];

const AIRLINES = [
  "LATAM",
  "GOL",
  "Azul",
  "American Airlines",
  "Delta Air Lines",
  "United Airlines",
  "Emirates",
  "Qatar Airways",
  "Air France",
  "KLM",
  "Lufthansa",
  "TAP Air Portugal",
  "Iberia",
  "British Airways",
  "Turkish Airlines",
  "Copa Airlines",
  "Avianca",
  "Aerolíneas Argentinas",
  "Air Canada",
  "Etihad Airways",
];

const LOYALTY_PROGRAMS = [
  "Smiles (GOL)",
  "LATAM Pass",
  "TudoAzul (Azul)",
  "Livelo",
  "Esfera",
  "Latam Pass + Multiplus",
  "American Airlines AAdvantage",
  "Delta SkyMiles",
  "United MileagePlus",
  "Emirates Skywards",
  "TAP Miles&Go",
  "Iberia Plus",
  "Air France-KLM Flying Blue",
];

const PREFERENCE_PRESETS = [
  "Assento na janela",
  "Assento no corredor",
  "Sem escalas",
  "Alimentação vegetariana",
  "Alimentação sem glúten",
  "Acessibilidade / mobilidade reduzida",
  "Viaja com crianças",
  "Viaja com pet",
  "Quarto silencioso",
  "Andar alto",
  "Cama King",
  "Late check-out",
];

function leadToForm(lead: Lead): WizardForm {
  const p = (lead.profile || {}) as Record<string, string>;
  return {
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    value: lead.value ? maskCurrency(String(Math.round(Number(lead.value) * 100))) : "",
    origin: ORIGINS.includes(lead.origin || "") ? lead.origin || "" : lead.origin ? "Outro" : "",
    origin_other: ORIGINS.includes(lead.origin || "") ? "" : lead.origin || "",
    departure: p.departure || "",
    destination: lead.destination || "",
    cover_image: p.cover_image || "",
    travel_dates: p.travel_dates || "",
    passengers: p.passengers || "",
    trip_type: p.trip_type || "",
    trip_notes: p.trip_notes || "",
    loyalty_programs: p.loyalty_programs || "",
    points_miles: p.points_miles || "",
    has_passport: p.has_passport || "",
    preferences: p.preferences || "",
    flight_class: p.flight_class || "",
    airline_pref: p.airline_pref || "",
    hotel_category: p.hotel_category || "",
    room_type: p.room_type || "",
    hotel_notes: p.hotel_notes || "",
  };
}

export function NewLeadModal({
  onClose,
  onCreated,
  onDelete,
  lead,
  allLeads = [],
  linkedItinerary = null,
  initialForm,
  clientId,
}: {
  onClose: () => void;
  onCreated: () => void;
  onDelete?: () => void;
  lead?: Lead;
  allLeads?: Lead[];
  linkedItinerary?: Itinerary | null;
  initialForm?: Partial<WizardForm>;
  clientId?: string;
}) {
  const editing = !!lead;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(
    lead ? leadToForm(lead) : { ...EMPTY_FORM, ...(initialForm || {}) },
  );
  const [saving, setSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const set = (patch: Partial<WizardForm>) => setForm((f) => ({ ...f, ...patch }));

  // Sugestões de leads existentes ao digitar o nome (facilita novo plano p/ mesmo cliente).
  const foldName = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const nameQuery = foldName(form.name);
  const nameSuggestions = editing
    ? []
    : Array.from(new Map(allLeads.map((l) => [`${l.name}|${l.email || ""}`, l])).values())
        .filter((l) => l.name && (!nameQuery || foldName(l.name).includes(nameQuery)))
        .slice(0, 8);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [draftAlerted, setDraftAlerted] = useState(false);
  function selectExistingLead(l: Lead) {
    set({
      name: l.name || "",
      email: l.email || "",
      phone: l.phone || "",
      origin: ORIGINS.includes(l.origin || "") ? l.origin || "" : l.origin ? "Outro" : "",
      origin_other: ORIGINS.includes(l.origin || "") ? "" : l.origin || "",
    });
    setSelectedLeadId(l.id);
    setDraftAlerted(false);
    setNameFocused(false);
  }

  const { data: aiConfig } = useQuery({ queryKey: ["ai-config"], queryFn: fetchAiConfig });
  const aiActive = aiConfig?.knowledge_sources?.status === "connected" && !!aiConfig?.api_key_encrypted;
  const downloadImage = useServerFn(downloadDestinationImage);
  const [searchingImg, setSearchingImg] = useState(false);
  const [triedImages, setTriedImages] = useState<string[]>([]);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Membros do cliente já cadastrado (busca por e-mail) para incluir como passageiros.
  const [clientMembers, setClientMembers] = useState<{ id: string; name: string; relationship: string }[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const email = form.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setClientMembers([]);
      setSelectedMemberIds(new Set());
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("crm_clients")
        .select("preferences")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (!active) return;
      const prefs = data?.preferences;
      const raw = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>).members : null;
      const list = Array.isArray(raw)
        ? raw
            .map((m) => {
              if (!m || typeof m !== "object") return null;
              const o = m as Record<string, unknown>;
              const name = typeof o.name === "string" ? o.name.trim() : "";
              if (!name) return null;
              return {
                id: typeof o.id === "string" && o.id ? o.id : name,
                name,
                relationship: typeof o.relationship === "string" ? o.relationship : "",
              };
            })
            .filter((m): m is { id: string; name: string; relationship: string } => !!m)
        : [];
      setClientMembers(list);
      setSelectedMemberIds(new Set());
    })();
    return () => {
      active = false;
    };
  }, [form.email]);

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      const curr = Math.max(0, parseInt(form.passengers || "0", 10) || 0);
      if (next.has(id)) {
        next.delete(id);
        set({ passengers: String(Math.max(0, curr - 1)) });
      } else {
        next.add(id);
        set({ passengers: String(curr + 1) });
      }
      return next;
    });
  }

  // Busca inteligente de destino (país, estado ou cidade) enquanto digita.
  const [destSuggestions, setDestSuggestions] = useState<string[]>([]);
  const [customTripTypes, setCustomTripTypes] = useState<string[]>([]);
  const tripTypes = mergeTripTypes(customTripTypes);
  const fetchTripTypes = useServerFn(getTripTypes);
  const addTripTypeFn = useServerFn(addTripType);
  useEffect(() => {
    let active = true;
    fetchTripTypes().then((r) => { if (active) setCustomTripTypes(r.types); }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function commitTripType(v: string) {
    const value = v.trim().replace(/\s+/g, " ");
    if (!value || tripTypes.some((t) => normalizeTripType(t) === normalizeTripType(value))) return;
    try {
      const r = await addTripTypeFn({ data: { type: value } });
      setCustomTripTypes(r.types);
    } catch { /* ignora */ }
  }
  useEffect(() => {
    const q = form.destination.trim();
    if (q.length < 2) {
      setDestSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          q,
        )}&count=8&language=pt&format=json`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as {
          results?: { name?: string; admin1?: string; country?: string }[];
        };
        const list = (json.results ?? [])
          .map((r) =>
            [r.name, r.admin1, r.country].filter((p) => p && p.trim()).join(", "),
          )
          .filter((v, i, a) => v && a.indexOf(v) === i);
        setDestSuggestions(list);
      } catch {
        /* ignora aborto/erros de rede */
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [form.destination]);

  function pickFromLibrary(value: string) {
    set({ cover_image: value });
    setPendingImage(null);
    setImgError(null);
    setShowLibraryPicker(false);
    setTriedImages((prev) => [...prev, value]);
    toast.success("Imagem selecionada da biblioteca.");
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dest = form.destination.trim();
    if (!dest) {
      toast.error("Informe o destino antes de enviar a imagem.");
      return;
    }
    setUploadingImg(true);
    setImgError(null);
    try {
      const url = await uploadImageToLibraryForDestination(file, dest);
      set({ cover_image: url });
      setPendingImage(null);
      setTriedImages((prev) => [...prev, url]);
      toast.success("Imagem enviada e salva na biblioteca.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingImg(false);
    }
  }

  async function findDestinationImage() {
    const dest = form.destination.trim();
    if (!dest || !aiActive) return;
    // Só busca na biblioteca na primeira tentativa; depois busca sempre uma nova.
    const wantNew = !!form.cover_image || triedImages.length > 0;
    setSearchingImg(true);
    setImgError(null);
    try {
      if (!wantNew) {
        const fromLibrary = await searchLibraryImageForDestination(dest);
        if (fromLibrary) {
          set({ cover_image: fromLibrary });
          setTriedImages([fromLibrary]);
          toast.success("Imagem encontrada na biblioteca.");
          return;
        }
      }
      // Não salva ainda: mostra a imagem para o usuário confirmar.
      const res = await downloadImage({ data: { destination: dest, exclude: triedImages } });
      if (res?.imageUrl) {
        const imageUrl = res.imageUrl;
        setPendingImage(imageUrl);
        setTriedImages((prev) => [...prev, imageUrl]);
        toast.info("Confirme se deseja usar esta imagem.");
      } else {
        const msg = "Nenhuma imagem encontrada para este destino.";
        setImgError(msg);
        toast.error(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível buscar a imagem.";
      setImgError(msg);
      toast.error(msg);
    } finally {
      setSearchingImg(false);
    }
  }

  // Confirma a imagem pendente: só então baixa e salva na biblioteca.
  async function confirmPendingImage() {
    if (!pendingImage) return;
    setConfirming(true);
    try {
      const saved = await saveExternalImageToLibrary(pendingImage, form.destination.trim());
      set({ cover_image: saved });
      setTriedImages((prev) => [...prev, saved]);
      setPendingImage(null);
      toast.success("Imagem baixada e salva na biblioteca.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a imagem.");
    } finally {
      setConfirming(false);
    }
  }

  // Usuário não gostou: descarta e busca outra automaticamente.
  function rejectPendingImage() {
    setPendingImage(null);
    void findDestinationImage();
  }


  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function validateContact(): boolean {
    if (!form.name.trim()) {
      toast.error("Informe o nome completo.");
      return false;
    }
    const email = form.email.trim();
    if (!email) {
      toast.error("Informe o e-mail.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail válido.");
      return false;
    }
    if (!form.phone.trim()) {
      toast.error("Informe o WhatsApp.");
      return false;
    }
    return true;
  }

  async function next() {
    if (step === 0 && !validateContact()) {
      return;
    }
    // Alerta (não bloqueia) se o lead selecionado já tem roteiro em rascunho.
    // Ignora quando aberto pela edição do modal de detalhes (já verificado lá).
    if (step === 0 && !editing && selectedLeadId && !draftAlerted) {
      setDraftAlerted(true);
      const itineraries = await fetchItinerariesByLead(selectedLeadId);
      if (itineraries.some((it) => it.status === "draft")) {
        toast.warning("Este lead já possui um roteiro em rascunho.");
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!validateContact()) {
      setStep(0);
      return;
    }
    const departure = form.departure.trim();
    if (departure) {
      if (departure.length > 120) {
        toast.error("Ponto de partida muito longo (máx. 120 caracteres).");
        setStep(1);
        return;
      }
      // Aceita sigla-nome (ex.: "GRU - São Paulo/Guarulhos") ou texto livre.
      const validDeparture = /^[\p{L}\p{N}\s./,'()°ºª-]+$/u.test(departure);
      if (!validDeparture) {
        toast.error("Ponto de partida contém caracteres inválidos.");
        setStep(1);
        return;
      }
    }
    if (!form.trip_type.trim()) {
      toast.error("Selecione o Tipo de Viagem.");
      setStep(1);
      return;
    }
    const emailNorm = form.email.trim().toLowerCase();
    if (emailNorm) {
      const dup = allLeads.some(
        (l) => l.id !== lead?.id && (l.email || "").trim().toLowerCase() === emailNorm,
      );
      if (dup) {
        toast.error("Já existe um lead cadastrado com este e-mail.");
        setStep(0);
        return;
      }
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      destination: form.destination || null,
      value: parseCurrency(form.value),
      origin: (form.origin === "Outro" ? form.origin_other.trim() : form.origin) || "direto",
      profile: {
        departure,
        cover_image: form.cover_image || "",
        travel_dates: form.travel_dates,
        passengers: form.passengers,
        trip_type: form.trip_type,
        trip_notes: form.trip_notes,
        loyalty_programs: form.loyalty_programs,
        points_miles: form.points_miles,
        has_passport: form.has_passport,
        preferences: form.preferences,
        flight_class: form.flight_class,
        airline_pref: form.airline_pref,
        hotel_category: form.hotel_category,
        room_type: form.room_type,
        hotel_notes: form.hotel_notes,
      },
    };
    const res = editing
      ? await updateLead(lead!.id, payload)
      : await createLead({ ...payload, status: "new" });

    // Sincroniza o rascunho do roteiro vinculado quando o resumo muda.
    if (res && editing && linkedItinerary) {
      const nextSummary = {
        title: `Roteiro - ${payload.name}`,
        client_name: payload.name,
        destination: payload.destination || "",
        budget: payload.value || 0,
      };
      const changed =
        nextSummary.title !== (linkedItinerary.title || "") ||
        nextSummary.client_name !== (linkedItinerary.client_name || "") ||
        nextSummary.destination !== (linkedItinerary.destination || "") ||
        nextSummary.budget !== (linkedItinerary.budget || 0);
      if (changed) {
        const upd = await updateItinerary(linkedItinerary.id, nextSummary);
        if (upd) toast.success("Rascunho do roteiro atualizado.");
        else toast.error("Erro ao atualizar o rascunho do roteiro.");
      }
    }

    if (res && !editing && clientId) {
      await updateLead(res.id, { client_id: clientId });
    }

    setSaving(false);
    if (res) {
      dispatchWebhook(editing ? "lead.updated" : "lead.created", res);
      toast.success(editing ? "Viajante atualizado!" : "Viajante criado!");
      onCreated();
    } else toast.error(editing ? "Erro ao atualizar viajante." : "Erro ao criar viajante.");
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <ScrollLock />
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-xl">
        <div className="bg-[var(--accent)] px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{editing ? "Editar Proposta" : "Nova Proposta"}</h2>
                <p className="text-xs text-muted-foreground">
                  {editing
                    ? "Revise e atualize todos os dados do cliente"
                    : "Preencha os dados para criar o perfil completo do cliente"}
                </p>

              </div>
            </div>
            <div className="flex items-center gap-2">
              {editing && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  title="Excluir viajante"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="text-destructive h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center">
            {STEPS.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
              <div key={s.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                      done
                        ? "bg-green-500 text-white"
                        : current
                          ? "animate-pulse bg-primary text-primary-foreground ring-4 ring-primary/25"
                          : "bg-card text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${
                      done ? "text-green-600 dark:text-green-400" : current ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 ${i < step ? "bg-green-500" : "bg-border"}`} />
                )}
              </div>
              );
            })}

          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && (
            <Section icon={User} title="Dados de Contato">
              <div className="relative sm:col-span-2">
                <ModalField
                  label="Nome Completo"
                  required
                  placeholder="Ex: Família Santos"
                  value={form.name}
                  onChange={(v) => set({ name: v })}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                  disabled={editing || !!clientId}
                  full
                />
                {!editing && nameFocused && nameSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                    {nameSuggestions.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectExistingLead(l)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{l.name}</span>
                        <span className="text-xs text-muted-foreground">{l.email || l.phone || "Sem contato"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ModalField label="E-mail" type="email" required placeholder="email@exemplo.com" value={form.email} onChange={(v) => set({ email: v })} disabled={!!clientId || (editing && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead?.email?.trim() || ""))} />
              <ModalField label="WhatsApp" format="phone" required placeholder="(11) 99999-9999" value={form.phone} onChange={(v) => set({ phone: v })} />
              <ModalField label="Orçamento Estimado (R$)" format="currency" placeholder="R$ 0,00" value={form.value} onChange={(v) => set({ value: v })} />
              <ModalSelect label="Como nos encontrou?" value={form.origin} onChange={(v) => set({ origin: v })} options={ORIGINS} />
              {form.origin === "Outro" && (
                <ModalField label="Especifique" placeholder="Digite como nos encontrou" value={form.origin_other} onChange={(v) => set({ origin_other: v })} />
              )}
            </Section>
          )}



          {step === 1 && (
            <Section icon={Plane} title="Detalhes da Viagem">
              <ModalField label="Ponto de partida" placeholder="Ex: GRU - São Paulo/Guarulhos" value={form.departure} onChange={(v) => set({ departure: v })} suggestions={AIRPORTS} />
              <ModalField
                label="Destino"
                placeholder="Ex: Paris, França"
                value={form.destination}
                onChange={(v) => set({ destination: v })}
                suggestions={destSuggestions}
                actions={[
                  {
                    icon: Bot,
                    onClick: findDestinationImage,
                    loading: searchingImg,
                    disabled: !form.destination.trim() || !aiActive,
                    title: !aiActive
                      ? "Ative e conecte a IA nas configurações para buscar imagens"
                      : form.cover_image
                        ? "Buscar outra imagem do destino (IA)"
                        : "Buscar imagem do destino (IA)",
                  },
                  {
                    icon: Images,
                    onClick: () => setShowLibraryPicker(true),
                    title: "Escolher da biblioteca de imagens",
                  },
                  {
                    icon: Upload,
                    onClick: () => fileInputRef.current?.click(),
                    loading: uploadingImg,
                    disabled: !form.destination.trim(),
                    title: "Enviar imagem do meu dispositivo",
                  },
                ]}
                hint={form.cover_image ? undefined : aiActive ? undefined : "IA inativa — use a biblioteca ou envie uma imagem"}
                previewImage={form.cover_image || undefined}
                onClearPreview={() => { set({ cover_image: "" }); setPendingImage(null); setTriedImages([]); }}
                pendingImage={pendingImage || undefined}
                confirming={confirming}
                onConfirmPending={confirmPendingImage}
                onRejectPending={rejectPendingImage}
                errorMessage={imgError || undefined}
                onRetry={findDestinationImage}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadImage}
              />
              {showLibraryPicker && (
                <LibraryImagePicker
                  onClose={() => setShowLibraryPicker(false)}
                  onPick={pickFromLibrary}
                />
              )}






              <TravelDatesField value={form.travel_dates} onChange={(v) => set({ travel_dates: v })} />
              <ModalField
                label="Nº de Passageiros"
                type="number"
                placeholder="0"
                value={form.passengers}
                onChange={(v) => {
                  const cleaned = v.replace(/[^\d]/g, "");
                  set({ passengers: cleaned });
                }}
              />
              {clientMembers.length > 0 && (
                <div className="sm:col-span-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
                  <div className="mb-2 text-xs font-semibold text-foreground">
                    Membros do cliente
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Selecione quem também vai viajar para somar ao número de passageiros.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {clientMembers.map((m) => {
                      const active = selectedMemberIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMember(m.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:border-primary/60"
                          }`}
                        >
                          {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          <span>{m.name}</span>
                          {m.relationship && (
                            <span className={active ? "opacity-80" : "text-muted-foreground"}>
                              · {m.relationship}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <ModalField
                label="Tipo de Viagem"
                required
                placeholder="Selecione ou digite um novo tipo"
                value={form.trip_type}
                onChange={(v) => set({ trip_type: v })}
                onCommit={(v) => commitTripType(v)}
                suggestions={tripTypes}
              />
              <ModalTextarea label="Detalhes e Expectativas" placeholder="Ex: Lua de mel, querem praias tranquilas, não gostam de aventura extrema…" value={form.trip_notes} onChange={(v) => set({ trip_notes: v })} />
            </Section>
          )}

          {step === 2 && (
            <Section icon={Gift} title="Benefícios & Fidelidade">
              <ModalField label="Programas de Fidelidade" placeholder="Ex: Smiles, LATAM Pass" value={form.loyalty_programs} onChange={(v) => set({ loyalty_programs: v })} suggestions={LOYALTY_PROGRAMS} />
              <ModalField label="Pontos / Milhas" placeholder="Ex: 80.000" value={form.points_miles} onChange={(v) => set({ points_miles: maskMiles(v) })} />
              <ModalSelect label="Possui Passaporte?" value={form.has_passport} onChange={(v) => set({ has_passport: v })} options={["Sim", "Não", "Vencido"]} />
              <ModalTextarea label="Preferências do cliente" placeholder="Assento, alimentação, acessibilidade…" value={form.preferences} onChange={(v) => set({ preferences: v })} presets={PREFERENCE_PRESETS} />
            </Section>
          )}

          {step === 3 && (
            <Section icon={Hotel} title="Voos & Hotel">
              <ModalSelect label="Classe de Voo" value={form.flight_class} onChange={(v) => set({ flight_class: v })} options={["Econômica", "Premium Economy", "Executiva", "Primeira Classe"]} />
              <ModalField label="Companhia preferida" placeholder="Ex: LATAM, Emirates" value={form.airline_pref} onChange={(v) => set({ airline_pref: v })} suggestions={AIRLINES} />
              <ModalSelect label="Categoria de Hotel" value={form.hotel_category} onChange={(v) => set({ hotel_category: v })} options={["Econômico / 2 estrelas", "3 estrelas", "4 estrelas", "5 estrelas", "Resort", "Boutique", "All Inclusive", "Pousada", "Apart-hotel / Flat", "Hostel", "Hotel Fazenda", "Cassino"]} />
              <ModalSelect label="Tipo de Quarto" value={form.room_type} onChange={(v) => set({ room_type: v })} options={["Standard", "Superior", "Luxo / Deluxe", "Suíte", "Suíte Master", "Suíte Presidencial", "Família", "Quarto Conectado", "Single", "Duplo (Twin)", "Casal (King)", "Quarto Acessível"]} />
              <ModalTextarea label="Observações de hospedagem" placeholder="Vista, café da manhã, localização…" value={form.hotel_notes} onChange={(v) => set({ hotel_notes: v })} />
            </Section>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                className="flex items-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}
            {isLast ? (
              <button
                onClick={submit}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando…" : editing ? "Salvar Alterações" : "Criar Viajante"}
              </button>

            ) : (
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TravelDatesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const rangeMatch = /^(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})$/.exec((value || "").trim());
  const [mode, setMode] = useState<"exatas" | "periodo">(rangeMatch ? "exatas" : "periodo");
  const [startDate, setStartDate] = useState(rangeMatch?.[1] ?? "");
  const [endDate, setEndDate] = useState(rangeMatch?.[2] ?? "");
  const [periodText, setPeriodText] = useState(rangeMatch ? "" : value || "");
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const parseFn = useServerFn(parseTravelPeriodFn);

  function updateExact(s: string, e: string) {
    setStartDate(s);
    setEndDate(e);
    onChange(s && e ? `${s} a ${e}` : "");
  }

  async function interpret() {
    if (!periodText.trim()) {
      toast.error("Digite o período da viagem.");
      return;
    }
    setChecking(true);
    setFeedback(null);
    try {
      const res = await parseFn({ data: { text: periodText } });
      if (res.valid) {
        setStartDate(res.start_date);
        setEndDate(res.end_date);
        onChange(`${res.start_date} a ${res.end_date}`);
        setFeedback({ ok: true, msg: res.message });
      } else {
        onChange("");
        setFeedback({ ok: false, msg: res.message || "O período informado é inválido." });
      }
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : "Erro ao interpretar o período." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className="mb-1 flex h-8 items-center justify-between">
        <span className="text-sm font-semibold">Datas / Período</span>
        <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
          {([
            { key: "exatas", label: "Datas" },
            { key: "periodo", label: "Período" },
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded-full px-3 py-1 transition ${
                mode === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "exatas" ? (
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateExact(e.target.value, endDate)}
            className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
          />
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => updateExact(startDate, e.target.value)}
            className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
          />
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={periodText}
              placeholder="Ex: Jul/2026, 10 dias"
              onChange={(e) => setPeriodText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  interpret();
                }
              }}
              className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
            />
            <button
              type="button"
              onClick={interpret}
              disabled={checking || !periodText.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Apurar
            </button>

          </div>
          {startDate && endDate && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CalendarRange className="h-3.5 w-3.5" />
              {new Date(`${startDate}T00:00:00`).toLocaleDateString("pt-BR")} –{" "}
              {new Date(`${endDate}T00:00:00`).toLocaleDateString("pt-BR")}
            </p>
          )}
          {feedback && (
            <p
              className={`mt-1.5 text-xs ${
                feedback.ok ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {feedback.msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function ModalField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  full,
  format,
  suggestions,
  action,
  actions,
  hint,
  previewImage,
  onClearPreview,
  pendingImage,
  confirming,
  onConfirmPending,
  onRejectPending,
  errorMessage,
  onRetry,
  onCommit,
  onFocus,
  onBlur,
  disabled,

}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  full?: boolean;
  format?: "currency" | "phone" | "cpfcnpj";
  suggestions?: string[];
  action?: {
    icon: typeof User;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    title?: string;
  };
  actions?: {
    icon: typeof User;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    title?: string;
  }[];
  hint?: string;
  previewImage?: string;
  onClearPreview?: () => void;
  pendingImage?: string;
  confirming?: boolean;
  onConfirmPending?: () => void;
  onRejectPending?: () => void;
  errorMessage?: string;
  onRetry?: () => void;
  onCommit?: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  const listId = suggestions ? `dl-${label.replace(/\s+/g, "-")}` : undefined;
  const masks = {
    currency: maskCurrency,
    phone: maskPhone,
    cpfcnpj: maskCpfCnpj,
  } as const;
  const handleChange = (raw: string) => {
    onChange(format ? masks[format](raw) : raw);
  };
  const allActions = actions ?? (action ? [action] : []);
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 flex h-8 items-center text-sm font-semibold">
        {label} {required && <span className="text-primary">*</span>}
      </span>

      <div className="relative">
        <input
          type={format ? "text" : type}
          inputMode={format ? "numeric" : undefined}
          required={required}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          list={listId}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={onFocus}
          onBlur={(e) => { onCommit?.(e.target.value); onBlur?.(); }}
          className="w-full rounded-xl border border-input bg-muted/40 py-3 pl-4 text-sm outline-none focus:border-primary focus:bg-background disabled:cursor-not-allowed disabled:opacity-60"
          style={allActions.length ? { paddingRight: `${allActions.length * 36 + 8}px` } : undefined}
        />
        {allActions.length > 0 && (
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {allActions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled || a.loading}
                  title={a.title}
                  aria-label={a.title || "Ação"}
                  className="grid h-8 w-8 place-items-center rounded-lg text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
                >
                  {a.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {previewImage && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
          <CoverImage value={previewImage} alt="Prévia do destino" className="h-28 w-full object-cover" />
          {onClearPreview && (
            <button
              type="button"
              onClick={onClearPreview}
              title="Remover imagem"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {!previewImage && pendingImage && (
        <div className="mt-2 space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-border">
            <CoverImage value={pendingImage} alt="Prévia do destino" className="h-28 w-full object-cover" />
            {confirming && (
              <div className="absolute inset-0 grid place-items-center bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirmPending}
              disabled={confirming}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Usar esta imagem
            </button>
            <button
              type="button"
              onClick={onRejectPending}
              disabled={confirming}
              title="Buscar outra imagem"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Outra
            </button>
          </div>
        </div>
      )}
      {!previewImage && !pendingImage && errorMessage && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="text-xs text-destructive">{errorMessage}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
              </button>
            )}
          </div>
        </div>
      )}
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </label>
  );
}

// Modal para escolher uma imagem já existente na biblioteca interna.
export function LibraryImagePicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["library", "image"],
    queryFn: () => fetchLibraryItems("image"),
  });
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = term
    ? items.filter(
        (i) =>
          i.title?.toLowerCase().includes(term) ||
          i.location?.toLowerCase().includes(term) ||
          (i.tags || []).some((t) => t.toLowerCase().includes(term)),
      )
    : items;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">Biblioteca de imagens</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-border p-4">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Buscar por destino, título ou tag…"
          />
        </div>


        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma imagem na biblioteca.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {filtered.map((item) => {
                const value = item.image_url || item.file_url;
                if (!value) return null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPick(value)}
                    className="group overflow-hidden rounded-xl border border-border text-left transition hover:border-primary"
                  >
                    <CoverImage value={value} alt={item.title} className="h-24 w-full object-cover" />
                    <p className="truncate px-2 py-1.5 text-xs font-medium">{item.title}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



export function ModalSelect({
  label,
  value,
  onChange,
  options,
  full,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  full?: boolean;
  required?: boolean;
}) {
  // Garante que um valor vindo de outro cadastro (ex.: formulário/n8n) que não
  // esteja na lista padrão continue visível e selecionado no campo.
  const allOptions = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 flex h-8 items-center text-sm font-semibold">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
      >
        <option value="">Selecionar…</option>
        {allOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ModalTextarea({
  label,
  value,
  onChange,
  placeholder,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  presets?: string[];
}) {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const addPreset = (p: string) => {
    if (items.some((i) => i.toLowerCase() === p.toLowerCase())) return;
    onChange([...items, p].join(", "));
  };
  return (
    <label className="block sm:col-span-2">
      <span className="mb-1 flex h-8 items-center text-sm font-semibold">{label}</span>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
      />
      {presets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const active = items.some((i) => i.toLowerCase() === p.toLowerCase());
            return (
              <button
                key={p}
                type="button"
                onClick={() => addPreset(p)}
                disabled={active}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "cursor-default border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {active ? "✓ " : "+ "}
                {p}
              </button>
            );
          })}
        </div>
      )}
    </label>
  );
}

