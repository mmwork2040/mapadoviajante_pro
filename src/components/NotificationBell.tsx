import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, List, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getMemberId,
} from "@/lib/services";
import { formatDate } from "@/lib/ui";
import { useBackButtonClose } from "@/hooks/useBackButtonClose";
import type { AppNotification } from "@/lib/types";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  useBackButtonClose(open, () => setOpen(false));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const memberId = getMemberId();
    if (!memberId) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_notifications", filter: `recipient_id=eq.${memberId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  async function openNotification(n: AppNotification) {
    if (!n.read) {
      await markNotificationRead(n.id, true);
      invalidate();
    }
    if (n.link) {
      setOpen(false);
      const [path, query] = n.link.split("?");
      const search: Record<string, string> = {};
      if (query) {
        for (const part of query.split("&")) {
          const [k, v] = part.split("=");
          if (k) search[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
        }
      }
      navigate({ to: path, search });
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed left-2 right-2 top-16 z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-sm font-semibold">Notificações</p>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={async () => {
                      await markAllNotificationsRead();
                      invalidate();
                    }}
                    title="Marcar todas como lidas"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`group flex gap-2 px-3 py-2.5 transition hover:bg-muted/50 ${
                        n.read ? "" : "bg-primary/5"
                      }`}
                    >
                      <button
                        onClick={() => openNotification(n)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                          <p className="truncate text-sm font-medium">{n.title}</p>
                        </div>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {n.actor?.name ? `${n.actor.name} · ` : ""}
                          {formatDate(n.created_at)}
                        </p>
                      </button>
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        {!n.read && (
                          <button
                            onClick={async () => {
                              await markNotificationRead(n.id, true);
                              invalidate();
                            }}
                            title="Marcar como lida"
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-primary"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            await deleteNotification(n.id);
                            invalidate();
                          }}
                          title="Excluir"
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="text-destructive h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => {
                setOpen(false);
                navigate({ to: "/notificacoes" });
              }}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2.5 text-sm font-medium text-primary hover:bg-muted"
            >
              <List className="h-4 w-4" />
              Ver todas as notificações
            </button>
          </div>
        </>
      )}
    </div>
  );
}
