import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { createTransaction, fetchTransactions } from "@/lib/services";
import { formatCurrency, formatDate } from "@/lib/ui";
import type { Transaction, TxType } from "@/lib/types";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinancePage,
});

function FinancePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => fetchTransactions({}),
  });

  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Receitas e despesas da agência.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova Transação
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Receitas" value={formatCurrency(income)} tone="text-[var(--success)]" />
        <Stat label="Despesas" value={formatCurrency(expense)} tone="text-destructive" />
        <Stat label="Saldo" value={formatCurrency(income - expense)} tone="text-primary" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Histórico</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Descrição</th>
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2">Data</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {t.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 text-[var(--success)]" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        )}
                        {t.description || "—"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{t.category || "—"}</td>
                    <td className="py-2 text-muted-foreground">{formatDate(t.transaction_date)}</td>
                    <td className={`py-2 text-right font-semibold ${t.type === "income" ? "text-[var(--success)]" : "text-destructive"}`}>
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <NewTxModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["transactions"] });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function NewTxModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Partial<Transaction>>({
    type: "income",
    amount: 0,
    status: "completed",
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createTransaction(form);
    setSaving(false);
    if (res) {
      toast.success("Transação registrada!");
      onCreated();
    } else toast.error("Erro ao registrar.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Nova Transação</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TxType })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </label>
          <FF label="Descrição" value={form.description || ""} onChange={(v) => setForm({ ...form, description: v })} />
          <FF label="Categoria" value={form.category || ""} onChange={(v) => setForm({ ...form, category: v })} />
          <FF label="Valor" type="number" value={String(form.amount ?? "")} onChange={(v) => setForm({ ...form, amount: Number(v) })} />
          <FF label="Data" type="date" value={form.transaction_date || ""} onChange={(v) => setForm({ ...form, transaction_date: v })} />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Registrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FF({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
