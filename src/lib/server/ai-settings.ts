// Configuração de IA usada pelas server functions.
//
// Decisão do produto: a IA usa uma chave da PLATAFORMA, configurada na Vercel,
// e não uma chave por agência. Variáveis de ambiente do servidor:
//   AI_GATEWAY_API_KEY  Vercel AI Gateway (OpenAI e outros provedores; modelo "openai/gpt-...")
//   OPENAI_API_KEY      chamada direta à OpenAI
//   AI_DEFAULT_MODEL    modelo padrão (ex.: "gpt-4o-mini" ou "openai/gpt-4o-mini" no Gateway)
// Sem nenhuma delas, vale a chave que a agência cadastrou na Administração.

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

export function platformAi(): { apiKey: string; model: string; baseUrl: string } | null {
  const gateway = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gateway) {
    return {
      apiKey: gateway,
      model: process.env.AI_DEFAULT_MODEL?.trim() || "openai/gpt-4o-mini",
      baseUrl: AI_GATEWAY_BASE_URL,
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      apiKey: openai,
      model: process.env.AI_DEFAULT_MODEL?.trim() || "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
    };
  }
  return null;
}

/** Endereço da API compatível com OpenAI para uma chave. */
export function openAiBaseUrlFor(apiKey: string): string {
  const gateway = process.env.AI_GATEWAY_API_KEY?.trim();
  return gateway && apiKey === gateway ? AI_GATEWAY_BASE_URL : "https://api.openai.com/v1";
}

/**
 * Lê a configuração de IA da agência (orientações, fontes de conhecimento) e,
 * se houver chave da plataforma, usa ela no lugar da chave da agência.
 * Mesmo formato de retorno da consulta antiga ({ data, error }).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadAiSettings(supabase: any): Promise<{ data: any; error: any }> {
  const { data: cfg, error } = await supabase.from("crm_ai_config").select("*").maybeSingle();
  const platform = platformAi();
  if (!platform) return { data: cfg, error };
  const ks = cfg?.knowledge_sources && typeof cfg.knowledge_sources === "object" ? cfg.knowledge_sources : {};
  return {
    data: {
      ...(cfg ?? {}),
      provider: "openai",
      model: platform.model,
      api_key_encrypted: platform.apiKey,
      max_tokens: cfg?.max_tokens || 2048,
      // Com a chave da plataforma não é preciso "testar e conectar" na Administração.
      knowledge_sources: { ...ks, status: "connected" },
    },
    error: null,
  };
}
