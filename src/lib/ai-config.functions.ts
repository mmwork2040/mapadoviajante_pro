import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Configuração de IA da agência, sempre pelo servidor. A chave nunca volta ao
// navegador: no lugar dela vai STORED_KEY_MARKER, que significa "há uma chave
// salva". Ao salvar, esse marcador (ou campo vazio) mantém a chave atual.

export const STORED_KEY_MARKER = "__chave_salva__";

export type AiConfigView = {
  id?: string;
  provider: string;
  model: string;
  api_key_encrypted: string;
  system_prompt: string | null;
  max_tokens: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  knowledge_sources: any;
  /** IA da plataforma (chave na Vercel) ativa: dispensa chave e "conectar". */
  platform: { active: boolean; model: string | null };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readAgencyAiConfig(supabase: any) {
  const { data, error } = await supabase.from("crm_ai_config").select("*").maybeSingle();
  if (error) throw new Error("Não foi possível carregar a configuração de IA.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data as any;
}

/** Configuração de IA da agência, sem a chave. Qualquer membro pode ler. */
export const getAiConfigFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiConfigView | null> => {
    const { getMembership } = await import("@/lib/server/authz");
    await getMembership(context);
    const { platformAi } = await import("@/lib/server/ai-settings");
    const platform = platformAi();
    const cfg = await readAgencyAiConfig(context.supabase);
    if (!cfg && !platform) return null;
    const ks = cfg?.knowledge_sources && typeof cfg.knowledge_sources === "object" ? cfg.knowledge_sources : {};
    return {
      id: cfg?.id,
      provider: cfg?.provider || "openai",
      model: cfg?.model || "",
      api_key_encrypted: (cfg?.api_key_encrypted || platform) ? STORED_KEY_MARKER : "",
      system_prompt: cfg?.system_prompt ?? null,
      max_tokens: cfg?.max_tokens || 1024,
      // Com a chave da plataforma a IA já está pronta para uso.
      knowledge_sources: platform ? { ...ks, status: "connected" } : ks,
      platform: { active: !!platform, model: platform?.model ?? null },
    };
  });

const saveSchema = z.object({
  provider: z.string().max(40).optional(),
  model: z.string().max(120).optional(),
  api_key_encrypted: z.string().max(500).nullable().optional(),
  system_prompt: z.string().max(20_000).nullable().optional(),
  max_tokens: z.number().int().min(64).max(32_000).nullable().optional(),
  knowledge_sources: z.unknown().optional(),
});

/** Salva a configuração de IA da agência. Só admin. Chave vazia ou marcador = manter. */
export const saveAiConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/server/authz");
    await requireAdmin(context);
    const existing = await readAgencyAiConfig(context.supabase);
    const incomingKey = (data.api_key_encrypted || "").trim();
    const keepKey = !incomingKey || incomingKey === STORED_KEY_MARKER;
    const payload = {
      provider: data.provider ?? existing?.provider ?? "openai",
      model: data.model ?? existing?.model ?? "",
      api_key_encrypted: keepKey ? existing?.api_key_encrypted ?? null : incomingKey,
      system_prompt: data.system_prompt !== undefined ? data.system_prompt : existing?.system_prompt ?? null,
      max_tokens: data.max_tokens ?? existing?.max_tokens ?? 1024,
      knowledge_sources:
        data.knowledge_sources !== undefined ? data.knowledge_sources : existing?.knowledge_sources ?? null,
    };
    const query = existing?.id
      ? context.supabase.from("crm_ai_config").update(payload).eq("id", existing.id)
      : context.supabase.from("crm_ai_config").insert(payload);
    const { error } = await query.select().single();
    if (error) {
      console.error("saveAiConfigFn:", error);
      throw new Error("Não foi possível salvar a configuração de IA.");
    }
    return { ok: true };
  });

/** Resolve a chave para testar/extrair: a digitada agora, a salva ou a da plataforma. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveProviderForAdmin(context: any, typed: { provider?: string; model?: string; apiKey?: string }) {
  const { platformAi } = await import("@/lib/server/ai-settings");
  const typedKey = (typed.apiKey || "").trim();
  if (typedKey && typedKey !== STORED_KEY_MARKER) {
    return { provider: typed.provider || "openai", model: typed.model || "", apiKey: typedKey };
  }
  const platform = platformAi();
  if (platform) return { provider: "openai", model: platform.model, apiKey: platform.apiKey };
  const existing = await readAgencyAiConfig(context.supabase);
  if (!existing?.api_key_encrypted) throw new Error("Informe a chave da IA.");
  return {
    provider: typed.provider || existing.provider || "openai",
    model: typed.model || existing.model || "",
    apiKey: existing.api_key_encrypted as string,
  };
}
