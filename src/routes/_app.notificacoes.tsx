import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotificationsPage,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getMemberId,
} from "@/lib/services";
import { formatDate } from "@/lib/ui";
import type { AppNotification } from "@/lib/types";

const PAGE_SIZE = 15;

type NotifSearch = { page: number; q: string; filter: string; order: string };

export const Route = createFileRoute("/_app/notificacoes")({
  validateSearch: (search: Record<string, unknown>): NotifSearch => ({
    page: typeof search.page === "number" ? search.page : Number(search.page) || 1,
    q: typeof search.q === "string" ? search.q : "",
    filter: typeof search.filter === "string" ? search.filter : "all",
    order: typeof search.order === "string" ? search.order : "desc",
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const navigate = useNavigate({ from: "/notificacoes" });
  const { page, q, filter, order } = Route.useSearch();
  const qc = useQueryClient();
  const [term, setTerm] = useState(q);

  const filterVal = (["all", "unread", "read"].includes(filter) ? filter : "all") as
    | "all"
    | "unread"
    | "read";
  const orderVal = (order === "asc" ? "asc" : "desc") as "asc" | "desc";
  const safePage = Math.max(1, page);

  const { data, isFetching } = useQuery({
    queryKey: ["notifications-page", safePage, q, filterVal, orderVal],
    queryFn: () =>
      fetchNotificationsPage({
        page: safePage,
        pageSize: PAGE_SIZE,
        search: q,
        filter: filterVal,
        order: orderVal,
      }),
    refetchInterval: 30000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const memberId = getMemberId();
    if (!memberId) return;
    const channel = supabase
      .channel("notifications-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_notifications", filter: `recipient_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications-page"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications-page"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  function setSearch(patch: Partial<{ page: number; q: string; filter: string; order: string }>) {
    navigate({ search: (prev: NotifSearch) => ({ ...prev, ...patch }) });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch({ q: term, page: 1 });
  }

  async function openNotification(n: AppNotification) {
    if (!n.read) {
      await markNotificationRead(n.id, true);
      invalidate();
    }
    if (n.link) {
      const [path, query] = n.link.split("?");
      const s: Record<string, string> = {};
      if (query) {
        for (const part of query.split("&")) {
          const [k, v] = part.split("=");
          if (k) s[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
        }
      }
      navigate({ to: path, search: s });
    }
  }

  const filters: { key: "all" | "unread" | "read"; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: "Não lidas" },
    { key: "read", label: "Lidas" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Notificações</h1>
        </div>
        <button
          onClick={async () => {
            await markAllNotificationsRead();
            invalidate();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <CheckCheck className="h-4 w-4" />
          Marcar todas
        </button>
      </div>

      <form onSubmit={submitSearch} className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar notificações…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Buscar
        </button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setSearch({ filter: f.key, page: 1 })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filterVal === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSearch({ order: orderVal === "desc" ? "asc" : "desc", page: 1 })}
          className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
        >
          Data: {orderVal === "desc" ? "Mais recentes" : "Mais antigas"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {isFetching ? "Carregando…" : "Nenhuma notificação encontrada."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li
                key={n.id}
                className={`group flex gap-3 px-4 py-3 transition hover:bg-muted/50 ${
                  n.read ? "" : "bg-primary/5"
                }`}
              >
                <button onClick={() => openNotification(n)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <p className="truncate text-sm font-medium">{n.title}</p>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {n.actor?.name ? `${n.actor.name} · ` : ""}
                    {formatDate(n.created_at)}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.read && (
                    <button
                      onClick={async () => {
                        await markNotificationRead(n.id, true);
                        invalidate();
                      }}
                      title="Marcar como lida"
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await deleteNotification(n.id);
                      invalidate();
                    }}
                    title="Excluir"
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total} notificaç{total === 1 ? "ão" : "ões"} · página {safePage} de {totalPages}
          </p>
          <div className="flex gap-1.5">
            <button
              disabled={safePage <= 1}
              onClick={() => setSearch({ page: safePage - 1 })}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setSearch({ page: safePage + 1 })}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
