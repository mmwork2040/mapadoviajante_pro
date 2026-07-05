import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { getNotifConfig, configIsComplete, requestPushToken, startTokenRefreshWatcher, getDeviceId, getDeviceLabel } from "@/lib/notifications";
import { saveDeviceToken } from "@/lib/push.functions";

/**
 * Banner que solicita permissão de notificações a partir de um toque do usuário.
 * Navegadores mobile só exibem o prompt em resposta a um gesto, por isso o pedido
 * automático no login é ignorado — este botão resolve isso.
 */
export function NotifPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (window.self !== window.top) return; // preview/iframe
    if (Notification.permission !== "default") return;
    void getNotifConfig().then((c) => {
      if (c.enabled && configIsComplete(c)) setShow(true);
    });
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const config = await getNotifConfig();
      const res = await requestPushToken(config);
      if (res.ok && res.token) {
        await saveDeviceToken({ data: { token: res.token, deviceId: getDeviceId(), label: getDeviceLabel() } });
        startTokenRefreshWatcher();
        setShow(false);
      } else {
        setMsg(res.message);
      }
    } catch {
      setMsg("Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-accent/60 p-3 sm:flex-row sm:items-center">
      <Bell className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Ativar notificações</p>
        <p className="text-muted-foreground">{msg ?? "Receba avisos de leads, tarefas e mais neste dispositivo."}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Ativando…" : "Ativar"}
        </button>
        <button
          onClick={() => setShow(false)}
          aria-label="Dispensar"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
