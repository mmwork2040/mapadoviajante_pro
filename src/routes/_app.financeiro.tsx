import { createFileRoute } from "@tanstack/react-router";
import { ScrollLock } from "@/components/ScrollLock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, X, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { createTransaction, fetchTransactions } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, formatDate, maskCurrency, parseCurrency } from "@/lib/ui";
import type { Transaction, TxType } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { useAuth, isAdminUser } from "@/lib/auth";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export const Route = createFileRoute("/_app/financeiro")({
  component: FinancePage,
});

const CATEGORIES = ["pacote", "comissao", "operacional", "marketing"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function FinancePage() {
  const { member, session } = useAuth();
  if (!isAdminUser(member, session?.user?.email)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A área Financeiro está disponível apenas para administradores.
        </p>
      </div>
    );
  }
  return <FinanceContent />;
}

function FinanceContent() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: txs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["transactions", { typeFilter, from, to }],
    queryFn: () =>
      fetchTransactions({
        type: typeFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const commissions = txs
    .filter((t) => t.type === "income" && t.category === "comissao")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const netProfit = commissions - expense;

  const chart = useMemo(() => {
    const now = new Date();
    const months: { y: number; m: number; label: string; revenue: number; commission: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), label: MONTH_LABELS[d.getMonth()], revenue: 0, commission: 0 });
    }
    txs.forEach((t) => {
      if (t.type !== "income" || !t.transaction_date) return;
      const d = new Date(t.transaction_date);
      const bucket = months.find((b) => b.y === d.getFullYear() && b.m === d.getMonth());
      if (!bucket) return;
      bucket.revenue += Number(t.amount);
      if (t.category === "comissao") bucket.commission += Number(t.amount);
    });
    return {
      labels: months.map((b) => b.label),
      datasets: [
        { label: "Receitas", data: months.map((b) => b.revenue), backgroundColor: "#ff7a1a", borderRadius: 6 },
        { label: "Comissões", data: months.map((b) => b.commission), backgroundColor: "#2563eb", borderRadius: 6 },
      ],
    };
  }, [txs]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        subtitle="Receitas, comissões e despesas da agência."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Nova Transação
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Receita Total" value={formatCurrency(income)} tone="text-[var(--success)]" />
        <Stat label="Comissões" value={formatCurrency(commissions)} tone="text-primary" />
        <Stat label="Despesas" value={formatCurrency(expense)} tone="text-destructive" />
        <Stat label="Lucro Líquido" value={formatCurrency(netProfit)} tone={netProfit >= 0 ? "text-[var(--success)]" : "text-destructive"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Receitas vs Comissões (6 meses)</h2>
        <div className="h-64">
          <Bar
            data={chart}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom" } },
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Histórico</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            >
              <option value="">Todos os tipos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        {isError ? (
          <QueryError message="Não foi possível carregar as transações." onRetry={() => refetch()} />
        ) : isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="space-y-3 md:hidden">
              {txs.length === 0 && (
                <p className="py-3 text-muted-foreground">Nenhuma transação.</p>
              )}
              {txs.map((t) => (
                <div key={t.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 font-medium">
                      {t.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--success)]" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span className="truncate">{t.description || "—"}</span>
                    </span>
                    <span className={`shrink-0 font-semibold ${t.type === "income" ? "text-[var(--success)]" : "text-destructive"}`}>
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="capitalize">{t.category || "—"} · {t.status === "confirmed" ? "Confirmado" : "Pendente"}</span>
                    <span>{formatDate(t.transaction_date)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2">Descrição</th>
                    <th className="pb-2">Categoria</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Data</th>
                    <th className="pb-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-muted-foreground">
                        Nenhuma transação.
                      </td>
                    </tr>
                  )}
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
                      <td className="py-2 capitalize text-muted-foreground">{t.category || "—"}</td>
                      <td className="py-2 text-muted-foreground">{t.status === "confirmed" ? "Confirmado" : "Pendente"}</td>
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
          </>
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
    category: "pacote",
    status: "confirmed",
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await createTransaction(form);
    setSaving(false);
    if (res) {
      dispatchWebhook("transaction.created", res);
      toast.success("Transação registrada!");
      onCreated();
    } else toast.error("Erro ao registrar.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <ScrollLock />
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
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Categoria</span>
            <select
              value={form.category || ""}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-primary"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="confirmed">Confirmado</option>
              <option value="pending">Pendente</option>
            </select>
          </label>
          <FF label="Descrição" value={form.description || ""} onChange={(v) => setForm({ ...form, description: v })} />
          <FF label="Valor" format="currency" value={String(form.amount ?? "")} onChange={(v) => setForm({ ...form, amount: Number(v) })} />
          <FF label="Data" type="date" value={form.transaction_date || ""} onChange={(v) => setForm({ ...form, transaction_date: v })} />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
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
  format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  format?: "currency";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={format ? "text" : type}
        inputMode={format ? "numeric" : undefined}
        value={format === "currency" ? maskCurrency(String(Math.round((Number(value) || 0) * 100))) : value}
        onChange={(e) => onChange(format === "currency" ? String(parseCurrency(e.target.value)) : e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
