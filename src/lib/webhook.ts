import { getAgencyId } from "@/lib/services";

// ── Eventos disponíveis para disparo ───────────────────────────
export const WEBHOOK_EVENTS = [
  { id: "lead.created", label: "Lead criado" },
  { id: "lead.status_changed", label: "Status do lead alterado" },
  { id: "lead.deleted", label: "Lead excluído" },
  { id: "task.created", label: "Tarefa criada" },
  { id: "task.completed", label: "Tarefa concluída" },
  { id: "transaction.created", label: "Transação registrada" },
  { id: "itinerary.created", label: "Roteiro criado" },
  { id: "member.invited", label: "Membro convidado" },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENTS)[number]["id"];

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret: string;
  events: WebhookEventId[];
}

const DEFAULT_CONFIG: WebhookConfig = {
  enabled: false,
  url: "",
  secret: "",
  events: WEBHOOK_EVENTS.map((e) => e.id),
};

function storageKey() {
  return `webhook_config_${getAgencyId() ?? "default"}`;
}

export function getWebhookConfig(): WebhookConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<WebhookConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveWebhookConfig(config: WebhookConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(config));
}

// ── Disparo de eventos ─────────────────────────────────────────
export async function dispatchWebhook(event: WebhookEventId, payload: unknown) {
  const config = getWebhookConfig();
  if (!config.enabled || !config.url) return;
  if (!config.events.includes(event)) return;

  try {
    await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.secret ? { "X-Webhook-Secret": config.secret } : {}),
      },
      body: JSON.stringify({
        event,
        agency_id: getAgencyId(),
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });
  } catch (err) {
    // Não interrompe o fluxo da aplicação caso o webhook falhe.
    console.warn("Falha ao disparar webhook:", err);
  }
}
