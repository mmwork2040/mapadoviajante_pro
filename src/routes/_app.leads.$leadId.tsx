import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Send, Trash2, Plus, Check, Map, Pencil, FileText, Download, Paperclip, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createItinerary,
  createLeadActivity,
  deleteItinerary,
  deleteLead,
  fetchItinerariesByLead,
  fetchLeadActivities,
  fetchLeadById,
  fetchTeamMembers,
  fetchTransactions,
  updateItinerary,
  updateLead,
} from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import {
  DOCUMENT_CATEGORIES,
  deleteLeadDocument,
  fetchLeadDocuments,
  getDocumentUrl,
  uploadLeadDocument,
  type LeadDocument,
} from "@/lib/lead-documents";
import { formatCurrency, formatDate, maskPhone } from "@/lib/ui";
import type { Itinerary, Lead, LeadStatus } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { useConfirm } from "@/components/ConfirmDialog";
import { NewLeadModal } from "@/routes/_app.leads";

export const Route = createFileRoute("/_app/leads/$leadId")({
  component: LeadDetailPage,
});

const STATUSES: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Novo" },
  { key: "contacted", label: "Contatado" },
  { key: "negotiating", label: "Negociando" },
  { key: "closed", label: "Fechado" },
  { key: "lost", label: "Perdido" },
];


function LeadDetailPage() {
  const { leadId } = useParams({ from: "/_app/leads/$leadId" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { data: lead, isLoading, isError, refetch } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => fetchLeadById(leadId),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: () => fetchLeadActivities(leadId),
  });
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: fetchTeamMembers });
  const { data: txs = [] } = useQuery({
    queryKey: ["lead-transactions", leadId],
    queryFn: () => fetchTransactions({ lead_id: leadId }),
  });

  const update = useMutation({
    mutationFn: (updates: Partial<Lead>) => updateLead(leadId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Erro ao atualizar lead."),
  });

  const addNote = useMutation({
    mutationFn: () => createLeadActivity(leadId, { type: "note", title: "Anotação", details: note }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    },
    onError: () => toast.error("Erro ao salvar anotação."),
  });

  async function remove() {
    const ok2 = await confirm({
      title: "Excluir este lead?",
      description: "Todos os dados deste lead serão removidos permanentemente.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok2) return;
    const ok = await deleteLead(leadId);
    if (ok) {
      dispatchWebhook("lead.deleted", { id: leadId });
      toast.success("Lead excluído.");
      navigate({ to: "/leads" });
    } else toast.error("Erro ao excluir lead.");
  }

  if (isError) return <QueryError message="Não foi possível carregar o lead." onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!lead) return <p>Lead não encontrado.</p>;

  const checklists = (lead.checklists || {}) as Record<string, boolean>;
  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <Link to="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">{lead.destination || "Sem destino"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button onClick={remove} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Detalhes</h2>
            <dl className="space-y-2 text-sm">
              <Row k="E-mail" v={lead.email} />
              <Row k="Telefone" v={lead.phone ? maskPhone(lead.phone) : null} />
              <Row k="Valor" v={formatCurrency(lead.value)} />
              <Row k="Origem" v={lead.origin} />
              <Row k="Criado em" v={formatDate(lead.created_at)} />
            </dl>
            <div className="mt-4">
              <span className="mb-1 block text-sm font-medium">Responsável</span>
              <select
                value={lead.assigned_to || ""}
                onChange={(e) => update.mutate({ assigned_to: e.target.value || null })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Sem responsável</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => update.mutate({ status: s.key })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    lead.status === s.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Painel financeiro</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="font-semibold text-[var(--success)]">{formatCurrency(income)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="font-semibold text-destructive">{formatCurrency(expense)}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {txs.length === 0 && <li className="text-muted-foreground">Nenhuma transação vinculada.</li>}
              {txs.map((t) => (
                <li key={t.id} className="flex justify-between border-t border-border py-1.5">
                  <span className="text-muted-foreground">{t.description || t.category || "—"}</span>
                  <span className={t.type === "income" ? "text-[var(--success)]" : "text-destructive"}>
                    {t.type === "income" ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          
          <ChecklistCard checklists={checklists} onSave={(c) => update.mutate({ checklists: c })} />

          <ItinerariesPanel leadId={leadId} leadName={lead.name} lead={lead} />



          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold">Histórico</h2>
            <div className="mb-4 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Adicionar anotação…"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => note.trim() && addNote.mutate()}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-3">
              {activities.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma atividade ainda.</li>}
              {activities.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                  </div>
                  {a.details && <p className="mt-1 text-sm text-muted-foreground">{a.details}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <DocumentLibrary leadId={leadId} agencyId={lead.agency_id} />



      {editOpen && (
        <NewLeadModal
          lead={lead}
          onClose={() => setEditOpen(false)}
          onCreated={() => {
            setEditOpen(false);
            qc.invalidateQueries({ queryKey: ["lead", leadId] });
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
    </div>
  );
}

function DocumentLibrary({ leadId, agencyId }: { leadId: string; agencyId: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0].value);
  const [uploading, setUploading] = useState(false);
  const { data: docs = [] } = useQuery({
    queryKey: ["lead-docs", leadId],
    queryFn: () => fetchLeadDocuments(leadId),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadLeadDocument({ file, agencyId, leadId, category });
      toast.success("Documento adicionado à biblioteca.");
      qc.invalidateQueries({ queryKey: ["lead-docs", leadId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar documento.");
    } finally {
      setUploading(false);
    }
  }

  async function open(doc: LeadDocument) {
    const url = await getDocumentUrl(doc.file_path);
    if (url) window.open(url, "_blank");
    else toast.error("Não foi possível abrir o documento.");
  }

  async function remove(doc: LeadDocument) {
    const ok = await confirm({ title: "Remover documento", description: `Remover "${doc.name}"?`, confirmText: "Remover" });
    if (!ok) return;
    const done = await deleteLeadDocument(doc);
    if (done) {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["lead-docs", leadId] });
    } else {
      toast.error("Erro ao remover documento.");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4" /> Biblioteca de documentos
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input ref={fileRef} type="file" onChange={handleFile} className="hidden" accept="image/*,application/pdf" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            Adicionar
          </button>
        </div>
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento. Anexe ingressos, passagens, vouchers e reservas — eles ficam disponíveis para a IA ao planejar roteiros.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <button onClick={() => open(doc)} className="flex-1 truncate text-left hover:underline" title={doc.name}>
                {doc.category && <span className="mr-1 rounded bg-primary/10 px-1 text-[10px] font-medium uppercase text-primary">{doc.category}</span>}
                {doc.name}
              </button>
              <button onClick={() => open(doc)} className="text-muted-foreground hover:text-primary" title="Abrir">
                <Download className="h-4 w-4" />
              </button>
              <button onClick={() => remove(doc)} className="text-muted-foreground hover:text-destructive" title="Remover">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistCard({
  checklists,
  onSave,
}: {
  checklists: Record<string, boolean>;
  onSave: (c: Record<string, boolean>) => void;
}) {
  const [items, setItems] = useState<Record<string, boolean>>(checklists);
  const [newItem, setNewItem] = useState("");
  const entries = Object.entries(items);

  function toggle(key: string) {
    const next = { ...items, [key]: !items[key] };
    setItems(next);
    onSave(next);
  }
  function add() {
    const label = newItem.trim();
    if (!label || items[label] !== undefined) return;
    const next = { ...items, [label]: false };
    setItems(next);
    setNewItem("");
    onSave(next);
  }
  function remove(key: string) {
    const next = { ...items };
    delete next[key];
    setItems(next);
    onSave(next);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 font-semibold">Checklist</h2>
      <ul className="space-y-2">
        {entries.length === 0 && <li className="text-sm text-muted-foreground">Nenhum item.</li>}
        {entries.map(([key, done]) => (
          <li key={key} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <button
              onClick={() => toggle(key)}
              className={`flex h-5 w-5 items-center justify-center rounded border ${
                done ? "border-primary bg-primary text-primary-foreground" : "border-input"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
            </button>
            <span className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}>{key}</span>
            <button onClick={() => remove(key)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Novo item…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={add} className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const ITINERARY_COLUMNS: { key: string; label: string }[] = [
  { key: "draft", label: "Rascunho" },
  { key: "active", label: "Em andamento" },
  { key: "completed", label: "Concluído" },
  { key: "cancelled", label: "Cancelado" },
];

function ItinerariesPanel({ leadId, leadName, lead }: { leadId: string; leadName: string; lead: Lead }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const { data: itineraries = [] } = useQuery({
    queryKey: ["lead-itineraries", leadId],
    queryFn: () => fetchItinerariesByLead(leadId),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateItinerary(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["lead-itineraries", leadId] });
      const prev = qc.getQueryData<Itinerary[]>(["lead-itineraries", leadId]);
      qc.setQueryData<Itinerary[]>(["lead-itineraries", leadId], (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, status } : it)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["lead-itineraries", leadId], ctx.prev);
      toast.error("Não foi possível mover o roteiro.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["lead-itineraries", leadId] }),
  });

  const create = useMutation({
    mutationFn: () =>
      createItinerary({
        lead_id: leadId,
        title: `Roteiro - ${leadName}`,
        client_name: leadName,
        destination: lead.destination || "",
        budget: Number(lead.value) || 0,
        status: "draft",
      }),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar roteiro.");
      toast.success("Roteiro criado!");
      qc.invalidateQueries({ queryKey: ["lead-itineraries", leadId] });
    },
    onError: () => toast.error("Erro ao criar roteiro."),
  });

  const removeItinerary = useMutation({
    mutationFn: (id: string) => deleteItinerary(id),
    onSuccess: (ok, id) => {
      if (!ok) return toast.error("Erro ao excluir roteiro.");
      dispatchWebhook("itinerary.deleted", { id });
      toast.success("Roteiro excluído.");
      qc.invalidateQueries({ queryKey: ["lead-itineraries", leadId] });
    },
    onError: () => toast.error("Erro ao excluir roteiro."),
  });

  async function handleRemoveItinerary(id: string, title: string) {
    const ok = await confirm({
      title: "Excluir roteiro?",
      description: `O roteiro "${title}" e todos os seus dias e atividades serão removidos permanentemente.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) removeItinerary.mutate(id);
  }


  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Map className="h-4 w-4" /> Roteiros
        </h2>
        <button
          onClick={() => create.mutate()}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITINERARY_COLUMNS.map((col) => {
          const items = itineraries.filter((it) => (it.status || "draft") === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverCol(col.key);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => {
                if (dragId) move.mutate({ id: dragId, status: col.key });
                setDragId(null);
                setOverCol(null);
              }}
              className={`rounded-xl border p-2 transition-colors ${
                overCol === col.key ? "border-primary bg-accent/40" : "border-border bg-muted/30"
              }`}
            >
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {col.label} ({items.length})
              </p>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="group relative">
                    <Link
                      to="/roteiros/$id"
                      params={{ id: it.id }}
                      draggable
                      onDragStart={() => setDragId(it.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      className="block cursor-grab rounded-lg border border-border bg-card p-2 pr-8 text-sm hover:border-primary active:cursor-grabbing"
                    >
                      <p className="font-medium">{it.title}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(it.budget)}</p>
                    </Link>
                    <button
                      type="button"
                      aria-label="Excluir roteiro"
                      onClick={() => handleRemoveItinerary(it.id, it.title)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-2 text-xs text-muted-foreground/60">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {

  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v || "—"}</dd>
    </div>
  );
}
