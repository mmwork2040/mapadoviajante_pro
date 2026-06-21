import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, CircleDollarSign, ListChecks } from "lucide-react";
import { fetchDashboardStats } from "@/lib/services";
import { formatCurrency, formatDate } from "@/lib/ui";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  negotiating: "Negociando",
  closed: "Fechado",
  lost: "Perdido",
};

function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboardStats,
  });

  if (isError) {
    return <QueryError message="Não foi possível carregar o painel." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Carregando painel…</p>;
  }

  const cards = [
    { label: "Total de Leads", value: data.totalLeads, icon: Users, tone: "text-info" },
    { label: "Em Negociação", value: data.negotiating, icon: TrendingUp, tone: "text-primary" },
    {
      label: "Vendas Fechadas",
      value: formatCurrency(data.totalSales),
      icon: CircleDollarSign,
      tone: "text-[var(--success)]",
    },
    { label: "Tarefas Pendentes", value: data.pendingTasks, icon: ListChecks, tone: "text-warning" },
  ];

  const maxRev = Math.max(1, ...data.chartData.revenue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua operação.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
            <c.icon className={`h-5 w-5 ${c.tone}`} />
            <p className="mt-3 text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Receita por período</h2>
          <div className="flex h-48 items-end gap-2">
            {data.chartData.labels.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-primary/80"
                  style={{ height: `${(data.chartData.revenue[i] / maxRev) * 100}%` }}
                  title={formatCurrency(data.chartData.revenue[i])}
                />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Tarefas pendentes</h2>
          <ul className="space-y-3">
            {data.tasks.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma tarefa pendente 🎉</li>
            )}
            {data.tasks.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(t.due_date)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Leads recentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Destino</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.slice(0, 8).map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-2 font-medium">{l.name}</td>
                  <td className="py-2 text-muted-foreground">{l.destination || "—"}</td>
                  <td className="py-2">{formatCurrency(l.value)}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {STATUS_LABEL[l.status] || l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
