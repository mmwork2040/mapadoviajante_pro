import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedDocData } from "@/lib/types";

type TestInput = { provider: string; model: string; apiKey: string };
type ExtractInput = { fileBase64: string; mime: string };

export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: TestInput) => {
    if (!d?.provider || !d?.model || !d?.apiKey) throw new Error("Dados de conexão incompletos.");
    return d;
  })
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const { testConnection } = await import("./ai.server");
    return testConnection({ provider: data.provider, model: data.model, apiKey: data.apiKey });
  });

export const extractDocumentData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ExtractInput) => {
    if (!d?.fileBase64 || !d?.mime) throw new Error("Arquivo inválido.");
    return d;
  })
  .handler(async ({ data, context }): Promise<ExtractedDocData> => {
    const { data: cfg, error } = await context.supabase
      .from("crm_ai_config")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração de IA.");
    if (!cfg || !cfg.api_key_encrypted) throw new Error("IA não configurada.");
    const ks = (cfg.knowledge_sources as { status?: string } | null) ?? null;
    if (ks?.status !== "connected") {
      throw new Error("A IA precisa ser testada e conectada nas configurações.");
    }
    const { extractDocument } = await import("./ai.server");
    return extractDocument(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        systemPrompt: cfg.system_prompt,
        maxTokens: cfg.max_tokens,
      },
      data.fileBase64,
      data.mime,
    );
  });

type CopilotInput = { prompt: string };

export const itineraryCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CopilotInput) => {
    if (!d?.prompt?.trim()) throw new Error("Mensagem vazia.");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { data: cfg, error } = await context.supabase
      .from("crm_ai_config")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração de IA.");
    if (!cfg || !cfg.api_key_encrypted) throw new Error("IA não configurada.");
    const ks = (cfg.knowledge_sources as { status?: string } | null) ?? null;
    if (ks?.status !== "connected") {
      throw new Error("A IA precisa ser testada e conectada nas configurações.");
    }
    const { askCopilot } = await import("./ai.server");
    const text = await askCopilot(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        systemPrompt:
          cfg.system_prompt ||
          "Você é um copiloto especialista em planejamento de viagens. Ajude a elaborar roteiros detalhados, com sugestões de atividades por dia, horários, estimativas de custo e dicas práticas. Seja objetivo e use listas quando útil.",
        maxTokens: cfg.max_tokens,
      },
      data.prompt,
    );
    return { text };
  });
