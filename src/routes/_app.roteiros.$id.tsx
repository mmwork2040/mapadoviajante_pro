import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, ExternalLink, Ticket, FileUp, Loader2, Check, Send, MessageCircle, X, Paperclip, Bot, Eraser, ArrowRight, Plane, BedDouble, MapPin, Car, Utensils, GripVertical, FileText, Download, ChevronDown, Eye, Copy } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  rectIntersection,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  createItineraryActivity,
  createItineraryDay,
  createVoucher,
  deleteItineraryActivity,
  deleteItineraryDay,
  duplicateItineraryDay,
  deleteVoucher,
  fetchItineraryById,
  fetchAiConfig,
  reorderDayActivitiesByTime,
  resolveDisplayImageUrl,
  updateItinerary,
  updateItineraryActivity,
  updateItineraryDay,
} from "@/lib/services";
import { extractDocumentData, extractDocumentActivitiesData, itineraryPlanner } from "@/lib/ai.functions";
import {
  DOCUMENT_CATEGORIES,
  deleteLeadDocument,
  fetchActivityDocuments,
  fetchAgencyDocuments,
  fetchItineraryDocuments,
  attachLibraryDocumentToActivity,
  downloadDocument,
  uploadLeadDocument,
  type LeadDocument,
  type AgencyDocument,
} from "@/lib/lead-documents";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { formatCurrency, maskCurrency, parseCurrency } from "@/lib/ui";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Itinerary, ItineraryDay, Voucher } from "@/lib/types";
import roteiroFallback from "@/assets/roteiro-fallback.jpg";

export const Route = createFileRoute("/_app/roteiros/$id")({
  component: ItineraryDetailPage,
});

const STATUS_OPTIONS = ["draft", "active", "completed", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};
const STATUS_DOTS: Record<string, string> = {
  draft: "bg-muted-foreground",
  active: "bg-sky-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
};

type ActivityType = "flight" | "hotel" | "activity" | "transfer" | "restaurant";

const ACTIVITY_TYPES: {
  type: ActivityType;
  label: string;
  icon: typeof Plane;
  defaultTitle: string;
}[] = [
  { type: "flight", label: "Voo", icon: Plane, defaultTitle: "Novo voo" },
  { type: "hotel", label: "Hospedagem", icon: BedDouble, defaultTitle: "Nova hospedagem" },
  { type: "activity", label: "Atividade", icon: MapPin, defaultTitle: "Nova atividade" },
  { type: "transfer", label: "Transfer", icon: Car, defaultTitle: "Novo transfer" },
  { type: "restaurant", label: "Restaurante", icon: Utensils, defaultTitle: "Refeição" },
];

const TYPE_META: Record<string, { label: string; icon: typeof Plane }> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.type, { label: t.label, icon: t.icon }]),
);

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;

  return closestCenter(args);
};

function PaletteItem({ type, label, icon: Icon }: { type: string; label: string; icon: typeof Plane }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `new:${type}` });
  return (
    <button
      ref={setNodeRef}
      data-palette-item={type}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }}
      className={`flex cursor-grab touch-none items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:border-primary hover:text-primary active:cursor-grabbing ${
        isDragging ? "opacity-80" : ""
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function ItineraryDetailPage() {
  const { id } = useParams({ from: "/_app/roteiros/$id" });
  const qc = useQueryClient();
  
  const [pendingDayId, setPendingDayId] = useState<string | null>(null);
  const [pendingNewDay, setPendingNewDay] = useState(false);
  const { data: it, isLoading, isError, refetch } = useQuery({
    queryKey: ["itinerary", id],
    queryFn: () => fetchItineraryById(id),
  });
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    resolveDisplayImageUrl(it?.cover_image).then((u) => { if (active) setCoverUrl(u); });
    return () => { active = false; };
  }, [it?.cover_image]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["itinerary", id] });

  const confirm = useConfirm();

  const addDay = useMutation({
    mutationFn: () =>
      createItineraryDay({
        itinerary_id: id,
        day_number: (it?.days?.length || 0) + 1,
        title: `Dia ${(it?.days?.length || 0) + 1}`,
        sort_order: (it?.days?.length || 0) + 1,
      }),
    onSuccess: refresh,
    onError: () => toast.error("Erro ao adicionar dia."),
  });

  const clearItinerary = useMutation({
    mutationFn: async () => {
      for (const day of it?.days || []) {
        await deleteItineraryDay(day.id);
      }
    },
    onSuccess: () => {
      toast.success("Roteiro limpo. Comece novamente!");
      refresh();
    },
    onError: () => toast.error("Erro ao limpar o roteiro."),
  });

  const advanceStatus = useMutation({
    mutationFn: async (next: string) => {
      const updated = await updateItinerary(id, { status: next });
      if (!updated) throw new Error("update failed");
      return updated;
    },
    onSuccess: async () => {
      toast.success("Status atualizado!");
      await refresh();
    },
    onError: () => toast.error("Erro ao atualizar o status."),
  });

  async function handleClear() {
    const ok = await confirm({
      title: "Limpar roteiro?",
      description: "Todos os dias e atividades serão removidos para você refazer o roteiro. Esta ação não pode ser desfeita.",
      confirmLabel: "Limpar tudo",
      destructive: true,
    });
    if (ok) clearItinerary.mutate();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const lastOverId = useRef<string | null>(null);
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);

  function getEventPoint(event: Event): { x: number; y: number } | null {
    if ("clientX" in event && "clientY" in event) {
      return { x: Number(event.clientX), y: Number(event.clientY) };
    }
    const touchEvent = event as TouchEvent;
    if ("touches" in event && touchEvent.touches.length > 0) {
      const touch = touchEvent.touches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    if ("changedTouches" in event && touchEvent.changedTouches.length > 0) {
      const touch = touchEvent.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
    return null;
  }

  function getDropIdFromPoint(point: { x: number; y: number } | null): string | null {
    if (!point || typeof document === "undefined") return null;
    const element = document.elementFromPoint(point.x, point.y);
    if (element?.closest<HTMLElement>("[data-add-day]")) return "new-day";
    const activity = element?.closest<HTMLElement>("[data-kanban-activity]");
    if (activity?.dataset.kanbanActivity) return `act:${activity.dataset.kanbanActivity}`;
    const day = element?.closest<HTMLElement>("[data-kanban-day]");
    if (day?.dataset.kanbanDay) return `day:${day.dataset.kanbanDay}`;

    const days = [...document.querySelectorAll<HTMLElement>("[data-kanban-day]")];
    const containingDay = days.find((node) => {
      const rect = node.getBoundingClientRect();
      return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    });
    if (containingDay?.dataset.kanbanDay) return `day:${containingDay.dataset.kanbanDay}`;

    const verticallyAligned = days
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => point.y >= rect.top - 24 && point.y <= rect.bottom + 24)
      .sort(
        (a, b) =>
          Math.min(Math.abs(point.x - a.rect.left), Math.abs(point.x - a.rect.right)) -
          Math.min(Math.abs(point.x - b.rect.left), Math.abs(point.x - b.rect.right)),
      )[0]?.node;
    return verticallyAligned?.dataset.kanbanDay ? `day:${verticallyAligned.dataset.kanbanDay}` : null;
  }

  function handleDragStart(event: DragStartEvent) {
    lastOverId.current = null;
    dragStartPoint.current = getEventPoint(event.activatorEvent);
  }

  function handleDragOver(event: DragOverEvent) {
    const start = dragStartPoint.current;
    const point = start ? { x: start.x + event.delta.x, y: start.y + event.delta.y } : null;
    lastOverId.current = event.over ? String(event.over.id) : getDropIdFromPoint(point) || lastOverId.current;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);
    const start = dragStartPoint.current;
    const point = start ? { x: start.x + event.delta.x, y: start.y + event.delta.y } : null;
    const resolvedOverId = over ? String(over.id) : getDropIdFromPoint(point) || lastOverId.current;
    lastOverId.current = null;
    dragStartPoint.current = null;
    const days = it?.days || [];

    // Drop a palette block onto an empty board OR onto the "Adicionar dia" card:
    // create a new day and place the item in it.
    const wantsNewDay =
      activeId.startsWith("new:") &&
      (resolvedOverId === "new-day" || (!resolvedOverId && days.length === 0));
    if (wantsNewDay) {
      setPendingNewDay(true);
      try {
        const type = activeId.slice(4);
        const meta = ACTIVITY_TYPES.find((t) => t.type === type);
        const nextNumber = days.length + 1;
        const day = await createItineraryDay({
          itinerary_id: id,
          day_number: nextNumber,
          title: `Dia ${nextNumber}`,
          sort_order: nextNumber,
        });
        if (!day) throw new Error("erro");
        await createItineraryActivity({
          day_id: day.id,
          title: meta?.defaultTitle || "Novo item",
          type,
          sort_order: 0,
        });
        refresh();
      } catch {
        toast.error("Não foi possível criar o dia.");
      } finally {
        setPendingNewDay(false);
      }
      return;
    }

    if (!resolvedOverId || resolvedOverId === "new-day") return;
    const overId = resolvedOverId;

    // Resolve target day and insertion index from the drop target.
    let targetDayId: string | null = null;
    let targetIndex = -1;
    if (overId.startsWith("day:")) {
      targetDayId = overId.slice(4);
      const d = days.find((x) => x.id === targetDayId);
      targetIndex = d?.activities?.length ?? 0;
    } else if (overId.startsWith("act:")) {
      const overActId = overId.slice(4);
      const d = days.find((x) => (x.activities || []).some((a) => a.id === overActId));
      if (d) {
        targetDayId = d.id;
        targetIndex = (d.activities || []).findIndex((a) => a.id === overActId);
      }
    }
    if (!targetDayId) return;
    const targetDay = days.find((x) => x.id === targetDayId);
    if (!targetDay) return;

    try {
      // Drop a new block from the palette.
      if (activeId.startsWith("new:")) {
        setPendingDayId(targetDayId);
        try {
          const type = activeId.slice(4);
          const meta = ACTIVITY_TYPES.find((t) => t.type === type);
          const list = [...(targetDay.activities || [])];
          const created = await createItineraryActivity({
            day_id: targetDayId,
            title: meta?.defaultTitle || "Novo item",
            type,
            sort_order: targetIndex,
          });
          if (!created) throw new Error("erro");
          list.splice(Math.max(0, targetIndex), 0, created);
          await Promise.all(
            list.map((a, i) => updateItineraryActivity(a.id, { sort_order: i })),
          );
          refresh();
        } finally {
          setPendingDayId(null);
        }
        return;
      }

      // Move/reorder an existing activity.
      if (activeId.startsWith("act:")) {
        const movingId = activeId.slice(4);
        const sourceDay = days.find((x) => (x.activities || []).some((a) => a.id === movingId));
        if (!sourceDay) return;
        const moving = (sourceDay.activities || []).find((a) => a.id === movingId)!;

        if (sourceDay.id === targetDayId) {
          const list = (targetDay.activities || []).filter((a) => a.id !== movingId);
          list.splice(Math.max(0, targetIndex), 0, moving);
          await Promise.all(list.map((a, i) => updateItineraryActivity(a.id, { sort_order: i })));
        } else {
          const srcList = (sourceDay.activities || []).filter((a) => a.id !== movingId);
          const dstList = [...(targetDay.activities || [])];
          dstList.splice(Math.max(0, targetIndex), 0, moving);
          await updateItineraryActivity(movingId, { day_id: targetDayId });
          await Promise.all([
            ...srcList.map((a, i) => updateItineraryActivity(a.id, { sort_order: i })),
            ...dstList.map((a, i) => updateItineraryActivity(a.id, { sort_order: i })),
          ]);
        }
        refresh();
      }
    } catch {
      toast.error("Não foi possível mover o item.");
    }
  }




  if (isError) return <QueryError message="Não foi possível carregar o roteiro." onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!it) return <p>Roteiro não encontrado.</p>;

  return (
    <div className="space-y-6">
      <Link to="/roteiros" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="relative flex flex-wrap items-start justify-between gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5">
        {(() => {
          const bg = coverUrl || roteiroFallback;
          return (
            <>
              <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
                style={{ backgroundImage: `url(${bg})` }}
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-card/40 to-card/70" aria-hidden />
            </>
          );
        })()}
        <div className="relative">
          <h1 className="text-2xl font-bold">{it.title}</h1>
          <p className="text-sm text-muted-foreground">
            {it.destination} · {it.client_name} · {formatCurrency(it.budget)} · <span>{STATUS_LABELS[it.status || "draft"] || it.status}</span>
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={advanceStatus.isPending}
                className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1.5 pl-3 pr-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOTS[it.status || "draft"] || "bg-muted-foreground"}`} />
                {STATUS_LABELS[it.status || "draft"] || it.status}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem
                  key={s}
                  disabled={advanceStatus.isPending || s === (it.status || "draft")}
                  onSelect={() => advanceStatus.mutate(s)}
                  className={s === (it.status || "draft") ? "font-semibold" : ""}
                >
                  <span className={`mr-2 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOTS[s] || "bg-muted-foreground"}`} />
                  {STATUS_LABELS[s] || s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {it.status === "draft" && (it.days?.length || 0) > 0 && (
            <button
              onClick={handleClear}
              disabled={clearItinerary.isPending}
              className="flex items-center gap-1 rounded-lg border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Eraser className="h-4 w-4" /> Limpar roteiro
            </button>
          )}
          {(() => {
            const canView =
              it.status === "completed" ||
              (it.days || []).some((d) => (d.activities?.length || 0) > 0);
            return canView ? (
              <a
                href={`/viajante/${it.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" /> Ver como viajante
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Adicione e preencha pelo menos um dia para visualizar como viajante"
                className="flex cursor-not-allowed items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium opacity-50"
              >
                <ExternalLink className="h-4 w-4" /> Ver como viajante
              </button>
            );
          })()}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={kanbanCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={() => {
          lastOverId.current = null;
          dragStartPoint.current = null;
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/40 p-3 backdrop-blur">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Arraste para o dia:
          </span>
          {ACTIVITY_TYPES.map((t) => (
            <PaletteItem key={t.type} type={t.type} label={t.label} icon={t.icon} />
          ))}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {(it.days || []).map((day) => (
            <DayCard
              key={day.id}
              day={day}
              allDays={it.days || []}
              onChange={refresh}
              agencyId={it.agency_id}
              leadId={it.lead_id ?? null}
              itineraryId={id}
              pendingActivity={pendingDayId === day.id}
            />
          ))}
          {pendingNewDay && (
            <div className="flex min-h-[24rem] w-[min(20rem,calc(100vw-2rem))] shrink-0 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          )}
          <AddDayDropzone onClick={() => addDay.mutate()} />
        </div>


      </DndContext>


      <VouchersCard itineraryId={id} vouchers={it.vouchers || []} onChange={refresh} />

      <ItineraryChat it={it} onChange={refresh} />
    </div>
  );
}

function AddDayDropzone({ onClick }: { onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "new-day" });
  return (
    <button
      ref={setNodeRef}
      data-add-day="true"
      onClick={onClick}
      className={`flex w-64 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4 text-sm font-medium transition-colors ${
        isOver
          ? "border-primary bg-primary/5 text-primary"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      <Plus className="h-5 w-5" /> Adicionar dia
    </button>
  );
}

function DayCard({
  day,
  allDays,
  onChange,
  agencyId,
  leadId,
  itineraryId,
  pendingActivity = false,
}: {
  day: ItineraryDay;
  allDays: ItineraryDay[];
  onChange: () => void;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
  pendingActivity?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [newType, setNewType] = useState<string>("activity");
  const [dayTitle, setDayTitle] = useState(day.title || `Dia ${day.day_number}`);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractDocumentData);
  const confirm = useConfirm();

  async function addActivity() {
    if (!title.trim()) return;
    try {
      await createItineraryActivity({
        day_id: day.id,
        title,
        type: newType,
        time: time || null,
        location: location || null,
        sort_order: (day.activities?.length || 0) + 1,
      });
      setTitle("");
      setTime("");
      setLocation("");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar atividade.");
    }
  }


  function mapActivityType(t?: string): string {
    const v = (t || "").toLowerCase();
    const allowed = ["flight", "hotel", "activity", "transfer", "restaurant", "note"];
    if (allowed.includes(v)) return v;
    const aliases: Record<string, string> = {
      voo: "flight", voos: "flight", aviao: "flight", passagem: "flight",
      hospedagem: "hotel", hotel: "hotel", pousada: "hotel",
      transfer: "transfer", traslado: "transfer", carro: "transfer", transporte: "transfer",
      restaurante: "restaurant", gastronomia: "restaurant", refeicao: "restaurant",
      ingresso: "activity", passeio: "activity", tour: "activity", parque: "activity",
    };
    return aliases[v] || "activity";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await extract({ data: { fileBase64: base64, mime: file.type } });
      const descParts = [
        data.flight_number && `Voo ${data.flight_number}`,
        data.hotel_name,
        data.room && `Quarto ${data.room}`,
        data.provider,
        data.code && `Localizador ${data.code}`,
        data.people ? `${data.people} pessoa(s)` : "",
        data.description,
      ].filter(Boolean);
      const parsedCost = data.cost != null ? Number(String(data.cost).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) : NaN;
      const created = await createItineraryActivity({
        day_id: day.id,
        title: data.title || data.hotel_name || data.flight_number || "Item importado",
        time: data.time || null,
        duration: data.duration || null,
        location: data.location || null,
        cost: Number.isFinite(parsedCost) ? parsedCost : null,
        description: descParts.join(" · ") || null,
        type: mapActivityType(data.type),
        sort_order: (day.activities?.length || 0) + 1,
      });
      if (!created) throw new Error("Não foi possível salvar a atividade.");
      toast.success("Documento lido — atividade criada!");
      onChange();

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler documento.");
    } finally {
      setExtracting(false);
    }
  }


  async function saveDayTitle() {
    if (dayTitle === (day.title || `Dia ${day.day_number}`)) return;
    await updateItineraryDay(day.id, { title: dayTitle });
    toast.success("Dia atualizado.");
    onChange();
  }

  const [duplicating, setDuplicating] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);
  const sortedDays = [...(allDays || [])].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
  const [dupTarget, setDupTarget] = useState<number>(() => sortedDays.length + 1);

  function openDuplicate() {
    setDupTarget(sortedDays.length + 1);
    setShowDupModal(true);
  }

  async function confirmDuplicate() {
    setShowDupModal(false);
    setDuplicating(true);
    try {
      const copy = await duplicateItineraryDay(day.id, dupTarget);
      if (!copy) throw new Error("erro");
      toast.success("Dia duplicado.");
      onChange();
    } catch {
      toast.error("Não foi possível duplicar o dia.");
    } finally {
      setDuplicating(false);
    }
  }

  async function removeDay() {
    const ok = await confirm({
      title: "Excluir este dia?",
      description: "Todas as atividades deste dia serão removidas. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    await deleteItineraryDay(day.id);
    toast.success("Dia removido.");
    onChange();
  }

  const sorted = [...(day.activities || [])].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999),
  );
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: `day:${day.id}` });

  return (
    <div
      ref={setDroppableRef}
      data-kanban-day={day.id}
      className={`flex min-h-[24rem] w-[min(20rem,calc(100vw-2rem))] shrink-0 flex-col rounded-2xl border border-border bg-card p-5 transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/40" : ""
      }`}
    >

      <div className="mb-3 flex flex-col gap-2">
        <input
          value={dayTitle}
          onChange={(e) => setDayTitle(e.target.value)}
          onBlur={saveDayTitle}
          className="w-full min-w-0 rounded-lg bg-transparent px-2 py-1 font-semibold outline-none hover:bg-muted/50 focus:bg-muted/50"
        />
        <div className="flex items-center gap-1.5">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            title="Enviar documento para a IA preencher"
            aria-label="Importar com IA"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-60"
          >
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          </button>
          <button
            onClick={openDuplicate}
            disabled={duplicating}
            title="Duplicar o dia inteiro"
            aria-label="Duplicar dia"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-60"
          >
            {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={removeDay}
            title="Excluir o dia inteiro"
            aria-label="Excluir dia"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>


      </div>

      <SortableContext items={sorted.map((a) => `act:${a.id}`)} strategy={verticalListSortingStrategy}>
        <ul
          className={`min-h-[8rem] flex-1 space-y-2 rounded-xl p-1 transition-colors ${
            isOver ? "bg-primary/10 ring-2 ring-primary/40" : ""
          }`}
        >
          {sorted.length === 0 && !pendingActivity && (
            <li className="rounded-lg border-2 border-dashed border-border py-4 text-center text-xs text-muted-foreground">
              Arraste Voos, Hospedagem ou Atividades para cá
            </li>
          )}
          {sorted.map((a) => (
            <SortableActivity
              key={a.id}
              activity={a}
              onChange={onChange}
              agencyId={agencyId}
              leadId={leadId}
              itineraryId={itineraryId}
            />
          ))}
          {pendingActivity && (
            <li className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          )}
        </ul>
      </SortableContext>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-28 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
        />


        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Atividade…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={addActivity} className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {showDupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowDupModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Duplicar dia</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Copiando <strong>{dayTitle || `Dia ${day.day_number}`}</strong>. Escolha onde inserir a cópia — os demais dias serão remanejados.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Inserir como</label>
              <select
                value={dupTarget}
                onChange={(e) => setDupTarget(Number(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {sortedDays.map((d, i) => (
                  <option key={d.id} value={i + 1}>
                    Dia {i + 1} — antes de "{d.title || `Dia ${d.day_number}`}"
                  </option>
                ))}
                <option value={sortedDays.length + 1}>
                  Dia {sortedDays.length + 1} — ao final
                </option>
              </select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDupModal(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDuplicate}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Duplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableActivity({
  activity,
  onChange,
  agencyId,
  leadId,
  itineraryId,
}: {
  activity: NonNullable<ItineraryDay["activities"]>[number];
  onChange: () => void;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `act:${activity.id}`,
  });
  return (
    <li
      ref={setNodeRef}
      data-kanban-activity={activity.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-w-0 items-center gap-1 ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        title="Arrastar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <ActivityRow
        activity={activity}
        onChange={onChange}
        agencyId={agencyId}
        leadId={leadId}
        itineraryId={itineraryId}
      />
    </li>
  );
}


function ActivityRow({
  activity,
  onChange,
  agencyId,
  leadId,
  itineraryId,
}: {
  activity: NonNullable<ItineraryDay["activities"]>[number];
  onChange: () => void;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
}) {




  const done = activity.type === "done";

  async function toggleDone() {
    await updateItineraryActivity(activity.id, { type: done ? null : "done" });
    onChange();
  }

  const meta = TYPE_META[activity.type || ""];
  const TypeIcon = meta?.icon;

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <button
            onClick={toggleDone}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              done ? "border-primary bg-primary text-primary-foreground" : "border-input"
            }`}
          >
            {done && <Check className="h-3 w-3" />}
          </button>
          {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0 text-primary" />}
          <span className={done ? "text-muted-foreground line-through" : ""}>
            {activity.time && <strong className="mr-2 text-primary">{activity.time}</strong>}
            {activity.title}
            {activity.location && <span className="ml-2 text-xs text-muted-foreground">· {activity.location}</span>}
          </span>
        </span>
        <span className="flex gap-1">
          <button
            onClick={async () => {
              await deleteItineraryActivity(activity.id);
              onChange();
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      <ActivityDocuments
        activityId={activity.id}
        agencyId={agencyId}
        leadId={leadId}
        itineraryId={itineraryId}
      />
    </div>
  );
}

function ActivityDocuments({
  activityId,
  agencyId,
  leadId,
  itineraryId,
}: {
  activityId: string;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0].value);
  const [uploading, setUploading] = useState(false);
  const [open_, setOpen_] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<LeadDocument | null>(null);
  const { data: docs = [] } = useQuery({
    queryKey: ["activity-docs", activityId],
    queryFn: () => fetchActivityDocuments(activityId),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadLeadDocument({ file, agencyId, leadId, itineraryId, activityId, category });
      toast.success("Documento anexado à biblioteca do lead.");
      qc.invalidateQueries({ queryKey: ["activity-docs", activityId] });
      if (leadId) qc.invalidateQueries({ queryKey: ["lead-docs", leadId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar documento.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLibraryPick(source: LeadDocument) {
    setPickerOpen(false);
    setUploading(true);
    try {
      await attachLibraryDocumentToActivity({ source, agencyId, leadId, itineraryId, activityId });
      toast.success("Documento da biblioteca anexado.");
      qc.invalidateQueries({ queryKey: ["activity-docs", activityId] });
      if (leadId) qc.invalidateQueries({ queryKey: ["lead-docs", leadId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao anexar documento.");
    } finally {
      setUploading(false);
    }
  }

  async function download(doc: LeadDocument) {
    const ok = await downloadDocument(doc);
    if (!ok) toast.error("Não foi possível baixar o documento.");
  }

  async function remove(doc: LeadDocument) {
    const ok = await deleteLeadDocument(doc);
    if (ok) {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["activity-docs", activityId] });
      if (leadId) qc.invalidateQueries({ queryKey: ["lead-docs", leadId] });
    } else {
      toast.error("Erro ao remover documento.");
    }
  }

  return (
    <div className="ml-1">
      <button
        onClick={() => setOpen_((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="h-3 w-3" />
        {docs.length > 0 ? `${docs.length} documento(s)` : "Anexar"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open_ ? "rotate-180" : ""}`} />
      </button>
      {open_ && (
        <div className="mt-1 space-y-1">
          {docs.map((doc) => (
            <div key={doc.id} className="flex w-full min-w-0 items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <button onClick={() => setPreview(doc)} className="flex min-w-0 flex-1 items-center gap-1 text-left hover:underline" title={`Pré-visualizar ${doc.name}`}>
                {doc.category && <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] font-medium uppercase text-primary">{doc.category}</span>}
                <span className="truncate">{doc.name}</span>
              </button>
              <button onClick={() => setPreview(doc)} className="shrink-0 text-muted-foreground hover:text-primary" title="Pré-visualizar">
                <Eye className="h-3 w-3" />
              </button>
              <button onClick={() => download(doc)} className="shrink-0 text-muted-foreground hover:text-primary" title="Baixar">
                <Download className="h-3 w-3" />
              </button>
              <button onClick={() => remove(doc)} className="shrink-0 text-muted-foreground hover:text-destructive" title="Remover">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded border border-input bg-background px-1 py-0.5 text-[11px] outline-none focus:border-primary"
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input ref={fileRef} type="file" onChange={handleFile} className="hidden" accept="image/*,application/pdf" />
            <button
              onClick={() => setPickerOpen(true)}
              disabled={uploading}
              className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
              Anexar
            </button>
          </div>
        </div>
      )}
      {pickerOpen && (
        <AttachSourceModal
          onClose={() => setPickerOpen(false)}
          onDevice={() => {
            setPickerOpen(false);
            fileRef.current?.click();
          }}
          onLibrary={handleLibraryPick}
        />
      )}
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function AttachSourceModal({
  onClose,
  onDevice,
  onLibrary,
}: {
  onClose: () => void;
  onDevice: () => void;
  onLibrary: (doc: LeadDocument) => void;
}) {
  const [view, setView] = useState<"choose" | "library">("choose");
  const [search, setSearch] = useState("");
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["agency-docs"],
    queryFn: () => fetchAgencyDocuments(),
    enabled: view === "library",
  });

  const filtered = (docs as AgencyDocument[]).filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Paperclip className="h-4 w-4 text-primary" />
          <span className="flex-1 text-sm font-semibold">
            {view === "choose" ? "Anexar arquivo" : "Escolher da biblioteca"}
          </span>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {view === "choose" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <button
              onClick={onDevice}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 text-center hover:border-primary hover:bg-muted/40"
            >
              <FileUp className="h-7 w-7 text-primary" />
              <span className="text-sm font-semibold">Do dispositivo</span>
              <span className="text-xs text-muted-foreground">Enviar um arquivo novo</span>
            </button>
            <button
              onClick={() => setView("library")}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 text-center hover:border-primary hover:bg-muted/40"
            >
              <FileText className="h-7 w-7 text-primary" />
              <span className="text-sm font-semibold">Da biblioteca</span>
              <span className="text-xs text-muted-foreground">Reutilizar arquivo existente</span>
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="p-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar documento…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
              {isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</p>
              ) : (
                filtered.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => onLibrary(doc)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:border-primary hover:bg-muted/40"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                    {doc.category && (
                      <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] font-medium uppercase text-primary">{doc.category}</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border p-3">
              <button
                onClick={() => setView("choose")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                ← Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}






function VouchersCard({
  itineraryId,
  vouchers,
  onChange,
}: {
  itineraryId: string;
  vouchers: Voucher[];
  onChange: () => void;
}) {
  const [form, setForm] = useState<Partial<Voucher>>({ type: "hotel" });
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractDocumentData);
  const confirm = useConfirm();

  const VOUCHER_TYPES = ["hotel", "voo", "transfer", "passeio", "ingresso", "carro", "seguro", "outro"];

  function mapType(t?: string): string {
    const v = (t || "").toLowerCase();
    if (VOUCHER_TYPES.includes(v)) return v;
    if (v === "voos") return "voo";
    return "outro";
  }

  async function add() {
    if (!form.title?.trim()) {
      toast.error("Informe um título para o voucher.");
      return;
    }
    const res = await createVoucher({ ...form, itinerary_id: itineraryId });
    if (res) {
      setForm({ type: "hotel" });
      onChange();
    } else toast.error("Erro ao criar voucher.");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await extract({ data: { fileBase64: base64, mime: file.type } });
      const notes = [
        data.hotel_name,
        data.room && `Quarto ${data.room}`,
        data.flight_number && `Voo ${data.flight_number}`,
        data.location,
        data.date,
        data.time,
        data.people ? `${data.people} pessoa(s)` : "",
        data.cost ? `Valor ${formatCurrency(Number(data.cost))}` : "",
        data.description,
      ]
        .filter(Boolean)
        .join(" · ");
      setForm({
        type: mapType(data.type),
        title: data.title || data.hotel_name || data.flight_number || "Voucher importado",
        provider: data.provider || "",
        code: data.code || "",
        notes,
      });
      toast.success("Documento lido — revise e adicione o voucher.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler documento.");
    } finally {
      setExtracting(false);
    }
  }

  async function removeVoucher(v: Voucher) {
    const ok = await confirm({
      title: "Excluir voucher?",
      description: `"${v.title || "Voucher"}" será removido permanentemente.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    await deleteVoucher(v.id);
    onChange();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Ticket className="h-4 w-4" /> Vouchers
        </h2>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={extracting}
          title="Enviar PDF/imagem (ingresso, passagem, hospedagem, reserva de carro) para a IA preencher"
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Importar com IA
        </button>
      </div>
      {vouchers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum voucher.</p>}
      <div className="space-y-4">
        {Object.entries(
          vouchers.reduce<Record<string, Voucher[]>>((acc, v) => {
            const key = (v.type || "outro").toLowerCase();
            (acc[key] ||= []).push(v);
            return acc;
          }, {}),
        ).map(([type, items]) => (
          <div key={type}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="capitalize">{type}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span>
            </h3>
            <ul className="space-y-2">
              {items.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[v.provider, v.code, v.notes || v.details].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <button onClick={() => removeVoucher(v)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={form.type || ""}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-primary"
        >
          {VOUCHER_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.provider || ""} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Fornecedor" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Código/Localizador" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
      </div>
      <button onClick={add} className="mt-3 flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
        <Plus className="h-4 w-4" /> Adicionar voucher
      </button>
    </div>
  );
}


type ChatMsg = { role: "user" | "assistant"; text: string; files?: string[] };
type ActivityDocSummary = Record<string, { count: number; names: string[]; categories: string[] }>;

function ItineraryChat({ it, onChange }: { it: Itinerary; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const greeted = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const plan = useServerFn(itineraryPlanner);

  async function loadActivityDocSummary(): Promise<ActivityDocSummary> {
    const activities = (it.days || []).flatMap((d) => d.activities || []);
    const entries = await Promise.all(
      activities.map(async (a) => {
        const docs = await fetchActivityDocuments(a.id);
        return [
          a.id,
          {
            count: docs.length,
            names: docs.map((doc) => doc.name).filter(Boolean).slice(0, 3),
            categories: [...new Set(docs.map((doc) => doc.category).filter(Boolean) as string[])].slice(0, 3),
          },
        ] as const;
      }),
    );
    return Object.fromEntries(entries.filter(([, docs]) => docs.count > 0));
  }

  function buildGreeting(docSummary: ActivityDocSummary = {}): string {
    const nome = it.client_name || it.lead?.name;
    const parts: string[] = [];
    if (it.destination) parts.push(`destino **${it.destination}**`);
    if (it.start_date || it.end_date)
      parts.push(`datas ${it.start_date || "?"} a ${it.end_date || "?"}`);
    if (it.passengers) parts.push(`${it.passengers} passageiro(s)`);
    if (it.budget) parts.push(`orçamento ${formatCurrency(it.budget)}`);
    const totalDias = it.days?.length || 0;
    const totalAtivs = (it.days || []).reduce((s, d) => s + (d.activities?.length || 0), 0);

    let msg = nome
      ? `Olá! Vamos trabalhar no roteiro de **${nome}**.`
      : "Olá! Vamos trabalhar neste roteiro.";

    if (parts.length) msg += `\n\nJá tenho registrado: ${parts.join(", ")}.`;
    else msg += "\n\nAinda não há dados básicos preenchidos (destino, datas, passageiros).";

    let sugeridos = 0;
    if (it.start_date && it.end_date) {
      const ini = new Date(it.start_date);
      const fim = new Date(it.end_date);
      const diff = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
      if (diff > 0) sugeridos = diff;
    }
    if (sugeridos > 0) {
      const pct = Math.min(100, Math.round((totalDias / sugeridos) * 100));
      const filled = Math.round((pct / 100) * 10);
      const barra = "█".repeat(filled) + "░".repeat(10 - filled);
      msg += `\n\nProgresso: ${totalDias}/${sugeridos} dias  ${barra} ${pct}%`;
    }


    if (totalDias > 0) {
      msg += `\n\nO roteiro tem ${totalDias} dia(s) e ${totalAtivs} atividade(s) montados:`;
      (it.days || []).forEach((d) => {
        const acts = (d.activities || [])
          .map((a) => {
            const doc = docSummary[a.id];
            const label = [a.time, a.title || a.location].filter(Boolean).join(" ");
            return doc?.count ? `${label || "(sem detalhes)"} — ${doc.count} anexo(s)` : label;
          })
          .filter(Boolean);
        const titulo = d.title || `Dia ${d.day_number}`;
        msg += acts.length
          ? `\n- **${titulo}**: ${acts.join("; ")}`
          : `\n- **${titulo}**: (sem atividades)`;
      });
      msg += "\n\nPosso ajustar, sugerir passeios ou completar dias vazios.";

      // Detecta atividades com títulos genéricos/padrão ou sem dados essenciais.
      const genericTitle = (t?: string) => {
        const v = (t || "").trim().toLowerCase();
        if (!v) return true;
        return /^(nova atividade|novo voo|novo vôo|nova hospedagem|novo hotel|novo transfer|novo traslado|novo restaurante|nova refei[çc][ãa]o|nova nota|novo passeio|novo ingresso|atividade|item)$/.test(v);
      };
      const incompletas: string[] = [];
      (it.days || []).forEach((d) => {
        const titulo = d.title || `Dia ${d.day_number}`;
        (d.activities || []).forEach((a) => {
          const faltando: string[] = [];
          if (genericTitle(a.title)) faltando.push("título");
          if (!a.time) faltando.push("horário");
          if (!a.location) faltando.push("local");
          if (faltando.length) {
            const doc = docSummary[a.id];
            const anexos = doc?.count
              ? ` · possui ${doc.count} anexo(s) para interpretar${doc.names.length ? `: ${doc.names.join(", ")}` : ""}`
              : "";
            incompletas.push(`- **${titulo}** → "${a.title || "sem título"}" (falta ${faltando.join(", ")})${anexos}`);
          }
        });
      });
      if (incompletas.length) {
        msg += `\n\n⚠️ Encontrei ${incompletas.length} atividade(s) que parecem incompletas ou com título genérico:\n${incompletas.join("\n")}`;
        const totalDocs = Object.values(docSummary).reduce((sum, doc) => sum + doc.count, 0);
        msg += totalDocs
          ? "\n\nJá identifiquei anexo(s) nessas atividades. Posso interpretar os documentos anexados e sugerir o preenchimento dos dados faltantes."
          : "\n\nEnvie os anexos (passagens, vouchers, ingressos) dessas atividades que eu completo os dados automaticamente, ou me diga os detalhes.";
      }
    } else {
      msg += "\n\nNenhum dia foi montado ainda. Envie passagens/reservas ou me diga o que precisa que eu monto os dias.";
    }


    const faltam: string[] = [];
    if (!it.destination) faltam.push("destino");
    if (!it.start_date && !it.end_date) faltam.push("datas");
    if (!it.passengers) faltam.push("passageiros");
    if (faltam.length) msg += `\n\nPara gerar o roteiro, preciso ainda de: ${faltam.join(", ")}.`;

    return msg;
  }

  useEffect(() => {
    if (open) {
      // A cada abertura, atualiza a percepção da IA: recarrega dias, atividades e anexos.
      greeted.current = true;
      onChange();
      loadActivityDocSummary().then((docSummary) => {
        setMessages([{ role: "assistant", text: buildGreeting(docSummary) }]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Quando os dados do roteiro forem atualizados enquanto o chat está aberto
  // e ainda só há a saudação, reescreve a saudação com os dados frescos.
  useEffect(() => {
    if (open && messages.length <= 1) {
      loadActivityDocSummary().then((docSummary) => {
        setMessages([{ role: "assistant", text: buildGreeting(docSummary) }]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it]);


  function buildContext(): string {
    const dias = (it.days || [])
      .map((d) => {
        const acts = (d.activities || [])
          .map((a) => `  - [id:${a.id}] ${[a.time, a.title, a.location].filter(Boolean).join(" ") || "(sem detalhes)"}`)
          .join("\n");
        return `${d.title || `Dia ${d.day_number}`}\n${acts || "  (sem atividades)"}`;
      })
      .join("\n");
    return `Roteiro: ${it.title}
Destino: ${it.destination || "—"}
Cliente: ${it.client_name || it.lead?.name || "—"}
Datas: ${it.start_date || "—"} a ${it.end_date || "—"}
Quantidade de passageiros: ${it.passengers ?? "—"}
Orçamento: ${formatCurrency(it.budget)}
Dias atuais:
${dias || "(nenhum dia ainda)"}`;
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function mapType(t?: string): string {
    const v = (t || "").toLowerCase();
    const allowed = ["flight", "hotel", "activity", "transfer", "restaurant", "note"];
    if (allowed.includes(v)) return v;
    const aliases: Record<string, string> = {
      voo: "flight", aviao: "flight", passagem: "flight",
      hospedagem: "hotel", pousada: "hotel",
      traslado: "transfer", carro: "transfer", transporte: "transfer",
      restaurante: "restaurant", refeicao: "restaurant",
      ingresso: "activity", passeio: "activity", tour: "activity",
    };
    return aliases[v] || "activity";
  }

  async function send() {
    const text = input.trim();
    if (!text && pending.length === 0) return;
    const fileNames = pending.map((f) => f.name);
    setMessages((m) => [...m, { role: "user", text: text || "(documentos enviados)", files: fileNames }]);
    setInput("");
    setLoading(true);
    try {
      const files = await Promise.all(
        pending.map(async (f) => ({ base64: await fileToBase64(f), mime: f.type, name: f.name })),
      );
      setPending([]);
      const res = await plan({ data: { message: text, context: buildContext(), files, leadId: it.lead_id ?? null, itineraryId: it.id } });

      let createdDays = 0;
      let createdActs = 0;
      const baseCount = it.days?.length || 0;
      for (let i = 0; i < res.days.length; i++) {
        const d = res.days[i];
        const day = await createItineraryDay({
          itinerary_id: it.id,
          day_number: baseCount + i + 1,
          title: d.title || `Dia ${baseCount + i + 1}`,
          date: d.date || null,
          sort_order: baseCount + i + 1,
        });
        if (!day) continue;
        createdDays++;
        for (let j = 0; j < d.activities.length; j++) {
          const a = d.activities[j];
          try {
            await createItineraryActivity({
              day_id: day.id,
              title: a.title,
              time: a.time || null,
              location: a.location || null,
              duration: a.duration || null,
              cost: typeof a.cost === "number" && a.cost > 0 ? a.cost : null,
              description: a.description || null,
              type: mapType(a.type),
              sort_order: j + 1,
            });
            createdActs++;
          } catch {
            /* ignora atividade individual com erro */
          }
        }
      }

      let updatedActs = 0;
      for (const u of res.updates || []) {
        const { activityId, ...fields } = u;
        if (!activityId || Object.keys(fields).length === 0) continue;
        try {
          await updateItineraryActivity(activityId, {
            ...(fields.title !== undefined ? { title: fields.title } : {}),
            ...(fields.time !== undefined ? { time: fields.time || null } : {}),
            ...(fields.location !== undefined ? { location: fields.location || null } : {}),
            ...(fields.duration !== undefined ? { duration: fields.duration || null } : {}),
            ...(fields.description !== undefined ? { description: fields.description || null } : {}),
            ...(fields.type !== undefined ? { type: mapType(fields.type) } : {}),
            ...(fields.cost !== undefined ? { cost: fields.cost && fields.cost > 0 ? fields.cost : null } : {}),
          });
          updatedActs++;
        } catch {
          /* ignora atualização individual com erro */
        }
      }

      const changes: string[] = [];
      if (createdDays > 0) changes.push(`${createdDays} dia(s) e ${createdActs} atividade(s) adicionados`);
      if (updatedActs > 0) changes.push(`${updatedActs} atividade(s) completada(s)`);
      const summary =
        changes.length > 0
          ? `${res.reply}\n\n✓ ${changes.join(" · ")}.`
          : res.reply || "Não encontrei informações suficientes para montar os dias.";
      setMessages((m) => [...m, { role: "assistant", text: summary }]);
      if (createdDays > 0 || updatedActs > 0) onChange();
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: err instanceof Error ? err.message : "Erro ao gerar o roteiro." },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (list.length) setPending((p) => [...p, ...list]);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
        title="Assistente de roteiro"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[32rem] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Assistente de Roteiro</p>
              <p className="text-xs text-muted-foreground">Gera os dias a partir dos seus documentos</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {m.text}
                  {m.files && m.files.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-xs opacity-80">
                      {m.files.map((f, k) => (
                        <div key={k} className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
                </div>
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-border px-3 py-2">
              {pending.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" /> {f.name}
                  <button onClick={() => setPending((p) => p.filter((_, k) => k !== i))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 border-t border-border p-3">
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" onChange={onPick} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              title="Anexar documentos/imagens"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-60"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Peça ajuda ou envie documentos…"
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={send}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

