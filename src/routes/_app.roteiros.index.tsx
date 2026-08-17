import { createFileRoute, Link } from "@tanstack/react-router";
import { ScrollLock } from "@/components/ScrollLock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Plus, X, MapPin, Trash2, MoreVertical, Copy, Calendar, Users, Map, Image as ImageIcon, Images, Upload, Bot, Route as RouteIcon, Save, User } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  createItinerary,
  deleteItinerary,
  duplicateItinerary,
  fetchItineraries,
  fetchLeads,
  fetchClientById,
  updateItinerary,
  updateLead,
  fetchAiConfig,
  searchLibraryImageForDestination,
  saveExternalImageToLibrary,
  uploadImageToLibraryForDestination,
  getMemberId,
  getMemberRole,
} from "@/lib/services";
import { extractMembers } from "./_app.clientes";
import { useResolvedImageUrl } from "@/hooks/useResolvedImageUrl";
import { downloadDestinationImage } from "@/lib/destination-image.functions";
import { dispatchWebhook } from "@/lib/webhook";
import { formatDate, maskCurrency, parseCurrency } from "@/lib/ui";
import type { Itinerary } from "@/lib/types";
import itineraryPlaceholder from "@/assets/itinerary-placeholder.jpg";
import { QueryError } from "@/components/QueryError";
import { useConfirm } from "@/components/ConfirmDialog";
import { ModalField, LibraryImagePicker, NewLeadModal } from "./_app.leads";
import { SearchBar } from "@/components/SearchBar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/roteiros/")({
  component: ItinerariesPage,
});


const STATUS_COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: "draft", label: "Rascunho", dot: "bg-slate-400" },
  { key: "active", label: "Em andamento", dot: "bg-blue-500" },
  { key: "completed", label: "Concluído", dot: "bg-emerald-500" },
  { key: "cancelled", label: "Cancelado", dot: "bg-red-500" },
];

function initials(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function CoverImage({ value, alt }: { value: string; className?: string; alt?: string }) {
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
        className="absolute inset-0 h-full w-full object-contain"
      />
    </>
  );
}

function ItinerariesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ leadId: string; tab?: LeadDetailTab } | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const memberRole = getMemberRole();
  const isManager = memberRole === "admin" || memberRole === "gerente";
  const myId = getMemberId();
  const effectiveOnlyMine = isManager ? onlyMine : true;
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["itineraries"],
    queryFn: fetchItineraries,
  });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => fetchLeads() });


  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updated = await updateItinerary(id, { status });
      if (!updated) throw new Error("Não foi possível mover a viagem.");
      return updated;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["itineraries"] });
      const prev = qc.getQueryData<Itinerary[]>(["itineraries"]);
      qc.setQueryData<Itinerary[]>(["itineraries"], (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, status } : it)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["itineraries"], ctx.prev);
      toast.error("Não foi possível mover a viagem.");
    },
    onSuccess: () => {
      toast.success("Viagem movida.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["itineraries"] }),
  });

  function onDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    setOverCol(null);
    setDragId(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (!id) return;
    const current = items.find((it) => it.id === id);
    if (current && current.status !== status) move.mutate({ id, status });
  }


  const scopedItems = effectiveOnlyMine
    ? items.filter((it) => it.lead?.assigned_to === myId)
    : items;

  const filteredItems = search.trim()
    ? scopedItems.filter((it) => {
        const q = search.toLowerCase();
        return (
          (it.title || "").toLowerCase().includes(q) ||
          (it.destination || "").toLowerCase().includes(q) ||
          (it.client_name || "").toLowerCase().includes(q)
        );
      })
    : scopedItems;


  const remove = useMutation({
    mutationFn: (it: Itinerary) => deleteItinerary(it.id),
    onSuccess: (_d, it) => {
      dispatchWebhook("itinerary.deleted", it);
      toast.success("Viagem excluída.");
      qc.invalidateQueries({ queryKey: ["itineraries"] });
    },
    onError: () => toast.error("Erro ao excluir viagem."),
  });

  const duplicate = useMutation({
    mutationFn: (it: Itinerary) => duplicateItinerary(it.id),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao duplicar viagem.");
      toast.success("Viagem duplicada.");
      qc.invalidateQueries({ queryKey: ["itineraries"] });
    },
    onError: () => toast.error("Erro ao duplicar viagem."),
  });

  async function handleDelete(it: Itinerary) {
    const ok = await confirm({
      title: "Excluir viagem",
      description: `Tem certeza que deseja excluir "${it.title}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) remove.mutate(it);
  }

  async function handleDuplicate(it: Itinerary) {
    const ok = await confirm({
      title: "Duplicar viagem",
      description: `Deseja criar uma cópia de "${it.title}"?`,
      confirmLabel: "Duplicar",
    });
    if (ok) duplicate.mutate(it);
  }




  return (
    <div className="space-y-6">
      <PageHeader
        icon={RouteIcon}
        title="Viagens"
        subtitle="Planejamento das viagens (arraste para mover)."
        actions={
          <>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar viagem…"
              className="w-full sm:w-64"
            />
            {isManager && (
              <button
                onClick={() => setOnlyMine((v) => !v)}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition sm:w-auto ${
                  onlyMine
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                <User className="h-4 w-4" /> {onlyMine ? "Minhas viagens" : "Todas as viagens"}
              </button>
            )}
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
        <QueryError message="Não foi possível carregar as viagens." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : scopedItems.length === 0 ? (
        <p className="text-muted-foreground">
          {effectiveOnlyMine && items.length > 0
            ? "Nenhuma viagem atribuída a você."
            : "Nenhuma viagem ainda. Crie a primeira!"}
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma viagem encontrada para “{search}”.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLUMNS.map((col) => {
            const colItems = filteredItems.filter((it) => it.status === col.key);
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
                    {colItems.length}
                  </span>
                </div>
                <div className="mb-3 h-px bg-border" />
                <div
                  className={`flex-1 space-y-2 rounded-2xl p-1 transition ${
                    overCol === col.key ? "bg-primary/10 ring-2 ring-primary/40" : ""
                  }`}
                >
                  {colItems.length === 0 ? (
                    <div className="flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center text-sm font-medium text-primary">
                      {overCol === col.key ? "Solte aqui" : "Sem viagens"}
                    </div>
                  ) : (
                    colItems.map((it) => (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={(e) => {
                          setDragId(it.id);
                          e.dataTransfer.setData("text/plain", it.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        className={`group relative rounded-xl border border-border bg-card transition hover:shadow-md ${
                          dragId === it.id ? "opacity-50 ring-2 ring-primary" : ""
                        }`}
                      >
                        <Link
                          to="/roteiros/$id"
                          params={{ id: it.id }}
                          draggable={false}
                          className="flex overflow-hidden rounded-xl"
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
                          <div className="min-w-0 flex-1 p-3 pr-9">
                            {/(cópia)/i.test(it.title) && (
                              <span className="mb-1 inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <Copy className="h-3 w-3" /> Cópia
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                                {initials(it.client_name || it.title)}
                              </span>
                              <span className="truncate text-sm font-semibold">
                                {it.client_name || it.title}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              <p className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                  {formatDate(it.start_date)}
                                  {it.end_date ? ` – ${formatDate(it.end_date)}` : ""}
                                </span>
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 shrink-0" />
                                {it.passengers || 1}{" "}
                                {(it.passengers || 1) > 1 ? "viajantes" : "viajante"}
                              </p>
                            </div>
                          </div>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              title="Mais opções"
                              className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link to="/roteiros/$id" params={{ id: it.id }}>
                                <RouteIcon className="mr-2 h-4 w-4" /> Abrir
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {STATUS_COLUMNS.filter((s) => s.key !== it.status).map((s) => (
                              <DropdownMenuItem
                                key={s.key}
                                onSelect={() => move.mutate({ id: it.id, status: s.key })}
                              >
                                <span className={`mr-2 h-2 w-2 rounded-full ${s.dot}`} /> Mover para {s.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onSelect={() => handleDuplicate(it)}
                              disabled={duplicate.isPending}
                            >
                              <Copy className="mr-2 h-4 w-4" /> Duplicar viagem
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => handleDelete(it)}
                              disabled={remove.isPending}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="text-destructive mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
            qc.invalidateQueries({ queryKey: ["itineraries"] });
          }}
        />
      )}

    </div>
  );
}
