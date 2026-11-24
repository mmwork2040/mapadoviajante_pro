import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Gauge, Save, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { useAuth, isSuperAdminEmail } from "@/lib/auth";
import { getAiUsageOverview, saveAiQuota, type AgencyAiUsageRow } from "@/lib/platform.functions";
import {
  changeGrantEmail,
  grantAccessManually,
  listAccessGrants,
  setAccessOverride,
} from "@/lib/access.functions";

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
      <PageHeader icon={Gauge} title="Plataforma" subtitle="Acessos, consumo de IA e limites das agências." />

      <AccessSection />

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

// ── Liberações de acesso (Hotmart e manual) ──────────────────────

const OVERRIDE_LABEL: Record<string, string> = {
  none: "segue a Hotmart",
  force_active: "liberado à mão",
  force_suspended: "suspenso à mão",
};

const RESULT_LABEL: Record<string, string> = { applied: "aplicado", ignored: "ignorado", error: "erro" };

function AccessSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["access-grants"], queryFn: () => listAccessGrants() });
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["access-grants"] });
  const onError = (err: unknown) => toast.error(err instanceof Error ? err.message : "Erro ao salvar.");

  const grant = useMutation({
    mutationFn: () => grantAccessManually({ data: { email: email.trim(), note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Acesso liberado. A pessoa já pode entrar com esse e-mail.");
      setEmail("");
      setNote("");
      refresh();
    },
    onError,
  });
  const override = useMutation({
    mutationFn: (v: { email: string; override: "none" | "force_active" | "force_suspended" }) =>
      setAccessOverride({ data: v }),
    onSuccess: () => {
      toast.success("Acesso atualizado.");
      refresh();
    },
    onError,
  });
  const rename = useMutation({
    mutationFn: (v: { from: string; to: string }) => changeGrantEmail({ data: v }),
    onSuccess: () => {
      toast.success("E-mail trocado.");
      refresh();
    },
    onError,
  });

  if (q.isError) return <QueryError message="Não foi possível carregar as liberações." onRetry={() => q.refetch()} />;
  const data = q.data;
  const term = search.trim().toLowerCase();
  const grants = (data?.grants ?? []).filter((g) => !term || g.email.includes(term));
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/hotmart-webhook` : "";

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Liberação de acesso</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Conta nova só vira agência com liberação: automática pela compra na Hotmart ou manual aqui. Agências que já
        existiam continuam funcionando.
      </p>

      <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <p>
          <strong>Webhook da Hotmart:</strong> {data?.webhookConfigured ? "token configurado" : "falta HOTMART_HOTTOK na Vercel"}
          {data?.productFilter ? ` · produtos: ${data.productFilter}` : " · todos os produtos"}
        </p>
        <p className="mt-1 break-all">
          URL para cadastrar na Hotmart: <code className="text-foreground">{webhookUrl}</code>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Liberar e-mail manualmente</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Observação (opcional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: cortesia, parceiro…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!email.trim() || grant.isPending}
          onClick={() => grant.mutate()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Liberar acesso
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por e-mail…"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">E-mail</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 font-medium">Origem</th>
              <th className="px-3 py-2 font-medium">Agência</th>
              <th className="px-3 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-muted-foreground">Carregando…</td>
              </tr>
            )}
            {grants.map((g) => (
              <tr key={g.email} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{g.email}</p>
                  {g.note && <p className="text-xs text-muted-foreground">{g.note}</p>}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      g.active ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {g.active ? "Ativo" : "Suspenso"}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">{OVERRIDE_LABEL[g.override] ?? g.override}</p>
                </td>
                <td className="px-3 py-2 text-xs">
                  {g.source === "hotmart" ? "Hotmart" : "Manual"}
                  {g.lastEvent && <p className="text-muted-foreground">{g.lastEvent}</p>}
                </td>
                <td className="px-3 py-2 text-xs">{g.agencyId ? "criada" : "ainda não entrou"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {g.active ? (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => override.mutate({ email: g.email, override: "force_suspended" })}
                      >
                        Suspender
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => override.mutate({ email: g.email, override: "force_active" })}
                      >
                        Reativar
                      </button>
                    )}
                    {g.override !== "none" && g.source === "hotmart" && (
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => override.mutate({ email: g.email, override: "none" })}
                      >
                        Seguir a Hotmart
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => {
                        const to = window.prompt(`Novo e-mail para a liberação de ${g.email}:`)?.trim();
                        if (to) rename.mutate({ from: g.email, to });
                      }}
                    >
                      Trocar e-mail
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!q.isLoading && grants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nenhuma liberação ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Últimos avisos da Hotmart ({data?.events.length ?? 0})</summary>
        <ul className="mt-2 space-y-1 text-xs">
          {(data?.events ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2 border-t border-border pt-1">
              <span className="text-muted-foreground">{new Date(e.receivedAt).toLocaleString("pt-BR")}</span>
              <strong>{e.event}</strong>
              <span>{e.email ?? "sem e-mail"}</span>
              <span className={e.result === "error" ? "text-destructive" : "text-muted-foreground"}>
                {RESULT_LABEL[e.result] ?? e.result}: {e.detail}
              </span>
            </li>
          ))}
          {(data?.events ?? []).length === 0 && <li className="text-muted-foreground">Nenhum aviso recebido.</li>}
        </ul>
      </details>
    </section>
  );
}
