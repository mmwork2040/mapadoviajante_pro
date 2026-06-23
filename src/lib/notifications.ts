import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import { getAgencyId } from "@/lib/services";
import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";

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

const DEFAULT_CONFIG: NotifConfig = {
  enabled: false,
  apiKey: "",
  authDomain: "",
  projectId: "",
  messagingSenderId: "",
  appId: "",
  vapidKey: "",
  events: [],
};


function storageKey() {
  return `notif_config_${getAgencyId() ?? "default"}`;
}

export function getNotifConfig(): NotifConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<NotifConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveNotifConfig(config: NotifConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(config));
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
