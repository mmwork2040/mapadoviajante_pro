import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, Globe, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createDestination, deleteDestination, fetchDestinations, updateDestination } from "@/lib/services";
import { formatCurrency } from "@/lib/ui";
import type { Destination } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_app/biblioteca")({
  component: LibraryPage,
});

function LibraryPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Destination | null>(null);
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["destinations"],
    queryFn: fetchDestinations,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["destinations"] });

  async function remove(d: Destination) {
    if (!confirm(`Excluir "${d.title || d.name}"?`)) return;
    const ok = await deleteDestination(d.id);
    if (ok) {
      toast.success("Destino excluído.");
      invalidate();
    } else toast.error("Erro ao excluir destino.");
  }

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

      {isError ? (
        <QueryError message="Não foi possível carregar os destinos." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum destino cadastrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <div key={d.id} className="group overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative">
                {d.image_url ? (
                  <img src={d.image_url} alt={d.title || d.name || ""} className="h-36 w-full object-cover" />
                ) : (
                  <div className="flex h-36 items-center justify-center bg-accent text-accent-foreground">
                    <Globe className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditing(d)} className="rounded-lg bg-card/90 p-1.5 text-foreground hover:bg-card">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(d)} className="rounded-lg bg-card/90 p-1.5 text-destructive hover:bg-card">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{d.title || d.name}</h3>
                <p className="text-sm text-muted-foreground">{d.country || d.category || "—"}</p>
                {d.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>}
                <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(d.base_price)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {(open || editing) && (
        <DestinationModal
          destination={editing}
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

function DestinationModal({
  destination,
  onClose,
  onSaved,
}: {
  destination: Destination | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Destination>>(
    destination || { base_price: 0, days: 1 },
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = destination ? await updateDestination(destination.id, form) : await createDestination(form);
    setSaving(false);
    if (res) {
      toast.success(destination ? "Destino atualizado!" : "Destino adicionado!");
      onSaved();
    } else toast.error("Erro ao salvar destino.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{destination ? "Editar Destino" : "Novo Destino"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Fld label="Título" required value={form.title || form.name || ""} onChange={(v) => setForm({ ...form, title: v })} />
          <Fld label="País" value={form.country || ""} onChange={(v) => setForm({ ...form, country: v })} />
          <Fld label="Categoria" value={form.category || ""} onChange={(v) => setForm({ ...form, category: v })} />
          <Fld label="Imagem (URL)" value={form.image_url || ""} onChange={(v) => setForm({ ...form, image_url: v })} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Descrição</span>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Preço base" type="number" value={String(form.base_price ?? "")} onChange={(v) => setForm({ ...form, base_price: Number(v) })} />
            <Fld label="Dias" type="number" value={String(form.days ?? "")} onChange={(v) => setForm({ ...form, days: Number(v) })} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : destination ? "Salvar" : "Adicionar"}
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
