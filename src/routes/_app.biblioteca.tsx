import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  createLibraryItem,
  deleteLibraryItem,
  fetchLibraryItems,
  getLibraryAssetUrl,
  updateLibraryItem,
  uploadLibraryAsset,
} from "@/lib/services";
import {
  fetchAgencyDocuments,
  documentOrigin,
  downloadDocument,
  type AgencyDocument,
  type DocumentOrigin,
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

  const isDocuments = tab === "documents";

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["library", tab],
    queryFn: () => fetchLibraryItems(tab as LibraryItemType),
    enabled: !isDocuments,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["library"] });
  const active = TABS.find((t) => t.key === tab)!;

  async function remove(item: LibraryItem) {
    const ok = await confirm({
      title: "Excluir item?",
      description: `"${item.title}" será removido da biblioteca.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    if (await deleteLibraryItem(item)) {
      toast.success("Item excluído.");
      invalidate();
    } else toast.error("Erro ao excluir item.");
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
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">{active.hint}</p>

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
          {items.map((item) => (
            <LibraryCard key={item.id} item={item} onEdit={() => setEditing(item)} onRemove={() => remove(item)} />
          ))}
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
}: {
  item: LibraryItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const img = useAssetUrl(item);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative">
        {img ? (
          <img src={img} alt={item.title} className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-accent text-accent-foreground">
            <Globe className="h-8 w-8" />
          </div>
        )}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={onEdit} className="rounded-lg bg-card/90 p-1.5 text-foreground hover:bg-card">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onRemove} className="rounded-lg bg-card/90 p-1.5 text-destructive hover:bg-card">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
        {item.tags && item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((t) => (
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
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> {item.file_name || "Arquivo"}
            </span>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{item ? "Editar" : "Novo"} · {typeLabel}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Fld label="Título" required value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />
          <Fld label="Local / Destino" value={form.location || ""} onChange={(v) => setForm({ ...form, location: v })} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Descrição curta</span>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Conteúdo (base de conhecimento p/ IA)</span>
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
  const [preview, setPreview] = useState<AgencyDocument | null>(null);
  const { data: docs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["library", "documents"],
    queryFn: fetchAgencyDocuments,
  });

  if (isError)
    return <QueryError message="Não foi possível carregar os documentos." onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (docs.length === 0)
    return <p className="text-muted-foreground">Nenhum documento enviado ainda.</p>;

  const groups: Record<DocumentOrigin, AgencyDocument[]> = { roteiro: [], lead: [], geral: [] };
  for (const d of docs) groups[documentOrigin(d)].push(d);

  return (
    <div className="space-y-6">
      {(Object.keys(groups) as DocumentOrigin[]).map((origin) =>
        groups[origin].length === 0 ? null : (
          <div key={origin} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {ORIGIN_LABELS[origin]} · {groups[origin].length}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups[origin].map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onPreview={() => setPreview(doc)} />
              ))}
            </div>
          </div>
        ),
      )}
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function DocumentRow({ doc, onPreview }: { doc: AgencyDocument; onPreview: () => void }) {
  const source = doc.itinerary?.title || doc.lead?.name || null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <FileText className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doc.category ? `${doc.category}` : "documento"}
          {source ? ` · ${source}` : ""}
        </p>
      </div>
      <button
        onClick={onPreview}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Visualizar"
      >
        <Eye className="h-4 w-4" />
      </button>
      <button
        onClick={() => downloadDocument(doc)}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Baixar"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}
