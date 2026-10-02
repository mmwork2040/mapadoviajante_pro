import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { getPublicNotificationConfig, saveAgencyConfig } from "@/lib/settings.functions";
import { saveDeviceToken } from "@/lib/push.functions";

// ── Identificação estável do dispositivo ───────────────────────
function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function getDeviceId(): string {
  const KEY = "push_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      (crypto.randomUUID?.() as string | undefined) ??
      `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return `${id}-${shortHash(`${location.origin}|${navigator.userAgent}`)}`;
}

export function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  let os = "Dispositivo";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  let browser = "";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  return browser ? `${os} · ${browser}` : os;
}

const foregroundBound = new WeakSet<Messaging>();

async function acknowledgePushDelivery(
  traceId: unknown,
  ackSecret: unknown,
  deviceState: string,
): Promise<void> {
  if (typeof traceId !== "string" || typeof ackSecret !== "string") return;
  try {
    await fetch("/api/public/push-delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traceId, ackSecret, deviceState }),
      keepalive: true,
    });
  } catch {
    // Confirmação best-effort; não deve quebrar a notificação local.
  }
}

function bindForegroundMessages(messaging: Messaging): void {
  if (foregroundBound.has(messaging)) return;
  foregroundBound.add(messaging);
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "Notificação";
    const body = payload.notification?.body ?? payload.data?.body ?? "";
    void acknowledgePushDelivery(payload.data?.traceId, payload.data?.ackSecret, "foreground");
    if (Notification.permission === "granted") {
      void navigator.serviceWorker.ready
        .then((registration) =>
          registration.showNotification(title, {
            body,
            icon: "/pwa-icon.png",
            badge: "/pwa-icon.png",
            data: { url: payload.data?.url ?? "/" },
          }),
        )
        .catch(() => {
          try {
            new Notification(title, { body });
          } catch {
            // Alguns navegadores exigem o Service Worker; ignore silenciosamente.
          }
        });
    }
  });
}

let pushAppConfigKey = "";

export async function registerPushToken(token: string): Promise<void> {
  await saveDeviceToken({
    data: { token, deviceId: getDeviceId(), label: getDeviceLabel() },
  });
  lastKnownToken = token;
  startTokenRefreshWatcher();
}


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
  // Campos de validação do servidor (Service Account JSON / Chave Privada)
  serviceAccountJson?: string;
  clientEmail?: string;
  privateKey?: string;
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
  serviceAccountJson: "",
  clientEmail: "",
  privateKey: "",
  events: [],
};

export async function getNotifConfig(): Promise<NotifConfig> {
  try {
    const { value } = await getPublicNotificationConfig();
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

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
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

  const appConfig = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
  const appConfigKey = JSON.stringify(appConfig);
  let app: FirebaseApp;
  const existing = getApps().find((a) => a.name === "push");
  if (existing && pushAppConfigKey === appConfigKey) {
    app = existing;
  } else {
    if (existing) await deleteApp(existing);
    app = initializeApp(appConfig, "push");
    pushAppConfigKey = appConfigKey;
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      updateViaCache: "none",
    });
    // Força buscar a versão mais recente do script (evita SW antigo em cache).
    try {
      await registration.update();
    } catch {
      // Ignora falhas de atualização; o registro atual ainda é utilizável.
    }

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
    bindForegroundMessages(messaging);
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
 * Ao logar (ou restaurar sessão): captura/atualiza o device token e registra no
 * backend. Se a permissão já foi concedida, atualiza silenciosamente sem prompt,
 * garantindo que o token seja renovado a cada login em qualquer dispositivo.
 * Falha silenciosa em iframe/preview ou quando a permissão foi negada.
 */
export async function captureDeviceTokenOnLogin(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (window.self !== window.top) return; // preview/iframe
  if (Notification.permission === "denied") return;

  try {
    const config = await getNotifConfig();
    if (!config.enabled || !configIsComplete(config)) return;
    // requestPushToken chama Notification.requestPermission() apenas quando a
    // permissão está em "default" (exige gesto em mobile). Quando já concedida,
    // getToken funciona sem gesto e o token é renovado.
    const res = await requestPushToken(config);
    if (res.ok && res.token) {
      await registerPushToken(res.token);
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
      await registerPushToken(res.token);
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

