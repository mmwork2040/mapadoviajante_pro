import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Send, Trash2, Plus, Check, Map } from "lucide-react";
import { toast } from "sonner";
import {
  createItinerary,
  createLeadActivity,
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
import { formatCurrency, formatDate, maskPhone } from "@/lib/ui";
import type { Itinerary, Lead, LeadStatus } from "@/lib/types";
import { QueryError } from "@/components/QueryError";

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

const PROFILE_FIELDS: { key: string; label: string; type?: "date" | "currency" }[] = [
  { key: "birthday", label: "Aniversário", type: "date" },
  { key: "document", label: "Documento" },
  { key: "city", label: "Cidade" },
  { key: "preferences", label: "Preferências" },
  { key: "budget_range", label: "Faixa de orçamento", type: "currency" },
];

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return formatCurrency(Number(digits) / 100);
}

function LeadDetailPage() {
  const { leadId } = useParams({ from: "/_app/leads/$leadId" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [note, setNote] = useState("");

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
    if (!confirm("Excluir este lead?")) return;
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

  const profile = (lead.profile || {}) as Record<string, string>;
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
        <button onClick={remove} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" /> Excluir
        </button>
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
          <ProfileCard profile={profile} onSave={(p) => update.mutate({ profile: p })} />
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
    </div>
  );
}

function ProfileCard({
  profile,
  onSave,
}: {
  profile: Record<string, string>;
  onSave: (p: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(profile);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 font-semibold">Perfil do viajante</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROFILE_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium">{f.label}</span>
            <input
              type={f.type === "date" ? "date" : "text"}
              inputMode={f.type === "currency" ? "numeric" : undefined}
              value={
                f.type === "currency"
                  ? formatCurrencyInput(draft[f.key] || "")
                  : draft[f.key] || ""
              }
              onChange={(e) =>
                setDraft({
                  ...draft,
                  [f.key]:
                    f.type === "currency"
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value,
                })
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>
      {dirty && (
        <button
          onClick={() => onSave(draft)}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Salvar perfil
        </button>
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

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v || "—"}</dd>
    </div>
  );
}
