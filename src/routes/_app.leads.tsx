import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createLead, fetchLeads, updateLead } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency } from "@/lib/ui";
import type { Lead, LeadStatus } from "@/lib/types";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
});

const COLUMNS: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Novos" },
  { key: "contacted", label: "Contatados" },
  { key: "negotiating", label: "Negociando" },
  { key: "closed", label: "Fechados" },
  { key: "lost", label: "Perdidos" },
];

function LeadsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", { search }],
    queryFn: () => fetchLeads({ search: search || undefined }),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      updateLead(id, { status }),
    onSuccess: (_res, vars) => {
      dispatchWebhook("lead.status_changed", { id: vars.id, status: vars.status });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  function onDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) move.mutate({ id, status });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Funil de vendas (arraste para mover).</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail, destino…"
            className="w-56 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo Lead
          </button>
        </div>
      </div>


      {isError ? (
        <QueryError message="Não foi possível carregar os leads." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = leads.filter((l) => l.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, col.key)}
                className="flex flex-col rounded-2xl border border-border bg-muted/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((l) => (
                    <LeadCard key={l.id} lead={l} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <NewLeadModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      to="/leads/$leadId"
      params={{ leadId: lead.id }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
      className="block cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <p className="font-medium">{lead.name}</p>
      <p className="text-xs text-muted-foreground">{lead.destination || "Sem destino"}</p>
      <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(lead.value)}</p>
    </Link>
  );
}

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Partial<Lead>>({ status: "new", value: 0 });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createLead(form);
    setSaving(false);
    if (res) {
      toast.success("Lead criado!");
      onCreated();
    } else toast.error("Erro ao criar lead.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <ModalField label="Nome" required value={form.name || ""} onChange={(v) => setForm({ ...form, name: v })} />
          <ModalField label="E-mail" value={form.email || ""} onChange={(v) => setForm({ ...form, email: v })} />
          <ModalField label="Telefone" value={form.phone || ""} onChange={(v) => setForm({ ...form, phone: v })} />
          <ModalField label="Destino" value={form.destination || ""} onChange={(v) => setForm({ ...form, destination: v })} />
          <ModalField label="Valor (R$)" type="number" value={String(form.value ?? "")} onChange={(v) => setForm({ ...form, value: Number(v) })} />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Criar Lead"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ModalField({
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
