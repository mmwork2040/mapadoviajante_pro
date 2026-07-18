import { createFileRoute, Link } from "@tanstack/react-router";
import { ScrollLock } from "@/components/ScrollLock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Plus, X, MapPin, Trash2, MoreVertical, Copy, Calendar, Users, Map, Image as ImageIcon, Images, Upload, Bot, Route as RouteIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  createItinerary,
  deleteItinerary,
  duplicateItinerary,
  fetchItineraries,
  fetchLeads,
  
  updateLead,
  fetchAiConfig,
  searchLibraryImageForDestination,
  saveExternalImageToLibrary,
  uploadImageToLibraryForDestination,
} from "@/lib/services";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

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
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["itineraries"],
    queryFn: fetchItineraries,
  });

  const remove = useMutation({
    mutationFn: (it: Itinerary) => deleteItinerary(it.id),
    onSuccess: (_d, it) => {
      dispatchWebhook("itinerary.deleted", it);
      toast.success("Roteiro excluído.");
      qc.invalidateQueries({ queryKey: ["itineraries"] });
    },
    onError: () => toast.error("Erro ao excluir roteiro."),
  });

  const duplicate = useMutation({
    mutationFn: (it: Itinerary) => duplicateItinerary(it.id),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao duplicar roteiro.");
      toast.success("Roteiro duplicado.");
      qc.invalidateQueries({ queryKey: ["itineraries"] });
    },
    onError: () => toast.error("Erro ao duplicar roteiro."),
  });

  async function handleDelete(it: Itinerary) {
    const ok = await confirm({
      title: "Excluir roteiro",
      description: `Tem certeza que deseja excluir "${it.title}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) remove.mutate(it);
  }

  async function handleDuplicate(it: Itinerary) {
    const ok = await confirm({
      title: "Duplicar roteiro",
      description: `Deseja criar uma cópia de "${it.title}"?`,
      confirmLabel: "Duplicar",
    });
    if (ok) duplicate.mutate(it);
  }




  return (
    <div className="space-y-6">
      <PageHeader
        icon={RouteIcon}
        title="Roteiros"
        subtitle="Planejamento dia a dia das viagens."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Novo Roteiro
          </button>
        }
      />

      {isError ? (
        <QueryError message="Não foi possível carregar os roteiros." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum roteiro ainda. Crie o primeiro!</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="group relative">
              <Link
                to="/roteiros/$id"
                params={{ id: it.id }}
                className="flex overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md"
              >
                {/* Left panel — destination */}
                <div className="relative flex w-32 shrink-0 flex-col justify-end overflow-hidden bg-muted/60 p-4">
                  {it.cover_image ? (
                    <CoverImage
                      value={it.cover_image}
                      alt={it.destination || "Destino"}
                    />
                  ) : (
                    <img
                      src={itineraryPlaceholder}
                      alt="Destino sem imagem"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="relative flex items-center gap-1.5 text-sm font-bold text-white">
                    <MapPin className="h-4 w-4 shrink-0 text-white" />
                    <span className="truncate">{it.destination || "—"}</span>
                  </div>
                </div>



                {/* Right panel — details */}
                <div className="min-w-0 flex-1 p-4 pr-10">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {STATUS_LABELS[it.status] || it.status}
                    </span>
                    {/(cópia)/i.test(it.title) && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <Copy className="h-3 w-3" /> Cópia
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                      {initials(it.client_name || it.title)}
                    </span>
                    <span className="truncate font-semibold">{it.client_name || it.title}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {formatDate(it.start_date)}
                        {it.end_date ? ` – ${formatDate(it.end_date)}` : ""}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 shrink-0" />
                      {it.passengers || 1} {(it.passengers || 1) > 1 ? "viajantes" : "viajante"}
                    </p>
                  </div>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="Mais opções"
                    className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
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
          ))}
        </div>
      )}

      {open && (
        <NewItineraryModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["itineraries"] });
          }}
        />
      )}
    </div>
  );
}

function NewItineraryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Partial<Itinerary>>({ status: "draft", passengers: 1, budget: 0 });
  const [coverImage, setCoverImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const qc = useQueryClient();
  const { data: leads = [] } = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}) });



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

  function selectLead(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) {
      setForm((f) => ({ ...f, lead_id: null }));
      return;
    }
    const leadCover = (lead.profile as Record<string, string> | undefined)?.cover_image;
    setForm((f) => ({
      ...f,
      lead_id: lead.id,
      client_name: lead.name,
      destination: f.destination || lead.destination || "",
      budget: f.budget || Number(lead.value) || 0,
      title: f.title || `Roteiro - ${lead.name}`,
    }));
    if (leadCover && !coverImage) setCoverImage(leadCover);
  }

  function pickFromLibrary(value: string) {
    setCoverImage(value);
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
    const dest = (form.destination || "").trim();
    if (!dest) {
      toast.error("Informe o destino antes de enviar a imagem.");
      return;
    }
    setUploadingImg(true);
    setImgError(null);
    try {
      const url = await uploadImageToLibraryForDestination(file, dest);
      setCoverImage(url);
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
    const dest = (form.destination || "").trim();
    if (!dest || !aiActive) return;
    const wantNew = !!coverImage || triedImages.length > 0;
    setSearchingImg(true);
    setImgError(null);
    try {
      if (!wantNew) {
        const fromLibrary = await searchLibraryImageForDestination(dest);
        if (fromLibrary) {
          setCoverImage(fromLibrary);
          setTriedImages([fromLibrary]);
          toast.success("Imagem encontrada na biblioteca.");
          return;
        }
      }
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

  async function confirmPendingImage() {
    if (!pendingImage) return;
    setConfirming(true);
    try {
      const saved = await saveExternalImageToLibrary(pendingImage, (form.destination || "").trim());
      setCoverImage(saved);
      setTriedImages((prev) => [...prev, saved]);
      setPendingImage(null);
      toast.success("Imagem baixada e salva na biblioteca.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a imagem.");
    } finally {
      setConfirming(false);
    }
  }

  function rejectPendingImage() {
    setPendingImage(null);
    void findDestinationImage();
  }

  const isComplete =
    !!form.lead_id &&
    !!(form.title || "").trim() &&
    !!(form.destination || "").trim() &&
    !!form.start_date &&
    !!form.end_date &&
    Number(form.passengers) > 0 &&
    Number(form.budget) > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    const res = await createItinerary({ ...form, cover_image: coverImage || null });
    if (res && coverImage && form.lead_id) {
      const lead = leads.find((l) => l.id === form.lead_id);
      const profile = { ...((lead?.profile as Record<string, unknown>) || {}), cover_image: coverImage };
      await updateLead(form.lead_id, { profile });
    }
    setSaving(false);
    if (res) {
      dispatchWebhook("itinerary.created", res);
      toast.success("Roteiro criado!");
      onCreated();
    } else toast.error("Erro ao criar roteiro.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <ScrollLock />
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card shadow-xl">
        <div className="flex items-start justify-between bg-[var(--accent)] px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Map className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Novo Roteiro</h2>
              <p className="text-xs text-muted-foreground">Preencha todos os campos para criar o roteiro</p>
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
          <label className="block">
            <span className="mb-1 flex h-8 items-center text-sm font-semibold">
              Lead <span className="ml-1 text-primary">*</span>
            </span>
            <select
              required
              value={form.lead_id || ""}
              onChange={(e) => selectLead(e.target.value)}
              className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
            >
              <option value="">Selecione um lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <F label="Título" required value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />

          <ModalField
            label="Destino"
            required
            placeholder="Ex: Paris, França"
            value={form.destination || ""}
            onChange={(v) => setForm({ ...form, destination: v })}
            actions={[
              {
                icon: Bot,
                onClick: findDestinationImage,
                loading: searchingImg,
                disabled: !(form.destination || "").trim() || !aiActive,
                title: !aiActive
                  ? "Ative e conecte a IA nas configurações para buscar imagens"
                  : coverImage
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
                disabled: !(form.destination || "").trim(),
                title: "Enviar imagem do meu dispositivo",
              },
            ]}
            hint={coverImage ? undefined : aiActive ? undefined : "IA inativa — use a biblioteca ou envie uma imagem"}
            previewImage={coverImage || undefined}
            onClearPreview={() => { setCoverImage(""); setPendingImage(null); setTriedImages([]); }}
            pendingImage={pendingImage || undefined}
            confirming={confirming}
            onConfirmPending={confirmPendingImage}
            onRejectPending={rejectPendingImage}
            errorMessage={imgError || undefined}
            onRetry={findDestinationImage}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
          {showLibraryPicker && (
            <LibraryImagePicker onClose={() => setShowLibraryPicker(false)} onPick={pickFromLibrary} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <F label="Início" type="date" required value={form.start_date || ""} onChange={(v) => setForm({ ...form, start_date: v })} />
            <F label="Fim" type="date" required value={form.end_date || ""} onChange={(v) => setForm({ ...form, end_date: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Passageiros" type="number" required value={String(form.passengers ?? "")} onChange={(v) => setForm({ ...form, passengers: Number(v) })} />
            <F label="Orçamento" format="currency" required value={String(form.budget ?? "")} onChange={(v) => setForm({ ...form, budget: Number(v) })} />
          </div>
          <button
            type="submit"
            disabled={saving || !isComplete}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Criar Roteiro"}
          </button>
        </form>
      </div>
    </div>
  );
}

function F({
  label,
  value,
  onChange,
  type = "text",
  required,
  format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  format?: "currency";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={format ? "text" : type}
        inputMode={format ? "numeric" : undefined}
        required={required}
        value={format === "currency" ? maskCurrency(String(Math.round((Number(value) || 0) * 100))) : value}
        onChange={(e) => onChange(format === "currency" ? String(parseCurrency(e.target.value)) : e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
