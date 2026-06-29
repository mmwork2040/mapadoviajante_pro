import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";

export interface N8nConfig {
  /** Segredo compartilhado enviado pelo n8n no header x-webhook-secret. */
  secret: string;
}

export const DEFAULT_N8N_CONFIG: N8nConfig = {
  secret: "",
};

export async function getN8nConfig(): Promise<N8nConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "n8n" } });
    if (!value) return DEFAULT_N8N_CONFIG;
    return { ...DEFAULT_N8N_CONFIG, ...(JSON.parse(value) as Partial<N8nConfig>) };
  } catch {
    return DEFAULT_N8N_CONFIG;
  }
}

export async function saveN8nConfig(config: N8nConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "n8n", value: JSON.stringify(config) } });
}
