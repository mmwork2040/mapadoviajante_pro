import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createLeadActivity,
  deleteLead,
  fetchLeadActivities,
  fetchLeadById,
  updateLead,
} from "@/lib/services";
import { formatCurrency, formatDate } from "@/lib/ui";
import type { LeadStatus } from "@/lib/types";
import { useNavigate } from "@tanstack/react-router";
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

  const setStatus = useMutation({
    mutationFn: (status: LeadStatus) => updateLead(leadId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const addNote = useMutation({
    mutationFn: () =>
      createLeadActivity(leadId, { type: "note", title: "Anotação", details: note }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    },
    onError: () => toast.error("Erro ao salvar anotação."),
  });

  async function remove() {
    if (!confirm("Excluir este lead?")) return;
    await deleteLead(leadId);
    toast.success("Lead excluído.");
    navigate({ to: "/leads" });
  }

  if (isError) return <QueryError message="Não foi possível carregar o lead." onRetry={() => refetch()} />;
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!lead) return <p>Lead não encontrado.</p>;

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
              <Row k="Telefone" v={lead.phone} />
              <Row k="Valor" v={formatCurrency(lead.value)} />
              <Row k="Origem" v={lead.origin} />
              <Row k="Criado em" v={formatDate(lead.created_at)} />
            </dl>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus.mutate(s.key)}
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
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
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
            {activities.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma atividade ainda.</li>
            )}
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
