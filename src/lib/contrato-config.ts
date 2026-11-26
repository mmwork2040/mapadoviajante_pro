// Modelo de contrato da agência. Qualquer pessoa da equipe lê (para gerar o
// contrato); só o admin salva.
import { getAgencyConfig, saveAgencyConfig } from "@/lib/settings.functions";
import { MODELO_CONTRATO_PADRAO } from "@/data/documentos";

export type ContratoConfig = {
  /** Texto do contrato com os campos entre chaves duplas: {{cliente_nome}}. */
  modelo: string;
};

export async function getContratoConfig(): Promise<ContratoConfig> {
  try {
    const { value } = await getAgencyConfig({ data: { scope: "contrato" } });
    const salvo = value ? (JSON.parse(value) as Partial<ContratoConfig>) : {};
    return { modelo: salvo.modelo?.trim() ? salvo.modelo : MODELO_CONTRATO_PADRAO };
  } catch {
    return { modelo: MODELO_CONTRATO_PADRAO };
  }
}

export async function saveContratoConfig(config: ContratoConfig): Promise<void> {
  await saveAgencyConfig({ data: { scope: "contrato", value: JSON.stringify(config) } });
}
