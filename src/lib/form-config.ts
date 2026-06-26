import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";

export interface FormConfig {
  /** Código <iframe> completo, exatamente como colado pelo usuário. */
  embedCode: string;
}

export const DEFAULT_CONFIG: FormConfig = {
  embedCode: "",
};

/** Extrai o atributo src de um trecho de HTML com <iframe>. */
export function extractIframeSrc(embedCode: string): string | null {
  const m = embedCode.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export async function getFormConfig(): Promise<FormConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "form" } });
    if (!value) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(value) as Partial<FormConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveFormConfig(config: FormConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "form", value: JSON.stringify(config) } });
}
