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

type ExtractKnowledgeInput = {
  provider: string;
  model: string;
  apiKey: string;
  fileBase64: string;
  mime: string;
};

// Extrai o texto de um documento para a base de conhecimento da IA.
export const extractKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ExtractKnowledgeInput) => {
    if (!d?.provider || !d?.model || !d?.apiKey) throw new Error("Configure e conecte a IA antes.");
    if (!d?.fileBase64 || !d?.mime) throw new Error("Arquivo inválido.");
    return d;
  })
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { extractKnowledgeText } = await import("./ai.server");
    const text = await extractKnowledgeText(
      { provider: data.provider, model: data.model, apiKey: data.apiKey },
      data.fileBase64,
      data.mime,
    );
    return { text };
  });

type CopilotInput = { prompt: string };

type KnowledgeState = {
  status?: string;
  data_sources?: { library?: boolean; leads?: boolean; finance?: boolean };
  documents?: { name: string; text: string }[];
};

async function buildKnowledgeContext(
  supabase: { from: (t: string) => any },
  ks: KnowledgeState | null,
): Promise<string> {
  const blocks: string[] = [];

  const docs = ks?.documents ?? [];
  if (docs.length) {
    const docText = docs
      .map((d) => `### Documento: ${d.name}\n${(d.text || "").slice(0, 8000)}`)
      .join("\n\n");
    blocks.push(`BASE DE CONHECIMENTO (materiais de referência da agência):\n${docText}`);
  }

  const sources = ks?.data_sources ?? {};
  if (sources.library) {
    const { data: itineraries } = await supabase
      .from("crm_itineraries")
      .select("title, destination, start_date, end_date")
      .limit(30);
    if (itineraries?.length) {
      blocks.push(
        "BIBLIOTECA DE ROTEIROS:\n" +
          itineraries
            .map(
              (i: Record<string, unknown>) =>
                `- ${i.title ?? "Roteiro"} | ${i.destination ?? ""} | ${i.start_date ?? ""}–${i.end_date ?? ""}`,
            )
            .join("\n"),
      );
    }
  }
  if (sources.finance) {
    const { data: txs } = await supabase
      .from("crm_transactions")
      .select("type, amount, category, description, transaction_date")
      .order("transaction_date", { ascending: false })
      .limit(30);
    if (txs?.length) {
      blocks.push(
        "DADOS FINANCEIROS (recentes):\n" +
          txs
            .map(
              (t: Record<string, unknown>) =>
                `- ${t.transaction_date ?? ""} | ${t.type ?? ""} | R$ ${t.amount ?? 0} | ${t.category ?? ""} ${t.description ?? ""}`,
            )
            .join("\n"),
      );
    }
  }

  return blocks.join("\n\n");
}

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
    const ks = (cfg.knowledge_sources as KnowledgeState | null) ?? null;
    if (ks?.status !== "connected") {
      throw new Error("A IA precisa ser testada e conectada nas configurações.");
    }

    const basePrompt =
      cfg.system_prompt ||
      "Você é um copiloto especialista em planejamento de viagens. Ajude a elaborar roteiros detalhados, com sugestões de atividades por dia, horários, estimativas de custo e dicas práticas. Seja objetivo e use listas quando útil.";

    const knowledge = await buildKnowledgeContext(context.supabase, ks);
    const systemPrompt = knowledge
      ? `${basePrompt}\n\nUse as informações abaixo como base de conhecimento ao responder:\n\n${knowledge}`
      : basePrompt;

    const { askCopilot } = await import("./ai.server");
    const text = await askCopilot(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        systemPrompt,
        maxTokens: cfg.max_tokens,
      },
      data.prompt,
    );
    return { text };
  });
