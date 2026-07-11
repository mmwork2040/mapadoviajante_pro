import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, ExternalLink, Ticket, FileUp, Loader2, Check, Send, MessageCircle, X, Paperclip, Bot, Eraser, ArrowRight, Plane, BedDouble, MapPin, Car, Utensils, GripVertical, FileText, Download, ChevronDown, Eye, Copy, Calendar, Users, MoreVertical, Sparkles, Pencil, Image as ImageIcon, HardDrive, Search } from "lucide-react";
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
  saveActivityImageToLibrary,
  saveImageFileToLibrary,
  findSimilarLibraryImage,
  searchLibraryImageForDestination,
  updateItinerary,
  updateItineraryActivity,
  updateItineraryDay,
} from "@/lib/services";
import { downloadDestinationImage } from "@/lib/destination-image.functions";
import { extractDocumentData, extractDocumentActivitiesData, extractActivitiesFromTextData, itineraryPlanner, analyzeImageActivityFn } from "@/lib/ai.functions";
import { checkDriveConnection, listDriveFiles, fetchDriveFileContent, listDriveSheetNames, previewDriveSheets, isMultiSheet, type DriveFile } from "@/lib/gdrive.functions";

// Origem de um documento a importar: arquivo binário (PDF/imagem) ou texto já
// extraído (ex.: planilhas do Drive varridas por completo).
type DocSource =
  | { kind: "file"; file: File }
  | { kind: "text"; text: string; name: string };

import { getGDriveConfig } from "@/lib/gdrive-config";
import {
  DOCUMENT_CATEGORIES,
  deleteLeadDocument,
  fetchActivityDocuments,
  fetchAgencyDocuments,
  fetchItineraryDocuments,
  deleteItineraryDocuments,
  attachLibraryDocumentToActivity,
  downloadDocument,
  uploadLeadDocument,
  type LeadDocument,
  type AgencyDocument,
} from "@/lib/lead-documents";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { RoteiroPdfExport } from "@/components/RoteiroPdfExport";
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
import type { Itinerary, ItineraryDay, Voucher, ExtractedDocData } from "@/lib/types";
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
  hint: string;
}[] = [
  { type: "flight", label: "Voo", icon: Plane, defaultTitle: "Novo voo", hint: "Adiciona um voo ao dia (horário, número do voo, localizador)." },
  { type: "hotel", label: "Hospedagem", icon: BedDouble, defaultTitle: "Nova hospedagem", hint: "Adiciona uma hospedagem ao dia (hotel, quarto, check-in/out)." },
  { type: "activity", label: "Atividade", icon: MapPin, defaultTitle: "Nova atividade", hint: "Adiciona um passeio, tour ou ingresso ao dia." },
  { type: "transfer", label: "Transfer", icon: Car, defaultTitle: "Novo transfer", hint: "Adiciona um traslado/transporte ao dia." },
  { type: "restaurant", label: "Restaurante", icon: Utensils, defaultTitle: "Refeição", hint: "Adiciona uma refeição/restaurante ao dia." },
];

const TYPE_META: Record<string, { label: string; icon: typeof Plane }> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.type, { label: t.label, icon: t.icon }]),
);
TYPE_META.image = { label: "Imagem", icon: ImageIcon };

function getNextDayNumber(days?: ItineraryDay[]) {
  return Math.max(0, ...(days || []).map((day) => day.day_number || 0)) + 1;
}

function hasActivities(day?: ItineraryDay | null) {
  return (day?.activities?.length || 0) > 0;
}

function normalizeDayTitle(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDayNumber(value?: string | null) {
  const match = normalizeDayTitle(value).match(/\bdia\s*(\d+)\b|\bday\s*(\d+)\b/);
  const raw = match?.[1] || match?.[2];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Reuse an existing day for the AI-generated day at position `index`, or create
 * a new one when there aren't enough. Matches by date first, then by position,
 * so the assistant never duplicates a "Dia 1" that already exists — it renames
 * the existing card if the AI provides a richer title.
 */
async function resolveDayForPlan(params: {
  itineraryId: string;
  existing: ItineraryDay[];
  index: number;
  aiTitle?: string | null;
  aiDate?: string | null;
}): Promise<{ day: ItineraryDay; reused: boolean } | null> {
  const { itineraryId, existing, index, aiTitle, aiDate } = params;
  const sorted = [...existing].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
  let match: ItineraryDay | undefined;
  if (aiDate) match = sorted.find((d) => d.date === aiDate);
  const aiDayNumber = extractDayNumber(aiTitle) ?? index + 1;
  if (!match) match = sorted.find((d) => d.day_number === aiDayNumber);
  if (!match) {
    const aiBaseTitle = normalizeDayTitle(aiTitle).replace(/^dia\s*\d+\s*[-–—:]?\s*/, "");
    match = sorted.find((d) => {
      const dayBaseTitle = normalizeDayTitle(d.title).replace(/^dia\s*\d+\s*[-–—:]?\s*/, "");
      return !!aiBaseTitle && !!dayBaseTitle && aiBaseTitle === dayBaseTitle;
    });
  }
  if (!match) match = sorted[index];

  if (match) {
    const nextTitle = aiTitle?.trim();
    const nextDate = aiDate || match.date || null;
    const updates: Partial<ItineraryDay> = {};
    if (nextTitle && nextTitle !== match.title) updates.title = nextTitle;
    if (nextDate !== match.date) updates.date = nextDate;
    if (Object.keys(updates).length > 0) {
      const updated = await updateItineraryDay(match.id, updates);
      return { day: updated || match, reused: true };
    }
    return { day: match, reused: true };
  }

  const usedNumbers = new Set(sorted.map((d) => d.day_number).filter((n): n is number => typeof n === "number"));
  let dayNumber = aiDayNumber;
  while (usedNumbers.has(dayNumber)) dayNumber += 1;
  const created = await createItineraryDay({
    itinerary_id: itineraryId,
    day_number: dayNumber,
    title: aiTitle?.trim() || `Dia ${dayNumber}`,
    date: aiDate || null,
    sort_order: dayNumber,
  });
  return created ? { day: created, reused: false } : null;
}



// Shared helpers for AI document import.
function mapActivityTypeGlobal(t?: string): string {
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

function parseDocCost(cost: unknown): number | null {
  if (cost == null) return null;
  const n = Number(
    String(cost).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."),
  );
  return Number.isFinite(n) ? n : null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}



const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;

  return closestCenter(args);
};

function PaletteItem({ type, label, icon: Icon, hint }: { type: string; label: string; icon: typeof Plane; hint?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `new:${type}` });
  return (
    <button
      ref={setNodeRef}
      data-palette-item={type}
      title={hint}
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
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const { data: it, isLoading, isError, refetch } = useQuery({
    queryKey: ["itinerary", id],
    queryFn: () => fetchItineraryById(id),
  });
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLoaded, setCoverLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setCoverLoaded(false);
    setCoverUrl(null);
    resolveDisplayImageUrl(it?.cover_image).then((u) => { if (active) setCoverUrl(u); });
    return () => { active = false; };
  }, [it?.cover_image]);


  const refresh = () => qc.invalidateQueries({ queryKey: ["itinerary", id] });

  const confirm = useConfirm();

  // AI document import (drag "Documento" onto a day → AI reads and adds activities).
  const { data: aiConfig } = useQuery({ queryKey: ["ai-config"], queryFn: fetchAiConfig });
  const extractActivities = useServerFn(extractDocumentActivitiesData);
  const extractActivitiesFromText = useServerFn(extractActivitiesFromTextData);

  const docInputRef = useRef<HTMLInputElement>(null);
  const docTargetDayRef = useRef<string | null>(null);

  // Importação a partir do Google Drive (conta compartilhada da agência).
  const [driveOpen, setDriveOpen] = useState(false);
  const [drivePreview, setDrivePreview] = useState<{
    items: ExtractedDocData[];
    source: DocSource;
    name: string;
  } | null>(null);
  // Seleção de abas quando o arquivo do Drive é uma planilha com várias abas.
  const [sheetPick, setSheetPick] = useState<{ file: DriveFile; sheets: string[] } | null>(null);
  // Prévia curta do conteúdo das abas selecionadas antes da extração completa.
  const [sheetPreview, setSheetPreview] = useState<{
    file: DriveFile;
    sheets: string[];
    previews: { sheet: string; preview: string }[];
  } | null>(null);

  const { data: gdriveCfg } = useQuery({ queryKey: ["gdrive-config"], queryFn: getGDriveConfig });
  const driveEnabled = !!gdriveCfg?.enabled;
  const fetchDriveContent = useServerFn(fetchDriveFileContent);
  const listSheetNames = useServerFn(listDriveSheetNames);
  const previewSheets = useServerFn(previewDriveSheets);

  function base64ToFile(base64: string, mime: string, name: string): File {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  }

  async function handleDrivePick(f: DriveFile) {
    setDriveOpen(false);
    const cfg = aiConfig ?? (await fetchAiConfig());
    const connected = !!cfg?.api_key_encrypted && cfg?.knowledge_sources?.status === "connected";
    if (!connected) {
      toast.error("Configure e conecte a IA nas configurações antes de importar documentos.");
      return;
    }
    // Planilhas com várias abas → deixa o usuário escolher quais ler.
    if (isMultiSheet(f.mimeType)) {
      setPendingDayId("__drive__");
      try {
        const { sheets } = await listSheetNames({ data: { fileId: f.id, mimeType: f.mimeType } });
        setPendingDayId(null);
        if (sheets.length > 1) {
          setSheetPick({ file: f, sheets });
          return;
        }
      } catch (err) {
        setPendingDayId(null);
        toast.error(err instanceof Error ? err.message : "Erro ao ler abas da planilha.");
        return;
      }
    }
    await extractFromDrive(f);
  }

  // Baixa e extrai o conteúdo de um arquivo do Drive (com abas opcionais).
  async function extractFromDrive(f: DriveFile, sheets?: string[]) {
    setPendingDayId("__drive__");
    try {
      const res = await fetchDriveContent({
        data: { fileId: f.id, mimeType: f.mimeType, name: f.name, sheets },
      });
      const source: DocSource =
        res.kind === "text"
          ? { kind: "text", text: res.text, name: res.name }
          : { kind: "file", file: base64ToFile(res.base64, res.mime, res.name) };
      const items = await extractDocItems(source);
      setPendingDayId(null);
      if (!items) return;
      // Mostra a prévia do que foi extraído antes de inserir no roteiro.
      setDrivePreview({ items, source, name: f.name });
    } catch (err) {
      setPendingDayId(null);
      toast.error(err instanceof Error ? err.message : "Erro ao baixar arquivo do Drive.");
    }
  }

  function confirmSheetPick(selected: string[]) {
    const pick = sheetPick;
    setSheetPick(null);
    if (!pick || !selected.length) return;
    void extractFromDrive(pick.file, selected);
  }

  async function confirmDrivePreview(selected: ExtractedDocData[]) {
    const preview = drivePreview;
    setDrivePreview(null);
    if (!preview || !selected.length) return;
    await insertDocItems(selected, preview.source, "__new__");
  }



  async function handleDocImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const targetDayId = docTargetDayRef.current;
    docTargetDayRef.current = null;
    if (!file || !targetDayId) return;
    await runDocImport({ kind: "file", file }, targetDayId);
  }


  // Monta um resumo dos dias/itens já no roteiro para a IA evitar conflitos/duplicidades.
  function buildExistingContext(): string {
    return (it?.days || [])
      .slice()
      .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
      .map((d) => {
        const header = `Dia ${d.day_number ?? "?"}${d.date ? ` (${d.date})` : ""}${d.title ? ` - ${d.title}` : ""}`;
        const acts = (d.activities || [])
          .map((a) => `  • ${a.time ? `${a.time} ` : ""}[${a.type || "item"}] ${a.title}${a.location ? ` @ ${a.location}` : ""}`)
          .join("\n");
        return acts ? `${header}\n${acts}` : `${header}\n  (sem itens)`;
      })
      .join("\n");
  }

  // Etapa 1: apenas EXTRAI as atividades do documento (não insere no roteiro).
  async function extractDocItems(source: DocSource): Promise<ExtractedDocData[] | null> {
    const cfg = aiConfig ?? (await fetchAiConfig());
    const connected = !!cfg?.api_key_encrypted && cfg?.knowledge_sources?.status === "connected";
    if (!connected) {
      toast.error("Configure e conecte a IA nas configurações antes de importar documentos.");
      return null;
    }
    const existingContext = buildExistingContext();
    const items: ExtractedDocData[] =
      source.kind === "text"
        ? await extractActivitiesFromText({
            data: { text: source.text, context: existingContext || undefined },
          })
        : await extractActivities({
            data: {
              fileBase64: await fileToBase64(source.file),
              mime: source.file.type,
              context: existingContext || undefined,
            },
          });
    if (!items.length) {
      toast.error("Nenhuma atividade nova encontrada no documento (ou já constava no roteiro).");
      return null;
    }
    return items;
  }

  // Etapa 2: distribui as atividades extraídas nos dias corretos, com deduplicação.
  async function insertDocItems(
    items: ExtractedDocData[],
    source: DocSource,
    targetDayId: string,
  ) {
    const file = source.kind === "file" ? source.file : null;
    let dayId: string | null = targetDayId;

    // Sem dia de destino → reaproveita um dia vazio existente antes de criar outro.
    if (dayId === "__new__") {
      const latest = await fetchItineraryById(id);
      const latestDays = [...(latest?.days || it?.days || [])].sort(
        (a, b) => (a.day_number ?? 0) - (b.day_number ?? 0),
      );
      const emptyDay = latestDays.find((d) => !hasActivities(d));
      if (emptyDay) {
        dayId = emptyDay.id;
      } else {
        const nextNumber = getNextDayNumber(latestDays);
        const newDay = await createItineraryDay({
          itinerary_id: id,
          day_number: nextNumber,
          title: `Dia ${nextNumber}`,
          sort_order: nextNumber,
        });
        if (!newDay) {
          toast.error("Não foi possível criar o dia.");
          return;
        }
        dayId = newDay.id;
      }
      refresh();
    }

    setPendingDayId(dayId);

    try {
      // Block the same document being imported twice into the same day.
      const existingDocs = await fetchItineraryDocuments(id);
      const dayActIds = new Set(
        ((it?.days || []).find((d) => d.id === dayId)?.activities || []).map((a) => a.id),
      );
      const isDuplicate =
        !!file &&
        existingDocs.some(
          (d) => d.name === file.name && d.size === file.size && d.activity_id && dayActIds.has(d.activity_id),
        );
      if (isDuplicate) {
        toast.error("Este documento já foi inserido neste dia.");
        return;
      }

      // Date helpers to fit the extracted items into the right days.
      const isISO = (v?: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const addDays = (iso: string, n: number) => {
        const d = new Date(iso + "T00:00:00");
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };
      const daysBetween = (a: string, b: string) =>
        Math.round(
          (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000,
        );

      const latestItinerary = await fetchItineraryById(id);
      const currentDays = [...(latestItinerary?.days || it?.days || [])].sort(
        (a, b) => (a.day_number ?? 0) - (b.day_number ?? 0),
      );
      const tripStart = latestItinerary?.start_date || it?.start_date || null;
      const tripEnd = latestItinerary?.end_date || it?.end_date || null;
      const anchor = isISO(tripStart) ? tripStart : null;

      const dayDateOf = (d: ItineraryDay, index: number): string | null =>
        isISO(d.date)
          ? d.date
          : anchor
            ? addDays(anchor, (d.day_number ?? index + 1) - 1)
            : null;

      const dateToDayId = new Map<string, string>();
      currentDays.forEach((d, i) => {
        const dd = dayDateOf(d, i);
        if (dd) dateToDayId.set(dd, d.id);
      });

      const isFlightDoc = (x: ExtractedDocData) => {
        const raw = [x.type, x.title, x.description, x.location, x.flight_number]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return /\b(voo|voos|flight|passagem|embarque|boarding|avi[aã]o)\b/.test(raw);
      };
      const isOutbound = (x: ExtractedDocData) =>
        /\b(ida|outbound|sa[ií]da|departure)\b/i.test([x.title, x.description].filter(Boolean).join(" "));
      const isReturn = (x: ExtractedDocData) =>
        /\b(volta|retorno|return|regresso)\b/i.test([x.title, x.description].filter(Boolean).join(" "));
      const flightItems = items.filter(isFlightDoc);
      const hasRoundTrip = flightItems.some(isOutbound) && flightItems.some(isReturn);

      if (flightItems.length) {
        const canUseTripBounds = isISO(tripStart) && isISO(tripEnd);
        if (canUseTripBounds) {
          const startDate = tripStart as string;
          const endDate = tripEnd as string;
          for (const item of flightItems) {
            if (!isISO(item.date) || (hasRoundTrip && item.date === flightItems[0]?.date && startDate !== endDate)) {
              if (isOutbound(item)) item.date = startDate;
              else if (isReturn(item)) item.date = endDate;
            }
          }
        }
        const refreshedDates = flightItems.map((x) => x.date).filter(isISO);
        const missingDate = flightItems.some((x) => !isISO(x.date));
        const collapsedRoundTrip =
          hasRoundTrip && new Set(refreshedDates).size < 2 && !(isISO(tripStart) && tripStart === tripEnd);
        if (missingDate || collapsedRoundTrip) {
          toast.error(
            "Não consegui identificar datas confiáveis de ida e volta no cartão. Informe o período da viagem ou envie um documento com as datas visíveis.",
          );
          return;
        }
      }

      // Ordena os itens cronologicamente antes de inserir: primeiro por DATA,
      // depois por HORÁRIO. Quando não há horário, estima um horário lógico pelo
      // tipo/nome do item (ex.: transfer/voo cedo, refeições no horário da
      // refeição, check-in de hotel ao fim do dia) para manter a sequência do dia.
      const timeToMin = (t?: string | null): number | null => {
        const m = (t || "").match(/^(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      };
      const logicalMinutes = (x: ExtractedDocData): number => {
        const t = timeToMin(x.time);
        if (t != null) return t;
        const raw = [x.type, x.title, x.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const mapped = mapActivityTypeGlobal(x.type);
        if (/\b(voo|voos|flight|transfer|traslado|embarque|check-?in aeroporto)\b/.test(raw)) return 6 * 60;
        if (/\b(caf[eé]|breakfast|manh[aã])\b/.test(raw)) return 8 * 60;
        if (/\b(almo[çc]o|lunch)\b/.test(raw)) return 12 * 60;
        if (/\b(jantar|dinner|noite)\b/.test(raw)) return 20 * 60;
        if (mapped === "restaurant") return 13 * 60;
        if (mapped === "activity" || /\b(passeio|tour|visita|ingresso|city)\b/.test(raw)) return 15 * 60;
        if (mapped === "hotel") return 22 * 60; // check-in normalmente no fim do dia
        return 12 * 60; // meio do dia por padrão
      };
      items = items
        .map((x, i) => ({ x, i }))
        .sort((a, b) => {
          const da = isISO(a.x.date) ? a.x.date! : "\uffff";
          const db = isISO(b.x.date) ? b.x.date! : "\uffff";
          if (da !== db) return da < db ? -1 : 1;
          const ma = logicalMinutes(a.x);
          const mb = logicalMinutes(b.x);
          if (ma !== mb) return ma - mb;
          return a.i - b.i; // estável
        })
        .map((e) => e.x);

      const itemDates = items.map((x) => x.date).filter(isISO);

      if (itemDates.length && (anchor || isISO(tripEnd))) {
        const hi = isISO(tripEnd) ? tripEnd : null;
        const outside = itemDates.some((d) => (anchor && d < anchor) || (hi && d > hi));
        if (outside) {
          toast.warning(
            "Datas do documento fora do período informado no cadastro da viagem. Confira as datas.",
          );
        }
      }

      if (itemDates.length) {
        const candidates = [
          ...itemDates,
          ...(anchor ? [anchor] : []),
          ...(isISO(tripEnd) ? [tripEnd] : []),
          ...currentDays.map((d, i) => dayDateOf(d, i)).filter(isISO),
        ].sort();
        const rangeStart = candidates[0];
        const rangeEnd = candidates[candidates.length - 1];
        if (isISO(rangeStart) && isISO(rangeEnd) && daysBetween(rangeStart, rangeEnd) >= 0) {
          for (let i = 0; i < currentDays.length; i++) {
            const d = currentDays[i];
            if (!isISO(d.date)) {
              const computed = anchor
                ? addDays(anchor, (d.day_number ?? i + 1) - 1)
                : addDays(rangeStart, i);
              await updateItineraryDay(d.id, { date: computed });
              if (!dateToDayId.has(computed)) dateToDayId.set(computed, d.id);
            }
          }
          let dayNum = Math.max(0, ...currentDays.map((d) => d.day_number || 0));
          for (let off = 0; off <= daysBetween(rangeStart, rangeEnd); off++) {
            const dateAt = addDays(rangeStart, off);
            if (!dateToDayId.has(dateAt)) {
              dayNum++;
              const created = await createItineraryDay({
                itinerary_id: id,
                day_number: dayNum,
                title: `Dia ${dayNum}`,
                date: dateAt,
                sort_order: dayNum,
              });
              if (created) dateToDayId.set(dateAt, created.id);
            }
          }
        }
      }

      // Deduplicação: chave exata (dia|título|hora) + chave semântica por tipo/nome
      // para não repetir restaurantes, hospedagens e passeios parecidos.
      const norm = (s?: string | null) => (s || "").trim().toLowerCase();
      const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const NOISE =
        /\b(hotel|hoteis|pousada|resort|hostel|restaurante|restaurant|bar|cafe|tour|passeio|visita|city|ingresso|reserva|almoco|jantar|transfer|traslado|transporte|hospedagem|the|de|da|do|das|dos|e|o|a)\b/g;
      const canon = (s?: string | null) =>
        stripAccents(norm(s))
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(NOISE, " ")
          .replace(/\s+/g, " ")
          .trim();
      const DEDUP_TYPES = new Set(["hotel", "restaurant", "activity", "transfer"]);
      const semanticKey = (type: string, name?: string | null, loc?: string | null) => {
        const base = canon(name) || canon(loc);
        return base && base.length >= 3 ? `${type}|${base}` : "";
      };

      const existingKeys = new Set<string>();
      const semanticSet = new Set<string>();
      for (const d of it?.days || []) {
        for (const a of d.activities || []) {
          existingKeys.add(`${d.id}|${norm(a.title)}|${norm(a.time)}`);
          const t = mapActivityTypeGlobal(a.type || undefined);
          const k = semanticKey(t, a.title, a.location);
          if (k) semanticSet.add(k);
        }
      }

      const orderByDay = new Map<string, number>();
      const usedDayIds = new Set<string>();
      let firstActivityId: string | null = null;
      let skipped = 0;
      for (const data of items) {
        const targetId = (isISO(data.date) && dateToDayId.get(data.date)) || dayId;
        const title = data.title || data.hotel_name || data.flight_number || "Item importado";
        const mappedType = mapActivityTypeGlobal(data.type);
        const dupKey = `${targetId}|${norm(title)}|${norm(data.time)}`;
        const semKey = DEDUP_TYPES.has(mappedType)
          ? semanticKey(mappedType, data.title || data.hotel_name, data.location)
          : "";
        if (existingKeys.has(dupKey) || (semKey && semanticSet.has(semKey))) {
          skipped++;
          continue;
        }
        existingKeys.add(dupKey);
        if (semKey) semanticSet.add(semKey);
        if (!orderByDay.has(targetId)) {
          const dd = (it?.days || []).find((d) => d.id === targetId);
          orderByDay.set(targetId, dd?.activities?.length || 0);
        }
        const descParts = [
          data.flight_number && `Voo ${data.flight_number}`,
          data.hotel_name,
          data.room && `Quarto ${data.room}`,
          data.provider,
          data.code && `Localizador ${data.code}`,
          data.people ? `${data.people} pessoa(s)` : "",
          data.description,
        ].filter(Boolean);
        const created = await createItineraryActivity({
          day_id: targetId,
          title,
          time: data.time || null,
          duration: data.duration || null,
          location: data.location || null,
          cost: parseDocCost(data.cost),
          description: descParts.join(" · ") || null,
          type: mappedType,
          sort_order: orderByDay.get(targetId)!,
        });
        orderByDay.set(targetId, (orderByDay.get(targetId) || 0) + 1);
        usedDayIds.add(targetId);
        if (created && !firstActivityId) firstActivityId = created.id;
      }

      // Persist the document so it can't be re-imported into this day.
      if (file) {
        try {
          await uploadLeadDocument({
            file,
            agencyId: it!.agency_id,
            itineraryId: id,
            activityId: firstActivityId,
            category: "Importado no roteiro",
          });
        } catch {
          // Non-fatal: activities were created even if the file failed to store.
        }
      }

      for (const usedId of usedDayIds) {
        await reorderDayActivitiesByTime(usedId);
      }
      const added = items.length - skipped;
      if (added > 0) {
        toast.success(
          `${added} atividade(s) organizada(s) por data e hora${skipped ? ` (${skipped} já existente(s) ignorada(s))` : ""}.`,
        );
      } else {
        toast.info("Nenhuma novidade: os itens do documento já constavam no roteiro.");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler documento.");
    } finally {
      setPendingDayId(null);
    }
  }

  // Fluxo direto (upload local): extrai e insere de imediato.
  async function runDocImport(source: DocSource, targetDayId: string) {
    const items = await extractDocItems(source);
    if (!items) return;
    await insertDocItems(items, source, targetDayId);
  }



  const addDay = useMutation({
    mutationFn: () => {
      const nextNumber = getNextDayNumber(it?.days);
      return createItineraryDay({
        itinerary_id: id,
        day_number: nextNumber,
        title: `Dia ${nextNumber}`,
        sort_order: nextNumber,
      });
    },
    onSuccess: refresh,
    onError: () => toast.error("Erro ao adicionar dia."),
  });

  const clearItinerary = useMutation({
    mutationFn: async () => {
      for (const day of it?.days || []) {
        await deleteItineraryDay(day.id);
      }
      // Also unlink attached documents/images so they stop being "in use" in the library.
      await deleteItineraryDocuments(id);
    },
    onSuccess: () => {
      toast.success("Roteiro limpo. Comece novamente!");
      qc.invalidateQueries({ queryKey: ["library"] });
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

    // Drop the "Documento" palette item onto a day → open a file picker so the AI
    // can read the document and add the activities it finds. Must stay synchronous
    // (no await before .click()) to keep the browser's user-gesture for the dialog.
    if (activeId === "new:document") {
      let dayId: string | null = null;
      if (resolvedOverId?.startsWith("day:")) dayId = resolvedOverId.slice(4);
      else if (resolvedOverId?.startsWith("act:")) {
        const actId = resolvedOverId.slice(4);
        dayId = days.find((x) => (x.activities || []).some((a) => a.id === actId))?.id ?? null;
      }
      // Soltar sobre "Adicionar dia" (ou board vazio) cria um novo dia automaticamente.
      const overNewDay = resolvedOverId === "new-day" || (!resolvedOverId && days.length === 0);
      if (!dayId && !overNewDay) {
        toast.error("Solte o documento sobre um dia existente ou em \"Adicionar dia\".");
        return;
      }
      docTargetDayRef.current = dayId ?? "__new__";
      docInputRef.current?.click();
      return;
    }




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
          const nextNumber = getNextDayNumber(days);
        const day = await createItineraryDay({
          itinerary_id: id,
          day_number: nextNumber,
          title: `Dia ${nextNumber}`,
          sort_order: nextNumber,
        });
        if (!day) throw new Error("erro");
        const created = await createItineraryActivity({
          day_id: day.id,
          title: meta?.defaultTitle || "Novo item",
          type,
          sort_order: 0,
        });
        if (created) setAutoEditId(created.id);
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
          setAutoEditId(created.id);
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

      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_4px_rgba(0,0,0,0.06),0_8px_16px_-8px_rgba(0,0,0,0.12)] sm:flex-row sm:items-stretch">
        <div className="relative h-40 w-full shrink-0 overflow-hidden bg-muted/60 sm:h-auto sm:w-56">
          {it.cover_image ? (
            <>
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={it.destination || "Destino"}
                  onLoad={() => setCoverLoaded(true)}
                  onError={() => setCoverLoaded(true)}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity ${coverLoaded ? "opacity-100" : "opacity-0"}`}
                />
              )}
              {!coverLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Carregando…</span>
                </div>
              )}
            </>
          ) : (
            <img
              src={roteiroFallback}
              alt={it.destination || "Destino"}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-sm font-bold text-white">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{it.destination || "—"}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-start justify-between gap-4 bg-card p-5">
        <div>
          <h1 className="text-2xl font-bold">{it.title}</h1>
          <p className="text-sm text-muted-foreground">
            {it.client_name} · {formatCurrency(it.budget)} · <span>{STATUS_LABELS[it.status || "draft"] || it.status}</span>
          </p>
          {(() => {
            const fmt = (d: string) =>
              new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            let label: string | null = null;
            if (it.start_date && it.end_date) label = `${fmt(it.start_date)} — ${fmt(it.end_date)}`;
            else if (it.start_date) label = fmt(it.start_date);
            else if (it.end_date) label = fmt(it.end_date);
            const parts: React.ReactNode[] = [];
            if (label) parts.push(
              <span key="date" className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" /> {label}
              </span>,
            );
            if (it.passengers) parts.push(
              <span key="pax" className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" /> {it.passengers} viajante{it.passengers > 1 ? "s" : ""}
              </span>,
            );
            if (!parts.length) return null;
            return <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-foreground">{parts}</p>;
          })()}
        </div>
        <div className="flex flex-wrap gap-2">
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
          <CompleteWithAI it={it} onDone={refresh} />
          {(it.days || []).some((d) => (d.activities?.length || 0) > 0) && (
            <RoteiroPdfExport it={it} coverUrl={coverUrl} />
          )}
        </div>
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
        <div className="mb-3">
          <h2 className="text-base font-semibold">Blocos do roteiro</h2>
          <p className="text-sm text-muted-foreground">
            Arraste os blocos abaixo para os dias do roteiro para montar o itinerário.
          </p>
        </div>
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/40 p-3 backdrop-blur">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Arraste para o dia:
          </span>
          {ACTIVITY_TYPES.map((t) => (
            <PaletteItem key={t.type} type={t.type} label={t.label} icon={t.icon} hint={t.hint} />
          ))}
          <PaletteItem type="document" label="Documento (IA)" icon={FileUp} hint="Importa um documento (voucher, itinerário, cartão de embarque) e a IA extrai várias atividades, distribuindo-as nos dias certos." />

          {driveEnabled && (
            <button
              type="button"
              onClick={() => setDriveOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
              title="Importar um documento direto do Google Drive da agência para a IA interpretar."
            >
              <HardDrive className="h-3.5 w-3.5" /> Importar do Drive
            </button>
          )}

          <input
            ref={docInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleDocImport}
            className="hidden"
          />
        </div>

        {pendingDayId && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo documento com a IA…
          </p>
        )}

        {driveOpen && (
          <DriveImportModal
            folderId={gdriveCfg?.folderId || ""}
            onClose={() => setDriveOpen(false)}
            onPick={handleDrivePick}
          />
        )}

        {drivePreview && (
          <DrivePreviewModal
            name={drivePreview.name}
            items={drivePreview.items}
            onCancel={() => setDrivePreview(null)}
            onConfirm={confirmDrivePreview}
          />
        )}

        {sheetPick && (
          <SheetPickModal
            name={sheetPick.file.name}
            sheets={sheetPick.sheets}
            onCancel={() => setSheetPick(null)}
            onConfirm={confirmSheetPick}
          />
        )}



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
              autoEditId={autoEditId}
              onAutoEditDone={() => setAutoEditId(null)}
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
  autoEditId = null,
  onAutoEditDone,
}: {
  day: ItineraryDay;
  allDays: ItineraryDay[];
  onChange: () => void;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
  pendingActivity?: boolean;
  autoEditId?: string | null;
  onAutoEditDone?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [newType, setNewType] = useState<string>("activity");
  const [dayTitle, setDayTitle] = useState(day.title || `Dia ${day.day_number}`);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dayQc = useQueryClient();
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
            <Trash2 className="text-destructive h-4 w-4" />
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
              autoEdit={autoEditId === a.id}
              onAutoEditDone={onAutoEditDone}
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
        <button
          onClick={addActivity}
          title="Adicionar item"
          className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
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
  autoEdit = false,
  onAutoEditDone,
}: {
  activity: NonNullable<ItineraryDay["activities"]>[number];
  onChange: () => void;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
  autoEdit?: boolean;
  onAutoEditDone?: () => void;
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
        autoEdit={autoEdit}
        onAutoEditDone={onAutoEditDone}
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
  autoEdit = false,
  onAutoEditDone,
}: {
  activity: NonNullable<ItineraryDay["activities"]>[number];
  onChange: () => void;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
  autoEdit?: boolean;
  onAutoEditDone?: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const done = activity.type === "done";

  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState(activity.title || "");
  const [eTime, setETime] = useState(activity.time || "");
  const [eLocation, setELocation] = useState(activity.location || "");
  const [eType, setEType] = useState<string>(activity.type || "activity");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setETitle(activity.title || "");
    setETime(activity.time || "");
    setELocation(activity.location || "");
    setEType(done ? "activity" : activity.type || "activity");
    setEditing(true);
  }

  useEffect(() => {
    if (autoEdit) {
      startEdit();
      onAutoEditDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  async function saveEdit() {
    if (!eTitle.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    try {
      await updateItineraryActivity(activity.id, {
        title: eTitle.trim(),
        time: eTime || null,
        location: eLocation || null,
        type: eType,
      });
      setEditing(false);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone() {
    await updateItineraryActivity(activity.id, { type: done ? null : "done" });
    onChange();
  }

  const meta = TYPE_META[activity.type || ""];
  const TypeIcon = meta?.icon;

  if (editing) {
    return (
      <div className="min-w-0 flex-1 space-y-2 rounded-lg border border-primary/40 bg-muted/50 p-2">
        <div className="flex flex-wrap gap-2">
          <select
            value={eType}
            onChange={(e) => setEType(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          <input
            type="time"
            value={eTime}
            onChange={(e) => setETime(e.target.value)}
            className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
        <input
          value={eTitle}
          onChange={(e) => setETitle(e.target.value)}
          placeholder="Título…"
          className="w-full rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        />
        <div className="flex justify-end gap-1.5">
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={saveEdit}
            disabled={saving}
            className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-start justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <span className="flex min-w-0 items-start gap-2">
          <button
            onClick={toggleDone}
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              done ? "border-primary bg-primary text-primary-foreground" : "border-input"
            }`}
          >
            {done && <Check className="h-3 w-3" />}
          </button>
          {TypeIcon && <TypeIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          <span className={`min-w-0 break-words ${done ? "text-muted-foreground line-through" : ""}`}>
            {activity.time && <strong className="mr-2 text-primary">{activity.time}</strong>}
            {activity.title}
            {activity.location && <span className="ml-2 text-[11px] text-muted-foreground">· {activity.location}</span>}
          </span>
        </span>
        <span className="flex gap-1">
          <button
            onClick={startEdit}
            className="text-muted-foreground hover:text-primary"
            title="Editar item"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: "Excluir este item?",
                description: "Esta ação removerá o item do dia e seus anexos. Deseja continuar?",
                confirmLabel: "Excluir",
              });
              if (!ok) return;
              // Deleting an activity also removes any documents attached to it
              // from the library (they only existed within this roteiro).
              try {
                const attached = await fetchActivityDocuments(activity.id);
                for (const d of attached) await deleteLeadDocument(d);
              } catch {
                // Non-fatal: still remove the activity.
              }
              await deleteItineraryActivity(activity.id);
              qc.invalidateQueries({ queryKey: ["library", "documents"] });
              onChange();
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="text-destructive h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      <ActivityDocuments
        activityId={activity.id}
        agencyId={agencyId}
        leadId={leadId}
        itineraryId={itineraryId}
        activityTitle={activity.title}
      />

    </div>
  );
}

function ActivityDocuments({
  activityId,
  agencyId,
  leadId,
  itineraryId,
  activityTitle,
}: {
  activityId: string;
  agencyId: string;
  leadId: string | null;
  itineraryId: string;
  activityTitle?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0].value);
  const [uploading, setUploading] = useState(false);
  const [open_, setOpen_] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<LeadDocument | null>(null);
  const analyzeImage = useServerFn(analyzeImageActivityFn);
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
      let cat = category;
      // Imagens são interpretadas pela IA para categorizar e, além de anexar
      // ao roteiro, também são salvas na seção "Imagem" da biblioteca com
      // Título, Local/Destino, Descrição e Conteúdo para a base de conhecimento.
      if (file.type.startsWith("image/")) {
        const base64 = await fileToBase64(file);
        let info: { title?: string; location?: string; description?: string; content?: string } = {};
        const res = await analyzeImage({
          data: { fileBase64: base64, mime: file.type, itineraryId, activityTitle },
        });
        // Só anexa/salva se a IA tiver certeza de que a imagem se refere ao destino do lead.
        if (!res.matches) {
          toast.error(res.reason || "A imagem não parece ter relação com o destino do roteiro. Não foi anexada.");
          return;
        }
        info = {
          title: res.title,
          location: res.location,
          description: res.description,
          content: res.content,
        };
        cat = "imagem";
        // Verifica duplicidade por SEMELHANÇA visual (hash perceptual), não só
        // por nome/local — evita repetir imagens parecidas no roteiro/biblioteca.
        const dup = await findSimilarLibraryImage({
          file,
          location: res.location,
          title: res.title,
        });
        if (dup) {
          const msg = dup.identical
            ? `Já existe uma imagem praticamente idêntica na biblioteca ("${dup.item.title}"). Deseja incluir mesmo assim?`
            : dup.similar
              ? `Já existe uma imagem muito parecida na biblioteca ("${dup.item.title}"). Deseja incluir mesmo assim?`
              : `Já existe uma imagem deste local na biblioteca ("${dup.item.title}"). Deseja incluir mesmo assim?`;
          if (!window.confirm(msg)) {
            toast.info("Inclusão cancelada. A imagem não foi anexada.");
            return;
          }
        }

        // Salva a imagem também na seção "Imagem" da biblioteca.
        try {
          await saveImageFileToLibrary(file, info);
          qc.invalidateQueries({ queryKey: ["library"] });
        } catch (libErr) {
          console.error("save image to library", libErr);
        }
      }

      await uploadLeadDocument({ file, agencyId, leadId, itineraryId, activityId, category: cat });
      toast.success("Documento anexado e salvo na biblioteca.");
      qc.invalidateQueries({ queryKey: ["activity-docs", activityId] });
      qc.invalidateQueries({ queryKey: ["library", "documents"] });
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
      toast.success("Documento removido do roteiro e da biblioteca.");
      qc.invalidateQueries({ queryKey: ["activity-docs", activityId] });
      qc.invalidateQueries({ queryKey: ["library", "documents"] });
      if (leadId) qc.invalidateQueries({ queryKey: ["lead-docs", leadId] });
    } else {
      toast.error("Erro ao remover documento.");
    }
  }

  const attachLabel = (() => {
    if (docs.length === 0) return "Anexar";
    const cats = new Set(docs.map((d) => d.category || "outro"));
    if (cats.size === 1) {
      const c = DOCUMENT_CATEGORIES.find((x) => x.value === [...cats][0]);
      const name = (c?.label || "documento").toLowerCase();
      return `${docs.length} ${name}${docs.length > 1 ? "s" : ""}`;
    }
    return `${docs.length} documento${docs.length > 1 ? "s" : ""}`;
  })();

  return (
    <div className="ml-1">
      <button
        onClick={() => setOpen_((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="h-3 w-3" />
        {attachLabel}
        <ChevronDown className={`h-3 w-3 transition-transform ${open_ ? "rotate-180" : ""}`} />
      </button>
      {open_ && (
        <div className="mt-1 space-y-1">
          {docs.map((doc) => (
            <div key={doc.id} className="flex w-full min-w-0 items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-[11px]">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <button onClick={() => setPreview(doc)} className="flex min-w-0 flex-1 items-center gap-1 text-left" title={`Pré-visualizar ${doc.name}`}>
                <span className="line-clamp-2 break-words text-[10px] leading-tight">{doc.name}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Ações">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPreview(doc)}>
                    <Eye className="mr-2 h-4 w-4" /> Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => download(doc)}>
                    <Download className="mr-2 h-4 w-4" /> Baixar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => remove(doc)} className="text-destructive focus:text-destructive">
                    <Trash2 className="text-destructive mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    <Trash2 className="text-destructive h-4 w-4" />
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

function mapActivityType(t?: string): string {
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

// Botão que usa a IA + biblioteca da agência para completar os dias vazios/incompletos
// de todo o período da viagem, seguindo a estrutura por turnos (manhã/tarde/noite),
// dicas, hospedagem e estimativas de custo.
function CompleteWithAI({ it, onDone }: { it: Itinerary; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const plan = useServerFn(itineraryPlanner);
  const downloadImage = useServerFn(downloadDestinationImage);

  // Só faz sentido em rascunho e com datas + destino definidos.
  if (it.status && it.status !== "draft") return null;
  if (!it.destination || !it.start_date || !it.end_date) return null;

  const expected = (() => {
    const ini = new Date(it.start_date + "T00:00:00");
    const fim = new Date(it.end_date + "T00:00:00");
    if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return 0;
    return Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1);
  })();
  const current = it.days?.length || 0;
  const emptyDays = (it.days || []).filter((d) => (d.activities?.length || 0) === 0).length;
  const needs = (expected > current) || emptyDays > 0;
  if (!needs) return null;

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

  async function run() {
    setLoading(true);
    try {
      const message =
        `Complete o roteiro para TODO o período da viagem (${expected} dia(s)). ` +
        `Crie os dias que faltam e complemente os dias sem atividades, usando a biblioteca da agência e as informações do destino. ` +
        `Organize cada dia por turnos (manhã, tarde e noite), inclua dicas de viajante, sugestões de hospedagem e estimativas de custo por atividade.`;
      const res = await plan({
        data: { message, context: buildContext(), files: [], leadId: it.lead_id ?? null, itineraryId: it.id },
      });

      let createdDays = 0;
      let reusedDays = 0;
      let createdActs = 0;
      let updatedActs = 0;
      const existingDays = [...(it.days || [])];
      // Locais das atividades geradas pela IA, para buscar e arquivar imagens.
      const activityLocations = new Set<string>();

      for (let i = 0; i < res.days.length; i++) {
        const d = res.days[i];
        const resolved = await resolveDayForPlan({
          itineraryId: it.id,
          existing: existingDays,
          index: i,
          aiTitle: d.title,
          aiDate: d.date,
        });
        if (!resolved) continue;
        const { day, reused } = resolved;
        if (reused) reusedDays++;
        else {
          createdDays++;
          existingDays.push(day);
        }
        const baseSort =
          (existingDays.find((x) => x.id === day.id)?.activities?.length || 0);
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
              type: mapActivityType(a.type),
              sort_order: baseSort + j,
            });
            createdActs++;
            if (a.location && a.location.trim()) activityLocations.add(a.location.trim());
          } catch {
            /* ignora atividade individual com erro */
          }
        }
      }
      void reusedDays;

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
            ...(fields.type !== undefined ? { type: mapActivityType(fields.type) } : {}),
            ...(fields.cost !== undefined ? { cost: fields.cost && fields.cost > 0 ? fields.cost : null } : {}),
          });
          updatedActs++;
          if (fields.location && fields.location.trim()) activityLocations.add(fields.location.trim());
        } catch {
          /* ignora atualização individual com erro */
        }
      }

      // Busca e arquiva na biblioteca imagens dos atrativos das atividades
      // geradas pela IA, com referência ao destino, para uso em roteiros futuros.
      // Sempre verifica primeiro na biblioteca; só busca externamente se faltar.
      let savedImgs = 0;
      // Garante também uma imagem do destino principal (capa/acervo).
      const targets = [it.destination || "", ...Array.from(activityLocations)]
        .map((s) => s.trim())
        .filter((v, i, a) => !!v && a.indexOf(v) === i)
        .slice(0, 8);
      for (const loc of targets) {
        try {
          const isMain = loc === (it.destination || "").trim();
          const term = isMain ? loc : `${loc}, ${it.destination}`;
          // Só busca uma nova imagem se ainda não houver na biblioteca.
          const existing = await searchLibraryImageForDestination(loc);
          if (existing) continue;
          const res2 = await downloadImage({ data: { destination: term } });
          if (res2?.imageUrl) {
            const saved = await saveActivityImageToLibrary(res2.imageUrl, loc, it.destination || "");
            if (saved) savedImgs++;
          }
        } catch {
          /* imagem opcional: ignora falhas individuais */
        }
      }

      if (createdDays > 0 || updatedActs > 0) {

        toast.success(
          `Roteiro complementado: ${createdDays} dia(s), ${createdActs} atividade(s)` +
            (updatedActs ? ` e ${updatedActs} atualização(ões)` : "") +
            (savedImgs ? ` · ${savedImgs} imagem(ns) salva(s) na biblioteca` : "") + ".",
        );
        onDone();
      } else {
        toast.info(res.reply || "A IA não encontrou dados suficientes para completar o roteiro.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível completar o roteiro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      title="Usar IA + biblioteca para completar os dias vazios/incompletos"
      className="flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Completar com IA
    </button>
  );
}



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
      const latestItinerary = await fetchItineraryById(it.id);
      const existingDays = [...(latestItinerary?.days || it.days || [])];
      for (let i = 0; i < res.days.length; i++) {
        const d = res.days[i];
        const resolved = await resolveDayForPlan({
          itineraryId: it.id,
          existing: existingDays,
          index: i,
          aiTitle: d.title,
          aiDate: d.date,
        });
        if (!resolved) continue;
        const { day, reused } = resolved;
        if (!reused) {
          createdDays++;
          existingDays.push(day);
        }
        const baseSort =
          (existingDays.find((x) => x.id === day.id)?.activities?.length || 0);
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
              sort_order: baseSort + j,
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
        className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 md:bottom-6"
        title="Assistente de roteiro"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-40 right-6 z-50 flex h-[32rem] max-h-[calc(100vh-11rem)] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-24 md:z-40 md:max-h-none">
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

function DriveImportModal({
  folderId,
  onClose,
  onPick,
}: {
  folderId: string;
  onClose: () => void;
  onPick: (f: DriveFile) => void;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const listFiles = useServerFn(listDriveFiles);
  const conn = useQuery({ queryKey: ["drive-conn"], queryFn: () => checkDriveConnection() });
  const filesQ = useQuery({
    queryKey: ["drive-files", folderId, term],
    queryFn: () => listFiles({ data: { folderId: folderId || undefined, search: term || undefined } }),
    enabled: conn.data?.connected === true,
  });

  const iconFor = (mime: string) => {
    if (mime.startsWith("image/")) return ImageIcon;
    return FileText;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <HardDrive className="h-4 w-4 text-primary" /> Importar do Google Drive
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <form
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(search.trim());
            }}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar arquivo…"
              className="h-9 flex-1 bg-transparent text-sm outline-none"
            />
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conn.isLoading && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Conectando ao Drive…
            </p>
          )}
          {conn.data && !conn.data.connected && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Conector do Google Drive indisponível. Verifique a conexão nas configurações do projeto.
            </p>
          )}
          {conn.data?.connected && filesQ.isLoading && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando arquivos…
            </p>
          )}
          {conn.data?.connected && filesQ.data && filesQ.data.files.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum arquivo encontrado.</p>
          )}
          <ul className="space-y-1">
            {filesQ.data?.files.map((f) => {
              const Icon = iconFor(f.mimeType);
              return (
                <li key={f.id}>
                  <button
                    onClick={() => onPick(f)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SheetPickModal({
  name,
  sheets,
  onCancel,
  onConfirm,
}: {
  name: string;
  sheets: string[];
  onCancel: () => void;
  onConfirm: (selected: string[]) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => sheets.map(() => true));
  const toggle = (i: number) => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)));
  const selected = sheets.filter((_, i) => checked[i]);
  const allOn = checked.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex min-w-0 items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Abas — {name}</span>
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <span>Selecione as abas que a IA deve ler.</span>
          <button
            onClick={() => setChecked(sheets.map(() => !allOn))}
            className="font-medium text-primary hover:underline"
          >
            {allOn ? "Desmarcar todas" : "Marcar todas"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {sheets.map((s, i) => (
              <li key={s}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => toggle(i)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 truncate font-medium">{s}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Ler {selected.length} aba(s)
          </button>
        </div>
      </div>
    </div>
  );
}

function DrivePreviewModal({
  name,
  items,
  onCancel,
  onConfirm,
}: {
  name: string;
  items: ExtractedDocData[];
  onCancel: () => void;
  onConfirm: (selected: ExtractedDocData[]) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => true));
  const toggle = (i: number) =>
    setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)));
  const selectedCount = checked.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex min-w-0 items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Prévia — {name}</span>
          </h3>
          <button onClick={onCancel} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {items.length} item(ns) encontrado(s). Revise e desmarque o que não quer inserir.
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {items.map((it, i) => {
              const meta = [it.date, it.time, it.location].filter(Boolean).join(" · ");
              return (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        {it.type && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                            {it.type}
                          </span>
                        )}
                        <span className="font-medium">
                          {it.title || it.hotel_name || it.flight_number || "Item"}
                        </span>
                      </span>
                      {meta && <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>}
                      {it.description && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {it.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(items.filter((_, i) => checked[i]))}
            disabled={selectedCount === 0}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Inserir {selectedCount} no roteiro
          </button>
        </div>
      </div>
    </div>
  );
}



