import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";

export interface GmailConfig {
  enabled: boolean;
  senderName: string;
  replyTo: string;
  defaultSubject: string;
  signature: string;
}

export const DEFAULT_CONFIG: GmailConfig = {
  enabled: false,
  senderName: "",
  replyTo: "",
  defaultSubject: "",
  signature: "",
};

export async function getGmailConfig(): Promise<GmailConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "gmail" } });
    if (!value) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(value) as Partial<GmailConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveGmailConfig(config: GmailConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "gmail", value: JSON.stringify(config) } });
}
