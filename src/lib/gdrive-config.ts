import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";

export interface GDriveConfig {
  /** Habilita a opção de importar documentos do Google Drive no editor de roteiro. */
  enabled: boolean;
  /** ID da pasta padrão do Drive de onde os arquivos são listados (vazio = raiz/todos). */
  folderId: string;
}

export const DEFAULT_GDRIVE_CONFIG: GDriveConfig = {
  enabled: false,
  folderId: "",
};

export async function getGDriveConfig(): Promise<GDriveConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "gdrive" } });
    if (!value) return DEFAULT_GDRIVE_CONFIG;
    return { ...DEFAULT_GDRIVE_CONFIG, ...(JSON.parse(value) as Partial<GDriveConfig>) };
  } catch {
    return DEFAULT_GDRIVE_CONFIG;
  }
}

export async function saveGDriveConfig(config: GDriveConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "gdrive", value: JSON.stringify(config) } });
}
