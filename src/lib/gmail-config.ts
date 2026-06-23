import { getAgencyId } from "@/lib/services";

export interface GmailConfig {
  enabled: boolean;
  senderName: string;
  replyTo: string;
  defaultSubject: string;
  signature: string;
}

const DEFAULT_CONFIG: GmailConfig = {
  enabled: false,
  senderName: "",
  replyTo: "",
  defaultSubject: "",
  signature: "",
};

function storageKey() {
  return `gmail_config_${getAgencyId() ?? "default"}`;
}

export function getGmailConfig(): GmailConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<GmailConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveGmailConfig(config: GmailConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(config));
}
