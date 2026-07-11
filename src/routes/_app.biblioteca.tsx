import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  Plus,
  X,
  Globe,
  Pencil,
  Trash2,
  Sparkles,
  Package,
  Image as ImageIcon,
  Map,
  Upload,
  FileText,
  MapPin,
  Files,
  Download,
  Eye,
  Wand2,
  Loader2,
  CheckSquare,
  Square,
  Lock,
  ArrowUpRight,
} from "lucide-react";


import { toast } from "sonner";
import {
  createLibraryItem,
  deleteLibraryItem,
  bulkDeleteLibraryItems,
  fetchAiConfig,
  fetchLibraryItems,
  getLibraryAssetUrl,
  updateLibraryItem,
  uploadLibraryAsset,
  findSimilarLibraryImage,
} from "@/lib/services";
import { generateLibraryContent } from "@/lib/ai.functions";
import { visibleTags, computeImagePHashFromFile, phashToTag } from "@/lib/image-hash";

import {
  fetchAgencyDocuments,
  documentOrigin,
  downloadDocument,
  uploadGeneralDocument,
  deleteLeadDocument,
  fetchItineraryAttachmentMap,
  fetchLibraryImageAttachmentMap,
  libraryImageName,
  documentKey,
  type AgencyDocument,
  type DocumentOrigin,
  type ItineraryAttachment,
} from "@/lib/lead-documents";
import { formatCurrency } from "@/lib/ui";
import type { LibraryItem, LibraryItemType } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { useConfirm } from "@/components/ConfirmDialog";

type TabKey = LibraryItemType | "documents";

export const Route = createFileRoute("/_app/biblioteca")({
  component: LibraryPage,
});

const TABS: { key: TabKey; label: string; icon: typeof Sparkles; hint: string }[] = [
  { key: "experience", label: "Experiências", icon: Sparkles, hint: "Passeios, tours e atividades." },
  { key: "package", label: "Pacotes", icon: Package, hint: "Pacotes prontos com preço e duração." },
  { key: "image", label: "Imagens", icon: ImageIcon, hint: "Banco de imagens de destinos." },
  { key: "itinerary", label: "Roteiros modelo", icon: Map, hint: "Roteiros reutilizáveis como base." },
  { key: "documents", label: "Documentos", icon: Files, hint: "Arquivos enviados em leads e roteiros, agrupados por origem." },
];

function LibraryPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<TabKey>("experience");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingImg(true);
    try {
      let added = 0;
      let skipped = 0;
      for (const file of files) {
        // Duplicidade por semelhança visual: evita imagens repetidas na biblioteca.
        const dup = await findSimilarLibraryImage({ file, title: file.name });
        if (dup) {
          const msg = dup.identical
            ? `"${file.name}" é praticamente idêntica a uma imagem já existente ("${dup.item.title}"). Enviar mesmo assim?`
            : dup.similar
              ? `"${file.name}" é muito parecida com uma imagem já existente ("${dup.item.title}"). Enviar mesmo assim?`
              : `Já existe uma imagem deste local ("${dup.item.title}"). Enviar mesmo assim?`;
          if (!window.confirm(msg)) {
            skipped++;
            continue;
          }
        }
        const up = await uploadLibraryAsset(file);
        if (!up) continue;
        const title = file.name.replace(/\.[^.]+$/, "");
        const phash = await computeImagePHashFromFile(file).catch(() => null);
        const meta = buildLibraryImageMeta({
          title,
          extraTags: phash ? [phashToTag(phash)] : [],
        });
        await createLibraryItem({
          type: "image",
          title: meta.title,
          location: meta.location,
          description: meta.description,
          content: meta.content,
          file_url: up.path,
          file_name: up.name,
          tags: meta.tags,
        });
        added++;
      }
      if (added > 0) toast.success(added === 1 ? "Imagem enviada." : `${added} imagens enviadas.`);
      if (skipped > 0) toast.info(skipped === 1 ? "1 imagem ignorada." : `${skipped} imagens ignoradas.`);
      qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploadingImg(false);
    }
  }
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [itinFiles, setItinFiles] = useState<File[]>([]);
  const [itinDest, setItinDest] = useState("");
  const [uploadingItin, setUploadingItin] = useState(false);
  const itinInputRef = useRef<HTMLInputElement>(null);

  function handleSelectItinFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const invalid = files.filter((f) => f.type !== "application/pdf" && !/\.pdf$/i.test(f.name));
    if (invalid.length > 0) {
      toast.error("Envie apenas arquivos PDF.");
      return;
    }
    setItinFiles(files);
  }

  async function confirmItinUpload() {
    const dest = itinDest.trim();
    if (!dest) {
      toast.error("Informe o destino do roteiro modelo.");
      return;
    }
    setUploadingItin(true);
    try {
      for (const file of itinFiles) {
        const up = await uploadLibraryAsset(file);
        if (!up) continue;
        const title = file.name.replace(/\.[^.]+$/, "");
        await createLibraryItem({
          type: "itinerary",
          title,
          location: dest,
          file_url: up.path,
          file_name: up.name,
        });
      }
      toast.success(
        itinFiles.length === 1 ? "Roteiro modelo enviado." : `${itinFiles.length} roteiros modelo enviados.`,
      );
      qc.invalidateQueries({ queryKey: ["library"] });
      setItinFiles([]);
      setItinDest("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploadingItin(false);
    }
  }

  const isDocuments = tab === "documents";

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["library", tab],
    queryFn: () => fetchLibraryItems(tab as LibraryItemType),
    enabled: !isDocuments,
  });

  const isImageTab = tab === "image";
  const { data: imageAttachmentMap = {} } = useQuery({
    queryKey: ["library", "image", "attachments"],
    queryFn: fetchLibraryImageAttachmentMap,
    enabled: isImageTab,
    placeholderData: keepPreviousData,
  });
  const lockedFor = (item: LibraryItem): ItineraryAttachment[] =>
    isImageTab ? imageAttachmentMap[libraryImageName(item)] ?? [] : [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["library"] });
  const active = TABS.find((t) => t.key === tab)!;

  const { data: counts = {} as Record<TabKey, number> } = useQuery({
    queryKey: ["library", "counts"],
    queryFn: async (): Promise<Record<TabKey, number>> => {
      const [allItems, docs] = await Promise.all([
        fetchLibraryItems(),
        fetchAgencyDocuments(),
      ]);
      const c: Record<TabKey, number> = {
        experience: 0,
        package: 0,
        image: 0,
        itinerary: 0,
        documents: docs.length,
      };
      for (const item of allItems) {
        if (item.type in c) c[item.type as LibraryItemType] += 1;
      }
      return c;
    },
  });

  async function remove(item: LibraryItem) {
    const locked = lockedFor(item);
    if (locked.length > 0) {
      toast.error(
        `Esta imagem está anexada ${
          locked.length === 1 ? "ao roteiro" : "aos roteiros"
        } "${locked.map((a) => a.title).join('", "')}". Remova o anexo pelo roteiro antes de excluí-la.`,
      );
      return;
    }
    const ok = await confirm({
      title: "Excluir item?",
      description: `"${item.title}" será removido da biblioteca.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    if (await deleteLibraryItem(item)) {
      toast.success("Item excluído.");
      // Remove só o item excluído do cache da aba atual (mantém os demais).
      qc.setQueryData<LibraryItem[]>(["library", tab], (old) =>
        (old ?? []).filter((i) => i.id !== item.id),
      );
      qc.invalidateQueries({ queryKey: ["library", "counts"] });
    } else toast.error("Erro ao excluir item.");
  }



  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const selectable = items.filter((i) => lockedFor(i).length === 0);
    setSelected((prev) =>
      prev.size === selectable.length ? new Set() : new Set(selectable.map((i) => i.id)),
    );
  }

  async function bulkRemove() {
    const chosen = items.filter((i) => selected.has(i.id) && lockedFor(i).length === 0);
    if (chosen.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${chosen.length} ${chosen.length === 1 ? "imagem" : "imagens"}?`,
      description:
        "As imagens serão removidas da biblioteca e dos perfis de leads e roteiros que as utilizam. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir tudo",
      destructive: true,
    });
    if (!ok) return;
    const n = await bulkDeleteLibraryItems(chosen);
    if (n > 0) {
      toast.success(`${n} ${n === 1 ? "imagem excluída" : "imagens excluídas"}.`);
      setSelectMode(false);
      setSelected(new Set());
      const removed = new Set(chosen.map((c) => c.id));
      qc.setQueryData<LibraryItem[]>(["library", tab], (old) =>
        (old ?? []).filter((i) => !removed.has(i.id)),
      );
      qc.invalidateQueries({ queryKey: ["library", "counts"] });
    } else toast.error("Erro ao excluir imagens.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">
            Base de conhecimento para elaborar novos roteiros e dicas de viagem.
          </p>
        </div>
        {!isDocuments && (
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            <Plus className="h-4 w-4 shrink-0" /> Novo {active.label.replace(/s$/, "")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = t.key === tab;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" /> {t.label}
              <span
                className={`ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  on ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent text-accent-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{active.hint}</p>

      {isImageTab && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUploadImage}
          />
          <button
            onClick={() => imgInputRef.current?.click()}
            disabled={uploadingImg}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {uploadingImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadingImg ? "Enviando…" : "Enviar imagem"}
          </button>
          {items.length > 0 && (
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                selectMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckSquare className="h-4 w-4" /> {selectMode ? "Cancelar seleção" : "Selecionar imagens"}
            </button>
          )}
          {selectMode && (
            <>
              <button
                onClick={toggleAll}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {selected.size === items.length ? "Limpar seleção" : "Selecionar todas"}
              </button>
              <button
                onClick={bulkRemove}
                disabled={selected.size === 0}
                className="flex items-center gap-2 rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Excluir {selected.size > 0 ? `(${selected.size})` : ""}
              </button>
            </>
          )}
        </div>
      )}

      {tab === "itinerary" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={itinInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleSelectItinFiles}
          />
          <button
            onClick={() => itinInputRef.current?.click()}
            disabled={uploadingItin}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {uploadingItin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadingItin ? "Enviando…" : "Enviar arquivos"}
          </button>
          <span className="text-xs text-muted-foreground">Envie roteiros em PDF por destino.</span>
        </div>
      )}



      {isDocuments ? (
        <DocumentsPanel />
      ) : isError ? (
        <QueryError message="Não foi possível carregar a biblioteca." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item cadastrado nesta seção.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const locked = lockedFor(item);
            return (
              <LibraryCard
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onRemove={() => remove(item)}
                selectable={selectMode && isImageTab && locked.length === 0}
                selected={selected.has(item.id)}
                onToggleSelect={() => toggleItem(item.id)}
                lockedIn={locked}
              />
            );
          })}
        </div>
      )}

      {!isDocuments && (open || editing) && (
        <LibraryModal
          type={tab as LibraryItemType}
          item={editing}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setOpen(false);
            setEditing(null);
            invalidate();
          }}
        />
      )}

      {itinFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">Enviar roteiro modelo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {itinFiles.length === 1
                ? `Arquivo: ${itinFiles[0].name}`
                : `${itinFiles.length} arquivos selecionados`}
            </p>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold">
                Destino <span className="text-primary">*</span>
              </span>
              <input
                autoFocus
                value={itinDest}
                onChange={(e) => setItinDest(e.target.value)}
                placeholder="Ex: Paris, França"
                className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setItinFiles([]);
                  setItinDest("");
                }}
                disabled={uploadingItin}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={confirmItinUpload}
                disabled={uploadingItin || !itinDest.trim()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {uploadingItin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function useAssetUrl(item: LibraryItem): string | null {
  const [url, setUrl] = useState<string | null>(item.image_url ?? null);
  useEffect(() => {
    let alive = true;
    if (item.image_url) {
      setUrl(item.image_url);
      return;
    }
    if (item.file_url && isImagePath(item.file_url)) {
      getLibraryAssetUrl(item.file_url).then((u) => alive && setUrl(u));
    } else {
      setUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [item.image_url, item.file_url]);
  return url;
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
}

function LibraryCard({
  item,
  onEdit,
  onRemove,
  selectable = false,
  selected = false,
  onToggleSelect,
  lockedIn = [],
}: {
  item: LibraryItem;
  onEdit: () => void;
  onRemove: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  lockedIn?: ItineraryAttachment[];
}) {
  const img = useAssetUrl(item);
  const [zoom, setZoom] = useState(false);
  const [info, setInfo] = useState(false);
  const locked = lockedIn.length > 0;
  const lockHint = locked
    ? `Anexada ${lockedIn.length === 1 ? "ao roteiro" : "aos roteiros"} "${lockedIn
        .map((a) => a.title)
        .join('", "')}". Remova pelo roteiro para excluir.`
    : "";
  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-card transition ${
        selected ? "border-primary ring-2 ring-primary" : "border-border"
      } ${selectable ? "cursor-pointer" : ""}`}
      onClick={selectable ? onToggleSelect : undefined}
    >
      <div className="relative">
        {img ? (
          <img
            src={img}
            alt={item.title}
            className={`h-36 w-full object-cover ${!selectable ? "cursor-zoom-in" : ""}`}
            onClick={
              !selectable
                ? (e) => {
                    e.stopPropagation();
                    setZoom(true);
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex h-36 items-center justify-center bg-accent text-accent-foreground">
            <Globe className="h-8 w-8" />
          </div>
        )}
        {zoom && img && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={(e) => {
              e.stopPropagation();
              setZoom(false);
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom(false);
              }}
              className="absolute right-4 top-4 rounded-lg bg-card/90 p-2 text-foreground hover:bg-card"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={img}
              alt={item.title}
              className="max-h-[90vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        {selectable && (
          <div className="absolute left-2 top-2">
            {selected ? (
              <CheckSquare className="h-5 w-5 rounded bg-primary text-primary-foreground" />
            ) : (
              <Square className="h-5 w-5 rounded bg-card/90 text-foreground" />
            )}
          </div>
        )}
        {locked && (
          <div
            className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1 text-xs font-medium text-destructive"
            title={lockHint}
          >
            <Lock className="h-3.5 w-3.5" /> Em uso
          </div>
        )}
        {!selectable && !locked && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={onEdit} className="rounded-lg bg-card/90 p-1.5 text-foreground hover:bg-card">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onRemove} className="rounded-lg bg-card/90 p-1.5 text-destructive hover:bg-card">
            <Trash2 className="text-destructive h-4 w-4" />
          </button>
        </div>
        )}
        {!selectable && locked && (
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setInfo(true);
              }}
              className="rounded-lg bg-card/90 p-1.5 text-foreground hover:bg-card"
              title="Ver detalhes"
            >
              <Eye className="h-4 w-4" />
            </button>
            <div className="rounded-lg bg-card/90 p-1.5 text-destructive" title={lockHint}>
              <Lock className="h-4 w-4" />
            </div>
          </div>
        )}
        {info && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={(e) => {
              e.stopPropagation();
              setInfo(false);
            }}
          >
            <div
              className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <button
                  onClick={() => setInfo(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
                  title="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {img && (
                <img
                  src={img}
                  alt={item.title}
                  className="mb-3 max-h-60 w-full rounded-lg object-contain"
                />
              )}
              {item.location && (
                <p className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {item.location}
                </p>
              )}
              {item.description && (
                <p className="mb-2 text-sm text-muted-foreground">{item.description}</p>
              )}
              {item.content && (
                <p className="whitespace-pre-wrap text-sm text-foreground">{item.content}</p>
              )}
              <div className="mt-3 flex items-center gap-1 text-xs text-destructive">
                <Lock className="h-3.5 w-3.5" /> {lockHint}
              </div>
            </div>
          </div>
        )}


      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold">{item.title}</h3>
        {item.location && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {item.location}
          </p>
        )}
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        {visibleTags(item.tags).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleTags(item.tags).slice(0, 4).map((t) => (
              <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          {item.type === "package" ? (
            <p className="text-sm font-semibold text-primary">
              {formatCurrency(item.price || 0)}
              {item.days ? <span className="text-muted-foreground"> · {item.days}d</span> : null}
            </p>
          ) : (
            <span />
          )}
          {item.file_url && !isImagePath(item.file_url) && (
            <button
              onClick={async () => {
                const url = await getLibraryAssetUrl(item.file_url!);
                if (url) window.open(url, "_blank");
                else toast.error("Não foi possível abrir o arquivo.");
              }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" /> {item.file_name || "Arquivo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryModal({
  type,
  item,
  onClose,
  onSaved,
}: {
  type: LibraryItemType;
  item: LibraryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const effectiveType = item?.type ?? type;
  const [form, setForm] = useState<Partial<LibraryItem>>(
    item || { type: effectiveType, price: 0, days: 1, tags: [] },
  );
  const [tagsText, setTagsText] = useState((item?.tags ?? []).join(", "));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiField, setAiField] = useState<"description" | "content" | null>(null);

  const { data: aiConfig } = useQuery({ queryKey: ["ai-config"], queryFn: fetchAiConfig });
  const aiActive =
    aiConfig?.knowledge_sources?.status === "connected" && !!aiConfig?.api_key_encrypted;
  const genContent = useServerFn(generateLibraryContent);

  async function aiAssist(field: "description" | "content") {
    if (!aiActive) return;
    if (!form.title?.trim()) {
      toast.error("Informe um título antes de usar a IA.");
      return;
    }
    setAiField(field);
    try {
      const res = await genContent({
        data: {
          itemType: effectiveType,
          title: form.title.trim(),
          location: form.location?.trim() || "",
          description: form.description?.trim() || "",
          content: form.content?.trim() || "",
          tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
          field,
        },
      });
      const text = res.text?.trim();
      if (!text) {
        toast.error("A IA não retornou conteúdo.");
        return;
      }
      setForm((f) => ({ ...f, [field]: text }));
      toast.success(field === "description" ? "Descrição gerada!" : "Conteúdo gerado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar com IA.");
    } finally {
      setAiField(null);
    }
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    try {
      const patch: Partial<LibraryItem> = {
        ...form,
        type: effectiveType,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (file) {
        const up = await uploadLibraryAsset(file);
        if (up) {
          patch.file_url = up.path;
          patch.file_name = up.name;
        }
      }
      const res = item ? await updateLibraryItem(item.id, patch) : await createLibraryItem(patch);
      if (res) {
        toast.success(item ? "Item atualizado!" : "Item adicionado!");
        onSaved();
      } else toast.error("Erro ao salvar item.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar item.");
    } finally {
      setSaving(false);
    }
  }

  const isPackage = effectiveType === "package";
  const isImage = effectiveType === "image";
  const typeLabel = TABS.find((t) => t.key === effectiveType)?.label ?? "Item";
  const HeaderIcon = TABS.find((t) => t.key === effectiveType)?.icon ?? ImageIcon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-xl">
        <div className="flex items-start justify-between bg-[var(--accent)] px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HeaderIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{item ? "Editar" : "Novo"} · {typeLabel}</h2>
              <p className="text-xs text-muted-foreground">
                {item ? "Atualize as informações do item" : "Preencha os campos para adicionar o item"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex-1 space-y-3 overflow-y-auto px-6 py-5">

          <Fld label="Título" required value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />
          <Fld label="Local / Destino" value={form.location || ""} onChange={(v) => setForm({ ...form, location: v })} />
          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Descrição curta</span>
              <AiAssistButton
                loading={aiField === "description"}
                disabled={!aiActive || aiField !== null}
                title={aiActive ? "Gerar descrição com IA" : "IA inativa — configure para usar"}
                onClick={() => aiAssist("description")}
              />
            </div>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Conteúdo (base de conhecimento p/ IA)</span>
              <AiAssistButton
                loading={aiField === "content"}
                disabled={!aiActive || aiField !== null}
                title={aiActive ? "Elaborar conteúdo com IA" : "IA inativa — configure para usar"}
                onClick={() => aiAssist("content")}
              />
            </div>
            <textarea
              value={form.content || ""}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              placeholder="Detalhes, dicas, roteiro sugerido, observações operacionais…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          {isPackage && (
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Preço base" type="number" value={String(form.price ?? "")} onChange={(v) => setForm({ ...form, price: Number(v) })} />
              <Fld label="Dias" type="number" value={String(form.days ?? "")} onChange={(v) => setForm({ ...form, days: Number(v) })} />
            </div>
          )}
          <Fld label="Tags (separadas por vírgula)" value={tagsText} onChange={setTagsText} />

          {!isImage && (
            <Fld label="Imagem de capa (URL)" value={form.image_url || ""} onChange={(v) => setForm({ ...form, image_url: v })} />
          )}
          {isImage && (
            <Fld label="Imagem (URL)" value={form.image_url || ""} onChange={(v) => setForm({ ...form, image_url: v })} />
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              {isImage ? "Ou enviar imagem" : "Anexar arquivo (PDF, imagem)"}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-input bg-background px-3 py-2 text-sm">
              <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept={isImage ? "image/*" : "image/*,application/pdf"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="min-w-0 flex-1 text-sm"
              />
            </div>
            {item?.file_name && !file && (
              <span className="mt-1 block truncate text-xs text-muted-foreground">Atual: {item.file_name}</span>
            )}
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : item ? "Salvar" : "Adicionar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AiAssistButton({
  loading,
  disabled,
  title,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wand2 className="h-3.5 w-3.5" />
      )}
      IA
    </button>
  );
}



function Fld({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

const ORIGIN_LABELS: Record<DocumentOrigin, string> = {
  roteiro: "Roteiros",
  lead: "Leads",
  geral: "Gerais",
};

function DocumentsPanel() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [preview, setPreview] = useState<AgencyDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const { data: docs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["library", "documents"],
    queryFn: fetchAgencyDocuments,
    placeholderData: keepPreviousData,
  });
  const { data: attachmentMap = {} } = useQuery({
    queryKey: ["library", "documents", "attachments"],
    queryFn: fetchItineraryAttachmentMap,
    placeholderData: keepPreviousData,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["library", "documents"] });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const invalid = files.filter(
      (f) => f.type !== "application/pdf" && !/\.pdf$/i.test(f.name),
    );
    if (invalid.length > 0) {
      toast.error("Envie apenas arquivos PDF.");
      return;
    }
    setUploading(true);
    try {
      let sent = 0;
      let dupes = 0;
      for (const f of files) {
        const { duplicate } = await uploadGeneralDocument(f);
        if (duplicate) dupes++;
        else sent++;
      }
      if (sent > 0) toast.success(sent > 1 ? "Arquivos enviados." : "Arquivo enviado.");
      if (dupes > 0)
        toast.info(
          dupes > 1
            ? `${dupes} arquivos já existiam na biblioteca e foram ignorados.`
            : "Este arquivo já existe na biblioteca e foi ignorado.",
        );
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(doc: AgencyDocument) {
    const attachedIn = attachmentMap[documentKey(doc)] ?? [];
    if (attachedIn.length > 0) {
      toast.error(
        `Este documento está anexado ${
          attachedIn.length === 1 ? "ao roteiro" : "aos roteiros"
        } "${attachedIn.map((a) => a.title).join('", "')}". Exclua o anexo pelo roteiro antes de removê-lo da biblioteca.`,
      );
      return;
    }
    const ok = await confirm({
      title: "Excluir documento?",
      description: `"${doc.name}" será removido definitivamente.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    if (await deleteLeadDocument(doc)) {
      toast.success("Documento excluído.");
      // Remove apenas o item excluído do cache (mantém os demais visíveis),
      // em vez de forçar um refetch que pode voltar vazio.
      qc.setQueryData<AgencyDocument[]>(["library", "documents"], (old) =>
        (old ?? []).filter((d) => d.id !== doc.id),
      );
      qc.invalidateQueries({ queryKey: ["library", "counts"] });
    } else toast.error("Erro ao excluir documento.");
  }

  const uploadBar = (
    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-foreground sm:w-auto">
      <Upload className="h-4 w-4 shrink-0" />
      {uploading ? "Enviando…" : "Enviar arquivos"}
      <input type="file" accept="application/pdf" multiple onChange={handleUpload} disabled={uploading} className="hidden" />
    </label>
  );

  if (isError)
    return <QueryError message="Não foi possível carregar os documentos." onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  const groups: Record<DocumentOrigin, AgencyDocument[]> = { geral: [], roteiro: [], lead: [] };
  for (const d of docs) groups[documentOrigin(d)].push(d);

  return (
    <div className="space-y-6">
      <div className="flex justify-start">{uploadBar}</div>
      {docs.length === 0 ? (
        <p className="text-muted-foreground">Nenhum documento no repositório ainda.</p>
      ) : (
        (Object.keys(groups) as DocumentOrigin[]).map((origin) =>
          groups[origin].length === 0 ? null : (
            <div key={origin} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {ORIGIN_LABELS[origin]} · {groups[origin].length}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groups[origin].map((doc) => {
                  const attachedIn = attachmentMap[documentKey(doc)] ?? [];
                  const locked = attachedIn.length > 0;
                  return (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      onPreview={() => setPreview(doc)}
                      onRemove={locked ? undefined : () => remove(doc)}
                      lockedHint={
                        locked
                          ? `Anexado ${
                              attachedIn.length === 1 ? "ao roteiro" : "aos roteiros"
                            } "${attachedIn.map((a) => a.title).join('", "')}". Exclua pelo roteiro.`
                          : undefined
                      }
                      itineraryLink={locked ? attachedIn[0].id : undefined}
                    />
                  );
                })}

              </div>
            </div>
          ),
        )
      )}
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function DocumentRow({
  doc,
  onPreview,
  onRemove,
  lockedHint,
  itineraryLink,
}: {
  doc: AgencyDocument;
  onPreview: () => void;
  onRemove?: () => void;
  lockedHint?: string;
  itineraryLink?: string;
}) {
  const source = doc.itinerary?.title || doc.lead?.name || null;
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{doc.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doc.category ? `${doc.category}` : "documento"}
          {source ? ` · ${source}` : ""}
        </p>
      </div>
      <button onClick={onPreview} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Visualizar">
        <Eye className="h-4 w-4" />
      </button>
      <button onClick={() => downloadDocument(doc)} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Baixar">
        <Download className="h-4 w-4" />
      </button>
      {itineraryLink ? (
        <Link to="/roteiros/$id" params={{ id: itineraryLink }} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary" title="Abrir roteiro">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : null}
      {onRemove ? (
        <button onClick={onRemove} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive" title="Excluir">
          <Trash2 className="text-destructive h-4 w-4" />
        </button>
      ) : lockedHint ? (
        <span className="shrink-0 rounded-lg p-1.5 text-destructive" title={lockedHint}>
          <Lock className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}
