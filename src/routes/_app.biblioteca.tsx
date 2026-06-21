import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, Globe } from "lucide-react";
import { toast } from "sonner";
import { createDestination, fetchDestinations } from "@/lib/services";
import { formatCurrency } from "@/lib/ui";
import type { Destination } from "@/lib/types";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/biblioteca")({
  component: LibraryPage,
});

function LibraryPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["destinations"],
    queryFn: fetchDestinations,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">Destinos e pacotes reutilizáveis.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo Destino
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum destino cadastrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <div key={d.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {d.image_url ? (
                <img src={d.image_url} alt={d.title || d.name || ""} className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 items-center justify-center bg-accent text-accent-foreground">
                  <Globe className="h-8 w-8" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold">{d.title || d.name}</h3>
                <p className="text-sm text-muted-foreground">{d.country || d.category || "—"}</p>
                <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(d.base_price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <NewDestinationModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["destinations"] });
          }}
        />
      )}
    </div>
  );
}

function NewDestinationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Partial<Destination>>({ base_price: 0, days: 1 });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createDestination(form);
    setSaving(false);
    if (res) {
      toast.success("Destino adicionado!");
      onCreated();
    } else toast.error("Erro ao salvar destino.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Novo Destino</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Fld label="Título" required value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />
          <Fld label="País" value={form.country || ""} onChange={(v) => setForm({ ...form, country: v })} />
          <Fld label="Categoria" value={form.category || ""} onChange={(v) => setForm({ ...form, category: v })} />
          <Fld label="Imagem (URL)" value={form.image_url || ""} onChange={(v) => setForm({ ...form, image_url: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Preço base" type="number" value={String(form.base_price ?? "")} onChange={(v) => setForm({ ...form, base_price: Number(v) })} />
            <Fld label="Dias" type="number" value={String(form.days ?? "")} onChange={(v) => setForm({ ...form, days: Number(v) })} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Adicionar"}
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
