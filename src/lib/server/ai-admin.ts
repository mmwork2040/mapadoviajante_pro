// Escolha da chave de IA nas telas de administração. Só para código de servidor.
import { platformAi } from "@/lib/server/ai-settings";
import { STORED_KEY_MARKER } from "@/lib/ai-config.functions";

/** Resolve a chave para testar/extrair: a digitada agora, a salva ou a da plataforma. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveProviderForAdmin(context: any, typed: { provider?: string; model?: string; apiKey?: string }) {
  const typedKey = (typed.apiKey || "").trim();
  if (typedKey && typedKey !== STORED_KEY_MARKER) {
    return { provider: typed.provider || "openai", model: typed.model || "", apiKey: typedKey };
  }
  const platform = platformAi();
  if (platform) return { provider: "openai", model: platform.model, apiKey: platform.apiKey };
  const { data: existing, error } = await context.db.from("crm_ai_config").select("*").maybeSingle();
  if (error) throw new Error("Não foi possível carregar a configuração de IA.");
  if (!existing?.api_key_encrypted) throw new Error("Informe a chave da IA.");
  return {
    provider: typed.provider || existing.provider || "openai",
    model: typed.model || existing.model || "",
    apiKey: existing.api_key_encrypted as string,
  };
}
