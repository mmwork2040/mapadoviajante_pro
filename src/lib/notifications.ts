import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";
import { saveDeviceToken } from "@/lib/push.functions";

// ── Eventos que podem gerar notificações ───────────────────────
export const NOTIF_EVENTS = [
  { id: "lead.created", label: "Lead criado" },
  { id: "lead.status_changed", label: "Status do lead alterado" },
  { id: "task.created", label: "Tarefa criada" },
  { id: "task.completed", label: "Tarefa concluída" },
  { id: "transaction.created", label: "Transação registrada" },
  { id: "itinerary.created", label: "Roteiro criado" },
  { id: "member.invited", label: "Membro convidado" },
] as const;

export type NotifEventId = (typeof NOTIF_EVENTS)[number]["id"];

export interface NotifConfig {
  enabled: boolean;
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
  events: NotifEventId[];
}

export const DEFAULT_CONFIG: NotifConfig = {
  enabled: false,
  apiKey: "",
  authDomain: "",
  projectId: "",
  messagingSenderId: "",
  appId: "",
  vapidKey: "",
  events: [],
};

export async function getNotifConfig(): Promise<NotifConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "notifications" } });
    if (!value) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(value) as Partial<NotifConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveNotifConfig(config: NotifConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "notifications", value: JSON.stringify(config) } });
}

export function configIsComplete(c: NotifConfig): boolean {
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.messagingSenderId && c.appId && c.vapidKey && c.events.length > 0);
}

/** Solicita permissão, registra o SW do FCM e retorna o token do dispositivo. */
export async function requestPushToken(rawConfig: NotifConfig): Promise<{ ok: boolean; token?: string; message: string }> {
  // Remove espaços/quebras de linha acidentais ao colar os valores do Firebase.
  const config: NotifConfig = {
    ...rawConfig,
    apiKey: rawConfig.apiKey?.trim(),
    authDomain: rawConfig.authDomain?.trim(),
    projectId: rawConfig.projectId?.trim(),
    messagingSenderId: rawConfig.messagingSenderId?.trim(),
    appId: rawConfig.appId?.trim(),
    vapidKey: rawConfig.vapidKey?.trim(),
  };
  if (typeof window === "undefined") return { ok: false, message: "Indisponível no servidor." };
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Este navegador não suporta notificações push." };
  }
  if (!configIsComplete(config)) {
    return { ok: false, message: "Preencha todos os campos da configuração do Firebase." };
  }

  // Em preview/iframe os navegadores bloqueiam o pedido de permissão.
  const inIframe = window.self !== window.top;
  if (inIframe) {
    return {
      ok: false,
      message:
        "Abra o app publicado em uma aba (fora do preview/iframe) para ativar as notificações.",
    };
  }

  if (Notification.permission === "denied") {
    return {
      ok: false,
      message:
        "Permissão bloqueada. Habilite as notificações nas configurações do navegador (ícone de cadeado na barra de endereço) e tente novamente.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      message:
        "Permissão de notificações negada. Habilite nas configurações do navegador para este site.",
    };
  }

  // Registra o SW passando a config via query params
  const swUrl =
    "/firebase-messaging-sw.js?" +
    new URLSearchParams({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    }).toString();

  let app: FirebaseApp;
  const existing = getApps().find((a) => a.name === "push");
  if (existing) await deleteApp(existing);
  app = initializeApp(
    {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    },
    "push",
  );

  try {
    const registration = await navigator.serviceWorker.register(swUrl);

    // Aguarda o Service Worker ficar ativo antes de tentar obter o token,
    // senão o PushManager.subscribe falha ("no active Service Worker").
    await navigator.serviceWorker.ready;
    if (!registration.active) {
      await new Promise<void>((resolve) => {
        const sw = registration.installing || registration.waiting;
        if (!sw) return resolve();
        sw.addEventListener("statechange", () => {
          if (sw.state === "activated") resolve();
        });
      });
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, message: "Não foi possível obter o token do dispositivo." };
    return { ok: true, token, message: "Notificações ativadas neste dispositivo." };
  } catch (err) {
    return {
      ok: false,
      message: `Erro ao ativar: ${err instanceof Error ? err.message : "desconhecido"}`,
    };
  }
}

/**
 * Ao logar: solicita permissão de push automaticamente (se ainda não decidida),
 * captura o device token e registra no backend. Falha silenciosa em iframe/preview
 * ou quando a permissão foi negada.
 */
export async function captureDeviceTokenOnLogin(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (window.self !== window.top) return; // preview/iframe
  if (Notification.permission === "denied") return;

  try {
    const config = await getNotifConfig();
    if (!config.enabled || !configIsComplete(config)) return;
    // requestPushToken já chama Notification.requestPermission() (prompt apenas
    // quando a permissão está em "default"), registra o SW e obtém o token.
    const res = await requestPushToken(config);
    if (res.ok && res.token) {
      await saveDeviceToken({ data: { token: res.token } });
      lastKnownToken = res.token;
      startTokenRefreshWatcher();
    }
  } catch {
    // Falha silenciosa: não deve interromper o fluxo de login.
  }
}

// ── Detecção de mudança do device token (sem depender de logout/login) ──
let lastKnownToken: string | undefined;
let watcherStarted = false;

/** Verifica o token atual e atualiza o backend caso tenha mudado. */
async function checkAndSyncToken(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.self !== window.top) return;
  if (Notification.permission !== "granted") return;
  try {
    const config = await getNotifConfig();
    if (!config.enabled || !configIsComplete(config)) return;
    const res = await requestPushToken(config);
    if (res.ok && res.token && res.token !== lastKnownToken) {
      await saveDeviceToken({ data: { token: res.token } });
      lastKnownToken = res.token;
    }
  } catch {
    // Silencioso: revalida na próxima checagem.
  }
}

/**
 * Inicia o monitoramento de mudanças do device token. O FCM Web pode rotacionar
 * o token; como não há evento onTokenRefresh no SDK modular, revalidamos ao voltar
 * o foco à aba e periodicamente, sincronizando o backend quando houver mudança.
 */
export function startTokenRefreshWatcher(): void {
  if (typeof window === "undefined" || watcherStarted) return;
  watcherStarted = true;

  const onFocus = () => {
    if (document.visibilityState === "visible") void checkAndSyncToken();
  };
  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);
  // Revalidação periódica (a cada 6h) enquanto a aba estiver aberta.
  window.setInterval(() => void checkAndSyncToken(), 6 * 60 * 60 * 1000);
}

