import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Gauge, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { useAuth, isSuperAdminEmail } from "@/lib/auth";
import { getAiUsageOverview, saveAiQuota, type AgencyAiUsageRow } from "@/lib/platform.functions";

export const Route = createFileRoute("/_app/plataforma")({
  component: PlatformPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR");
const limitLabel = (n: number) => (n === 0 ? "Sem limite" : `${fmt(n)} tokens`);

function PlatformPage() {
  const { session } = useAuth();
  if (!isSuperAdminEmail(session?.user?.email)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta área é só para o super admin da plataforma.</p>
      </div>
    );
  }
  return <PlatformContent />;
}

function PlatformContent() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ai-usage-overview"], queryFn: () => getAiUsageOverview() });
  const [defaultLimit, setDefaultLimit] = useState("");

  useEffect(() => {
    if (q.data) setDefaultLimit(String(q.data.defaultMonthlyTokens));
  }, [q.data]);

  const save = useMutation({
    mutationFn: (payload: { defaultMonthlyTokens?: number; agencyId?: string; agencyLimit?: number | null }) =>
      saveAiQuota({ data: payload }),
    onSuccess: () => {
      toast.success("Limite salvo.");
      qc.invalidateQueries({ queryKey: ["ai-usage-overview"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  if (q.isError) return <QueryError message="Não foi possível carregar o consumo de IA." onRetry={() => q.refetch()} />;
  if (q.isLoading || !q.data) return <p className="text-muted-foreground">Carregando…</p>;
  const data = q.data;
  const total = data.rows.reduce((s, r) => s + r.totalTokens, 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={Gauge} title="Plataforma" subtitle="Consumo de IA das agências e limites mensais." />

      {!data.platform && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          A chave de IA da plataforma não está configurada na Vercel (OPENAI_API_KEY ou AI_GATEWAY_API_KEY).
          Sem ela, cada agência usa a própria chave e não há controle de consumo aqui.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Mês" value={data.month} />
        <Stat label="Tokens usados (todas as agências)" value={fmt(total)} />
        <Stat label="Modelo" value={data.model ?? "—"} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Limite padrão por agência</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens por mês para agências sem limite próprio. Use 0 para sem limite.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            step={100000}
            value={defaultLimit}
            onChange={(e) => setDefaultLimit(e.target.value)}
            className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Limite padrão de tokens por mês"
          />
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ defaultMonthlyTokens: Math.max(0, Math.round(Number(defaultLimit) || 0)) })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> Salvar padrão
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Consumo por agência</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Agência</th>
                <th className="px-4 py-2 text-right font-medium">Tokens no mês</th>
                <th className="px-4 py-2 text-right font-medium">Pedidos</th>
                <th className="px-4 py-2 font-medium">Limite</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <AgencyRow key={r.agencyId} row={r} onSave={(agencyLimit) => save.mutate({ agencyId: r.agencyId, agencyLimit })} />
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma agência encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AgencyRow({ row, onSave }: { row: AgencyAiUsageRow; onSave: (limit: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.limit));
  const pct = row.limit > 0 ? Math.min(100, Math.round((row.totalTokens / row.limit) * 100)) : 0;
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3 font-medium">{row.name}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {fmt(row.totalTokens)}
        {row.limit > 0 && (
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
            <div
              className={`h-1.5 rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{fmt(row.requests)}</td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              step={100000}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-36 rounded-lg border border-border bg-background px-2 py-1 text-sm"
              aria-label={`Limite de ${row.name}`}
            />
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              onClick={() => {
                onSave(Math.max(0, Math.round(Number(value) || 0)));
                setEditing(false);
              }}
            >
              Salvar
            </button>
            {row.customLimit && (
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1 text-xs"
                onClick={() => {
                  onSave(null);
                  setEditing(false);
                }}
              >
                Usar padrão
              </button>
            )}
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="text-left hover:underline" onClick={() => setEditing(true)}>
            {limitLabel(row.limit)}
            <span className="ml-1 text-xs text-muted-foreground">{row.customLimit ? "(próprio)" : "(padrão)"}</span>
          </button>
        )}
      </td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
    </div>
  );
}
