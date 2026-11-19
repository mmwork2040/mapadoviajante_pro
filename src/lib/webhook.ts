import {
  getAgencyConfig,
  saveAgencyConfig,
  dispatchWebhookFn,
  sendTestWebhookFn,
} from "@/lib/settings.functions";

// ── Eventos disponíveis para disparo ───────────────────────────
export const WEBHOOK_EVENTS = [
  { id: "lead.created", label: "Lead criado" },
  { id: "lead.status_changed", label: "Status do lead alterado" },
  { id: "lead.updated", label: "Lead atualizado" },
  { id: "lead.deleted", label: "Lead excluído" },
  { id: "task.created", label: "Tarefa criada" },
  { id: "task.completed", label: "Tarefa concluída" },
  { id: "transaction.created", label: "Transação registrada" },
  { id: "itinerary.created", label: "Roteiro criado" },
  { id: "itinerary.deleted", label: "Roteiro excluído" },
  { id: "member.invited", label: "Membro convidado" },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENTS)[number]["id"];

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  secret: string;
  events: WebhookEventId[];
}

export const DEFAULT_CONFIG: WebhookConfig = {
  enabled: false,
  url: "",
  secret: "",
  events: WEBHOOK_EVENTS.map((e) => e.id),
};

export async function getWebhookConfig(): Promise<WebhookConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "webhook" } });
    if (!value) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(value) as Partial<WebhookConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveWebhookConfig(config: WebhookConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "webhook", value: JSON.stringify(config) } });
}

// ── Disparo de eventos ─────────────────────────────────────────
// O envio acontece no servidor, que lê a URL e o segredo salvos da agência.
export async function dispatchWebhook(event: WebhookEventId, payload: unknown) {
  try {
    await dispatchWebhookFn({ data: { event, payload } });
  } catch (err) {
    // Não interrompe o fluxo da aplicação caso o webhook falhe.
    console.warn("Falha ao disparar webhook:", err);
  }
}

// ── Teste manual do webhook ────────────────────────────────────
export async function sendTestWebhook(config: WebhookConfig) {
  if (!config.url.trim()) {
    return { ok: false, message: "Informe a URL do webhook." };
  }
  try {
    const res = await sendTestWebhookFn({ data: { url: config.url.trim(), secret: config.secret || undefined } });
    return { ok: res.ok, message: res.message ?? "" };
  } catch (err) {
    return {
      ok: false,
      message: `Erro ao enviar: ${err instanceof Error ? err.message : "desconhecido"}`,
    };
  }
}
