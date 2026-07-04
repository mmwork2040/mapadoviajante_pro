import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, MapPin, Trash2, MoreVertical, Copy } from "lucide-react";
import { toast } from "sonner";
import { createItinerary, deleteItinerary, duplicateItinerary, fetchItineraries, fetchLeads } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, formatDate, maskCurrency, parseCurrency } from "@/lib/ui";
import type { Itinerary } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { useConfirm } from "@/components/ConfirmDialog";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roteiros</h1>
          <p className="text-sm text-muted-foreground">Planejamento dia a dia das viagens.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo Roteiro
        </button>
      </div>

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
                className="block rounded-2xl border border-border bg-card p-5 transition hover:shadow-md"
              >
                <div className="flex items-center gap-2 text-primary">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">{it.status}</span>
                </div>
                <h3 className="mt-2 pr-8 font-semibold">{it.title}</h3>
                <p className="text-sm text-muted-foreground">{it.destination || "—"}</p>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>{formatDate(it.start_date)}</span>
                  <span className="font-semibold text-foreground">{formatCurrency(it.budget)}</span>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="Mais opções"
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
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
  const [saving, setSaving] = useState(false);
  const { data: leads = [] } = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}) });

  function selectLead(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) {
      setForm((f) => ({ ...f, lead_id: null }));
      return;
    }
    setForm((f) => ({
      ...f,
      lead_id: lead.id,
      client_name: lead.name,
      destination: f.destination || lead.destination || "",
      budget: f.budget || Number(lead.value) || 0,
      title: f.title || `Roteiro - ${lead.name}`,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lead_id) {
      toast.error("Selecione um lead.");
      return;
    }
    setSaving(true);
    const res = await createItinerary(form);
    setSaving(false);
    if (res) {
      dispatchWebhook("itinerary.created", res);
      toast.success("Roteiro criado!");
      onCreated();
    } else toast.error("Erro ao criar roteiro.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo Roteiro</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Lead</span>
            <select
              required
              value={form.lead_id || ""}
              onChange={(e) => selectLead(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Selecione um lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <F label="Título" required value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />
          <F label="Destino" value={form.destination || ""} onChange={(v) => setForm({ ...form, destination: v })} />

          <div className="grid grid-cols-2 gap-3">
            <F label="Início" type="date" value={form.start_date || ""} onChange={(v) => setForm({ ...form, start_date: v })} />
            <F label="Fim" type="date" value={form.end_date || ""} onChange={(v) => setForm({ ...form, end_date: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Passageiros" type="number" value={String(form.passengers ?? "")} onChange={(v) => setForm({ ...form, passengers: Number(v) })} />
            <F label="Orçamento" format="currency" value={String(form.budget ?? "")} onChange={(v) => setForm({ ...form, budget: Number(v) })} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
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
