import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedDocData } from "@/lib/types";

type TestInput = { provider: string; model: string; apiKey: string };
type ExtractInput = { fileBase64: string; mime: string };
type ExtractActivitiesInput = { fileBase64: string; mime: string; context?: string };

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

export const extractDocumentActivitiesData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ExtractActivitiesInput) => {
    if (!d?.fileBase64 || !d?.mime) throw new Error("Arquivo inválido.");
    return d;
  })
  .handler(async ({ data, context }): Promise<ExtractedDocData[]> => {
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
    const { extractDocumentActivities } = await import("./ai.server");
    return extractDocumentActivities(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        systemPrompt: cfg.system_prompt,
        maxTokens: cfg.max_tokens,
      },
      data.fileBase64,
      data.mime,
      data.context,
    );
  });

type ExtractActivitiesTextInput = { text: string; context?: string };

// Extrai atividades a partir de texto (ex.: planilhas do Drive já convertidas).
export const extractActivitiesFromTextData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ExtractActivitiesTextInput) => {
    if (!d?.text?.trim()) throw new Error("Documento sem conteúdo legível.");
    return d;
  })
  .handler(async ({ data, context }): Promise<ExtractedDocData[]> => {
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
    const { extractActivitiesFromText } = await import("./ai.server");
    return extractActivitiesFromText(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        systemPrompt: cfg.system_prompt,
        maxTokens: cfg.max_tokens,
      },
      data.text,
      data.context,
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

type ParsePeriodInput = { text: string };

// Interpreta um período de viagem em texto livre e retorna datas de início/fim.
export const parseTravelPeriodFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ParsePeriodInput) => {
    if (!d?.text?.trim()) throw new Error("Informe o período da viagem.");
    return { text: d.text.trim() };
  })
  .handler(async ({ data, context }) => {
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
    const { parseTravelPeriod } = await import("./ai.server");
    return parseTravelPeriod(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: cfg.max_tokens,
      },
      data.text,
    );
  });

type ConvertCurrencyInput = { amount: number; currency: string };

// Converte um valor em moeda estrangeira para Real (BRL) usando a IA.
export const convertCurrencyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ConvertCurrencyInput) => {
    const amount = Number(d?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor válido.");
    if (!d?.currency?.trim()) throw new Error("Informe a moeda.");
    return { amount, currency: d.currency.trim() };
  })
  .handler(async ({ data, context }) => {
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
    const { convertCurrencyToBRL } = await import("./ai.server");
    return convertCurrencyToBRL(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: cfg.max_tokens,
      },
      data.amount,
      data.currency,
    );
  });

type HotelSearchFilters = {
  room_type?: string | null;
  stars?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string | null;
  notes?: string | null;
};
type SearchHotelsInput = { city: string; filters?: HotelSearchFilters; limit?: number };

// Pesquisa sugestões de hospedagem na cidade informada usando a IA.
export const searchHotelsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SearchHotelsInput) => {
    if (!d?.city?.trim()) throw new Error("Informe a cidade para pesquisar hospedagens.");
    const limit = Math.min(6, Math.max(1, Math.round(Number(d.limit) || 5)));
    return { city: d.city.trim(), filters: d.filters ?? undefined, limit };
  })
  .handler(async ({ data, context }) => {
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
    const { searchHotels } = await import("./ai.server");
    return searchHotels(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: cfg.max_tokens,
      },
      data.city,
      data.filters,
    );
  });



type AnalyzeImageInput = {
  fileBase64: string;
  mime: string;
  itineraryId?: string;
  activityTitle?: string;
};

// Interpreta uma imagem anexada a um dia do roteiro e avalia se é coerente
// com o destino/roteiro, retornando o tipo de atividade identificado.
export const analyzeImageActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AnalyzeImageInput) => {
    if (!d?.fileBase64 || !d?.mime) throw new Error("Imagem inválida.");
    if (!d.mime.startsWith("image/")) throw new Error("O arquivo enviado não é uma imagem.");
    return d;
  })
  .handler(async ({ data, context }) => {
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

    let destination = "";
    let itineraryTitle = "";
    let existingContext = "";
    if (data.itineraryId) {
      const { data: it } = await context.supabase
        .from("crm_itineraries")
        .select("title, destination")
        .eq("id", data.itineraryId)
        .maybeSingle();
      destination = (it as { destination?: string } | null)?.destination ?? "";
      itineraryTitle = (it as { title?: string } | null)?.title ?? "";
      const { data: days } = await context.supabase
        .from("crm_itinerary_days")
        .select("day_number, title, crm_itinerary_activities(title, type, location)")
        .eq("itinerary_id", data.itineraryId)
        .order("day_number", { ascending: true });
      const rows = (days as unknown as {
        day_number: number;
        title?: string;
        crm_itinerary_activities?: { title?: string; type?: string; location?: string }[];
      }[]) || [];
      existingContext = rows
        .map((d) => {
          const acts = (d.crm_itinerary_activities || [])
            .map((a) => `  • [${a.type || "item"}] ${a.title || ""}${a.location ? ` @ ${a.location}` : ""}`)
            .join("\n");
          return `Dia ${d.day_number}${d.title ? ` - ${d.title}` : ""}${acts ? `\n${acts}` : ""}`;
        })
        .join("\n");
    }

    const { analyzeImageForItinerary } = await import("./ai.server");
    // Para análise de imagem usamos sempre o modelo de visão mais capaz do
    // provedor, evitando confundir atrações parecidas (ex.: Notre-Dame de Paris
    // x Catedral de Amiens), independentemente do modelo configurado.
    const provider = cfg.provider ?? "openai";
    const visionModel =
      provider === "openai"
        ? "gpt-4o"
        : provider === "anthropic"
          ? "claude-3-5-sonnet-latest"
          : provider === "google"
            ? "gemini-2.5-pro"
            : cfg.model ?? "";
    return analyzeImageForItinerary(
      {
        provider,
        model: visionModel,
        apiKey: cfg.api_key_encrypted,
        maxTokens: cfg.max_tokens,
      },
      data.fileBase64,
      data.mime,
      { destination, itineraryTitle, activityTitle: data.activityTitle, existingContext },
    );
  });

type LibraryContentInput = {
  itemType: string;

  title: string;
  location?: string;
  description?: string;
  content?: string;
  tags?: string[];
  field: "description" | "content";
};

// Gera/ajuda a redigir a descrição curta ou o conteúdo (base de conhecimento)
// de um item da biblioteca. Requer IA configurada e conectada.
export const generateLibraryContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: LibraryContentInput) => {
    if (!d?.title?.trim()) throw new Error("Informe um título para o item.");
    if (d?.field !== "description" && d?.field !== "content") {
      throw new Error("Campo inválido.");
    }
    return {
      itemType: d.itemType || "item",
      title: d.title.trim(),
      location: d.location?.trim() || "",
      description: d.description?.trim() || "",
      content: d.content?.trim() || "",
      tags: Array.isArray(d.tags) ? d.tags : [],
      field: d.field,
    };
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

    const typeLabel: Record<string, string> = {
      experience: "experiência de viagem (passeio, tour ou atividade)",
      package: "pacote de viagem pronto",
      image: "imagem de destino",
      itinerary: "roteiro modelo reutilizável",
    };
    const kind = typeLabel[data.itemType] || "item de biblioteca de viagem";
    const details = [
      `Tipo: ${kind}`,
      `Título: ${data.title}`,
      data.location ? `Local/Destino: ${data.location}` : "",
      data.tags.length ? `Tags: ${data.tags.join(", ")}` : "",
      data.description ? `Descrição atual: ${data.description}` : "",
      data.content ? `Conteúdo atual: ${data.content}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const instruction =
      data.field === "description"
        ? `Escreva uma DESCRIÇÃO CURTA (1 a 2 frases, no máximo ~240 caracteres) e atraente para este item da biblioteca de uma agência de viagens. Português do Brasil, tom profissional e vendedor, sem títulos nem aspas.`
        : `Escreva um CONTEÚDO detalhado para servir de base de conhecimento da IA sobre este item. Inclua informações úteis como visão geral, principais atrações/atividades, dicas práticas, melhor época, duração sugerida e observações operacionais relevantes. Português do Brasil, texto corrido e/ou listas objetivas. Não repita o título como cabeçalho.`;

    const prompt = `Você é um redator especialista de uma agência de viagens.\n${instruction}\n\nDados do item:\n${details}\n\nResponda APENAS com o texto final, sem comentários extras.`;

    const { askCopilot } = await import("./ai.server");
    const text = await askCopilot(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: data.field === "content" ? 2048 : 400,
      },
      prompt,
    );
    return { text: text.trim() };
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
  if (sources.leads) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("name, email, phone, status, destination")
      .limit(40);
    if (leads?.length) {
      blocks.push(
        "BASE DE LEADS:\n" +
          leads
            .map(
              (l: Record<string, unknown>) =>
                `- ${l.name ?? "Lead"} | ${l.status ?? ""} | ${l.destination ?? ""} | ${l.email ?? ""} ${l.phone ?? ""}`,
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

type PlannerFile = { base64: string; mime: string; name?: string };
type PlannerInput = {
  message: string;
  context: string;
  files: PlannerFile[];
  leadId?: string | null;
  itineraryId?: string | null;
};

export type PlannedActivity = {
  time?: string;
  title: string;
  location?: string;
  type?: string;
  description?: string;
  duration?: string;
  cost?: number;
};
export type PlannedDay = {
  title?: string;
  date?: string;
  activities: PlannedActivity[];
};
export type PlannedUpdate = {
  activityId: string;
  time?: string;
  title?: string;
  location?: string;
  type?: string;
  description?: string;
  duration?: string;
  cost?: number;
};
export type PlannerResult = { reply: string; days: PlannedDay[]; updates: PlannedUpdate[] };

const PLANNER_PROMPT = `Você é o assistente interno da agência que conversa com o CONSULTOR (o usuário logado). O CONSULTOR sou eu, que estou montando o roteiro. O LEAD é o viajante/cliente para quem o roteiro está sendo elaborado. Você fala SEMPRE comigo, o consultor — nunca diretamente com o viajante. Aja com respeito, educação, simpatia e profissionalismo, como um colega de equipe experiente.

COMO VOCÊ AJUDA:
- Você me apoia na elaboração do roteiro inteiro OU de apenas uma parte dele (um dia, um trecho, um tipo de atividade, etc.), conforme eu pedir.
- Sempre identifique como o roteiro está até o momento (destino, datas, passageiros, dias já criados e o que ainda falta) e me oriente sobre as próximas etapas — ou me ajude exatamente no ponto onde eu pedir.
- Você pode dar dicas de viagem que eu possa usar com o lead: lugares, parques, atrações, passeios, gastronomia, melhor época e dicas práticas, sempre com base no destino do lead (quando informado).

ESTÁGIOS DO ROTEIRO (definidos por mim, o consultor): "Rascunho" (em elaboração), "Em andamento" (viagem confirmada/acontecendo), "Concluído" e "Cancelado".
- Em "Rascunho": foque em construir e completar o roteiro, sugerir dias e atividades e apontar o que ainda falta.
- Em "Em andamento": ajustes finos, lembretes e dicas práticas para a viagem em curso; evite reestruturar tudo.
- Em "Concluído"/"Cancelado": apenas tire dúvidas e dê sugestões; não proponha refazer o roteiro a menos que eu peça.

VALIDAÇÃO OBRIGATÓRIA — NÃO GERE O ROTEIRO ENQUANTO FALTAR QUALQUER UMA DESTAS INFORMAÇÕES ESSENCIAIS DA VIAGEM DO LEAD:
1. Destino(s)
2. Datas da viagem (período ou datas de ida/volta) — SEM DATAS NÃO HÁ ROTEIRO. É PROIBIDO gerar ou completar qualquer dia enquanto não houver, no mínimo, a data de ida (e idealmente a de volta). As datas podem vir de: (a) mim, o consultor, na mensagem; (b) um documento/passagem anexado (extraia embarque/desembarque, ida/volta); ou (c) o cadastro do lead (campo "Datas/Período da viagem" na base de conhecimento). Se nenhuma dessas fontes trouxer datas, retorne "days" vazio e peça as datas no "reply" — não invente datas nem gere dias soltos.
3. Quantidade de passageiros
4. Extras desejados (passeios, preferências, necessidades especiais) — confirme comigo se há ou não; se eu disser que o lead não deseja extras, considere atendido.

Verifique o CONTEXTO DO ROTEIRO, a MENSAGEM DO CONSULTOR e os arquivos enviados. Se QUALQUER um dos 4 itens estiver faltando e não puder ser deduzido com segurança, é PROIBIDO gerar o roteiro: retorne "days" vazio e use "reply" para listar exatamente o que falta e me fazer as perguntas necessárias. Mesmo assim você pode oferecer dicas gerais do destino, se ele já for conhecido.

EXEMPLOS DE MENSAGENS (no campo "reply", adapte ao caso real):
- Faltando informações: "Para eu montar o roteiro da Renata preciso de mais alguns detalhes: qual é o destino, as datas da viagem, quantos passageiros e se há algum extra desejado (passeios, preferências, necessidades especiais). Pode me passar?"
- Roteiro vazio com tudo informado: "Perfeito! Com Orlando, 10 dias (10–20/07), 4 passageiros e foco em parques, montei uma proposta inicial dividida por dia. Dá uma olhada e me diga o que ajustar."
- Ajuda em parte do roteiro: "No Dia 3 ainda não há nada definido. Sugeri uma manhã no Magic Kingdom e a tarde livre para compras no Premium Outlets. Quer que eu detalhe os horários?"
- Dica de viagem: "Como o destino é Roma, vale reservar o Coliseu com antecedência e deixar uma manhã livre para o Vaticano. Quer que eu encaixe isso no roteiro?"
- Documento enviado: "Recebi a passagem aérea: identifiquei o voo LA8084 saindo de GRU dia 10/07 às 22h. Já adicionei como atividade do Dia 1. Quer que eu siga montando os demais dias?"

QUANDO TODAS AS 4 INFORMAÇÕES ESSENCIAIS ESTIVEREM PRESENTES:
- Analise CADA arquivo com critério: extraia apenas informações realmente relevantes para a viagem — datas, horários, destinos, números de voo, embarque/desembarque, hotéis, reservas, vouchers, ingressos e dados que sirvam como instrução ou complemento de algum dia do roteiro.
- Imagens ou documentos sem informação relevante para a viagem devem ser ignorados.
- Se já houver dias configurados no contexto, NÃO os recrie do zero: respeite o que já existe e, no mesmo dia, acrescente apenas o que for útil e coerente.
- Distribua tudo em dias na ordem cronológica correta. Quando faltarem detalhes não essenciais, complemente com sugestões úteis e dicas locais.
- Se houver falha na identificação de algum documento/imagem, me informe no "reply" com tom respeitoso e profissional.

COMPLETAR ATIVIDADES JÁ EXISTENTES (MUITO IMPORTANTE):
- No CONTEXTO DO ROTEIRO cada atividade já criada vem com um identificador no formato [id:XXXX]. Use esse id para propor alterações via "updates".
- Identifique atividades INCOMPLETAS ou com títulos genéricos/padrão (ex: "Nova atividade", "Novo Voo", "Nova Hospedagem", "Novo Transfer") e/ou sem horário, sem local, sem descrição ou sem dados essenciais. Elas provavelmente foram adicionadas pelo consultor sem serem preenchidas.
- Quando um documento/anexo enviado corresponder a uma dessas atividades (mesmo tipo, mesmo dia ou contexto compatível), INTERPRETE o anexo e COMPLETE a atividade existente preenchendo os campos faltantes (título correto, horário, local, tipo, descrição, duração e custo). Use "updates" com o "activityId" dessa atividade — NÃO crie uma atividade nova duplicada.
- Se o anexo trouxer uma atividade que ainda não existe no roteiro, aí sim crie via "days".
- Se apenas o item foi adicionado sem anexo e sem outras informações, sugira no "reply" o que falta preencher e, quando puder deduzir com segurança dos dados do lead/roteiro, proponha o preenchimento em "updates".
 - Só inclua em "updates" os campos que você realmente conseguiu preencher/melhorar; deixe de fora os campos que não deve alterar.

COMPLETAR DIAS VAZIOS OU INCOMPLETOS PARA TODO O PERÍODO (ESTRUTURA DE REFERÊNCIA):
- DISTRIBUIÇÃO DE DIAS PELAS DATAS (REGRA CENTRAL): o número de dias do roteiro é DEFINIDO pelas datas de ida e volta, nunca arbitrado. Calcule o total de dias como (data de volta − data de ida) + 1, contando ambos os extremos. Ex.: passagem de ida e volta cobrindo 6 dias ⇒ o roteiro tem ATÉ 6 dias, do dia de chegada ao dia de partida. O Dia 1 é sempre a data de ida/chegada e o último dia é a data de volta/partida; atribua a "date" correta (AAAA-MM-DD) a CADA dia em sequência, sem pular nem repetir datas.
- ANTES de retornar qualquer item em "days", verifique a seção "Dias atuais". Se o dia já existe (ex.: "Dia 1", mesmo que o novo título seja "Dia 1 - Embarque"), reutilize esse dia: complete-o/renomeie-o conceitualmente, mas NÃO trate como um novo dia. Só retorne dias realmente faltantes; para completar atividades já existentes, prefira "updates" usando o [id] da atividade.
- Se houver apenas a data de ida (sem volta), monte a partir dela e me pergunte no "reply" a data de volta para fechar a duração — não estenda o roteiro além do que as datas permitem.
- Se as datas vierem de fontes diferentes (mensagem, anexo de passagem, cadastro do lead) e divergirem, priorize o documento de passagem, depois minha mensagem e por fim o cadastro; sinalize a divergência no "reply".
- Quando eu pedir para completar/preencher o roteiro e as 4 informações essenciais estiverem presentes, cubra TODOS os dias do período (da data de ida à data de volta). Se existirem menos dias montados do que o período, crie os dias faltantes com suas datas corretas; se algum dia existente estiver sem atividades, complemente-o.
- A BIBLIOTECA DA AGÊNCIA é o seu ACERVO DE MEMÓRIA. Baseie-se PRIORITARIAMENTE nela (experiências, pacotes, imagens e roteiros modelo) e no destino do lead. Reaproveite itens compatíveis com o destino e NUNCA repita imagens, documentos ou dicas que já constam no roteiro (itens marcados como "(JÁ NO ROTEIRO)" ou já presentes no CONTEXTO DO ROTEIRO). A ideia é COMPLETAR o roteiro com conteúdo novo e relevante, sem duplicar o que já existe.
- Quando o acervo tiver novas imagens do destino (veja "NOVAS IMAGENS ADICIONADAS AO ACERVO"), sugira aproveitá-las nas dicas/atividades correspondentes.
- Para CADA dia, organize a programação por turnos, criando atividades separadas:
  · Manhã: atividade/passeio, com horário, local, duração estimada, custo médio (cost) e, na descrição, dica prática e se precisa de reserva.
  · Tarde: atividade ou deslocamento, com valores e logística na descrição.
  · Noite: sugestão de jantar, passeio cultural, rooftop ou descanso.
- Em cada dia, inclua ao menos uma atividade do tipo "note" com uma "🎒 Dica de Viajante" prática e específica para aquele dia/contexto (ex.: clima, vestuário, reservas, transporte).
- Quando fizer sentido, adicione uma "note" com sugestões de HOSPEDAGEM na cidade em 3 níveis: Low Cost, Custo x Benefício e Experiência Única, com valores médios por diária (use nomes reais quando disponíveis na biblioteca).
- Preencha "cost" com estimativas realistas por atividade para permitir um resumo de orçamento (passagens, hospedagem, alimentação, passeios, transporte local, extras).
- Mantenha coerência cronológica e geográfica entre os dias; não repita a mesma atividade em dias diferentes sem motivo.
- Se não houver dados suficientes na biblioteca nem nos anexos, complemente com sugestões plausíveis para o destino, deixando claro na "reply" que são sugestões a validar.

Responda SEMPRE apenas com um JSON válido, sem texto extra, no formato:
{
  "reply": "mensagem amigável em português: dicas, o que montou, o que completou, o que sugere e/ou o que ainda falta",
  "days": [
    {
      "title": "Dia 1 - Embarque",
      "date": "AAAA-MM-DD ou vazio",
      "activities": [
        {
          "time": "HH:MM ou vazio",
          "title": "título curto da atividade",
          "location": "local/aeroporto/cidade ou vazio",
          "type": "flight|hotel|transfer|restaurant|activity|note",
          "description": "detalhes (voo, localizador, etc) ou vazio",
          "duration": "ex: 2h ou vazio",
          "cost": valor numérico ou 0
        }
      ]
    }
  ],
  "updates": [
    {
      "activityId": "id da atividade existente a ser completada/corrigida",
      "time": "HH:MM (opcional)",
      "title": "título correto (opcional)",
      "location": "local (opcional)",
      "type": "flight|hotel|transfer|restaurant|activity|note (opcional)",
      "description": "detalhes (opcional)",
      "duration": "ex: 2h (opcional)",
      "cost": valor numérico (opcional)
    }
  ]
}`;

function parsePlannerJson(text: string): PlannerResult {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Não foi possível interpretar a resposta da IA.");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<PlannerResult>;
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    days: Array.isArray(parsed.days)
      ? parsed.days
          .filter((d): d is PlannedDay => !!d && Array.isArray(d.activities))
          .map((d) => ({
            title: d.title || "",
            date: d.date || "",
            activities: d.activities.filter((a) => a && a.title),
          }))
      : [],
    updates: Array.isArray(parsed.updates)
      ? parsed.updates
          .filter((u): u is PlannedUpdate => !!u && typeof u.activityId === "string" && !!u.activityId)
          .map((u) => ({
            activityId: u.activityId,
            ...(typeof u.time === "string" ? { time: u.time } : {}),
            ...(typeof u.title === "string" ? { title: u.title } : {}),
            ...(typeof u.location === "string" ? { location: u.location } : {}),
            ...(typeof u.type === "string" ? { type: u.type } : {}),
            ...(typeof u.description === "string" ? { description: u.description } : {}),
            ...(typeof u.duration === "string" ? { duration: u.duration } : {}),
            ...(typeof u.cost === "number" ? { cost: u.cost } : {}),
          }))
      : [],
  };
}

export const itineraryPlanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PlannerInput) => {
    if (!d?.message?.trim() && !(d?.files?.length)) throw new Error("Envie uma mensagem ou um documento.");
    return { message: d.message || "", context: d.context || "", files: d.files || [], leadId: d.leadId ?? null, itineraryId: d.itineraryId ?? null };
  })
  .handler(async ({ data, context }): Promise<PlannerResult> => {
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

    let leadKnowledge = "";
    let leadDestination = "";
    if (data.leadId) {
      const { data: lead } = await context.supabase
        .from("crm_leads")
        .select("*")
        .eq("id", data.leadId)
        .maybeSingle();
      if (lead) {
        if (typeof lead.destination === "string") leadDestination = lead.destination.trim();
        const lines: string[] = [];
        const profile = (lead.profile && typeof lead.profile === "object" ? lead.profile : {}) as Record<string, unknown>;
        const fmt = (val: unknown) =>
          typeof val === "object" ? JSON.stringify(val) : String(val);
        const section = (title: string, fields: Array<[string, unknown]>) => {
          const valid = fields.filter(([, v]) => v !== null && v !== undefined && v !== "");
          if (!valid.length) return;
          lines.push(`\n[${title}]`);
          for (const [label, v] of valid) lines.push(`- ${label}: ${fmt(v)}`);
        };

        section("PESSOAL", [
          ["Nome", lead.name],
          ["Email", lead.email],
          ["Telefone/WhatsApp", lead.phone],
          ["Origem do lead", lead.origin],
          ["Status do lead", lead.status],
          ["Orçamento estimado", lead.value],
        ]);
        section("VIAGEM", [
          ["Destino de interesse", lead.destination],
          ["Datas/Período da viagem", profile.travel_dates],
          ["Quantidade de passageiros", profile.passengers],
          ["Tipo de viagem", profile.trip_type],
          ["Observações da viagem", profile.trip_notes],
          ["Preferências", profile.preferences],
        ]);
        section("BENEFÍCIOS", [
          ["Programas de fidelidade", profile.loyalty_programs],
          ["Pontos/Milhas", profile.points_miles],
          ["Possui passaporte", profile.has_passport],
        ]);
        section("VOOS & HOTEL", [
          ["Classe de voo", profile.flight_class],
          ["Companhia aérea preferida", profile.airline_pref],
          ["Categoria de hotel", profile.hotel_category],
          ["Tipo de quarto", profile.room_type],
          ["Observações de hotel", profile.hotel_notes],
        ]);

        // Captura quaisquer campos extras do perfil não mapeados acima
        const mapped = new Set([
          "travel_dates", "passengers", "trip_type", "trip_notes", "preferences",
          "loyalty_programs", "points_miles", "has_passport", "flight_class",
          "airline_pref", "hotel_category", "room_type", "hotel_notes",
        ]);
        const extras = Object.entries(profile).filter(
          ([k, v]) => !mapped.has(k) && v !== null && v !== undefined && v !== "",
        );
        if (extras.length) section("OUTROS DADOS", extras);
        if (lead.notes) section("ANOTAÇÕES", [["Observações", lead.notes]]);
        if (lead.checklists && typeof lead.checklists === "object") {
          section("CHECKLISTS", [["Checklists", lead.checklists]]);
        }

        if (lines.length) {
          leadKnowledge = `\n\nBASE DE CONHECIMENTO DO LEAD — todos os campos preenchidos em todas as abas (PESSOAL, VIAGEM, BENEFÍCIOS, VOOS & HOTEL). Use SEMPRE estes dados como base ao compor o roteiro:${lines.join("\n")}`;
        }
      }

    }

    let pastItineraries = "";
    if (data.leadId) {
      const { data: its } = await context.supabase
        .from("crm_itineraries")
        .select("id,title,status,start_date,end_date,passengers,notes,crm_itinerary_days(title,description,crm_itinerary_activities(title,description,location,time))")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (its && its.length) {
        const parts: string[] = [];
        for (const it of its as any[]) {
          const dayLines: string[] = [];
          for (const d of (it.crm_itinerary_days ?? [])) {
            const acts = (d.crm_itinerary_activities ?? [])
              .map((a: any) => `    • ${[a.time, a.title, a.location].filter(Boolean).join(" — ")}${a.description ? `: ${a.description}` : ""}`)
              .join("\n");
            dayLines.push(`  - ${d.title || "Dia"}${d.description ? ` (${d.description})` : ""}${acts ? `\n${acts}` : ""}`);
          }
          parts.push(
            `Roteiro "${it.title || "Sem título"}" [${it.status}]${it.start_date ? ` ${it.start_date}→${it.end_date ?? ""}` : ""}${it.passengers ? ` · ${it.passengers} pax` : ""}${it.notes ? `\n  Obs: ${it.notes}` : ""}${dayLines.length ? `\n${dayLines.join("\n")}` : ""}`,
          );
        }
        if (parts.length) {
          pastItineraries = `\n\nOUTROS ROTEIROS DESTE LEAD (use como referência de preferências, estilo, destinos, ritmo, hotéis e observações já validadas — não copie cegamente, adapte ao roteiro atual):\n${parts.join("\n\n")}`;
        }
      }
    }

    let leadDocuments = "";
    if (data.leadId) {
      const { data: docs } = await (context.supabase as any)
        .from("crm_lead_documents")
        .select("name,category,content,created_at")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (docs && docs.length) {
        const parts = (docs as any[]).map((d) => {
          const head = `- ${d.name}${d.category ? ` [${d.category}]` : ""}`;
          const body = d.content ? `\n    ${String(d.content).slice(0, 800)}` : "";
          return `${head}${body}`;
        });
        leadDocuments = `\n\nDOCUMENTOS DO LEAD (ingressos, passagens, vouchers, reservas e outros anexos das atividades — use as informações já confirmadas para compor e validar o roteiro):\n${parts.join("\n")}`;
      }
    }

    // Baixa os arquivos realmente anexados às atividades deste roteiro e os envia
    // à IA para que ela leia/interprete o conteúdo (e não apenas o nome).
    const attachedFiles: PlannerFile[] = [];
    let attachmentsIndex = "";
    if (data.itineraryId) {
      const { data: atts } = await (context.supabase as any)
        .from("crm_lead_documents")
        .select("name,category,file_path,mime_type,activity_id")
        .eq("itinerary_id", data.itineraryId)
        .not("activity_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(8);
      if (atts && atts.length) {
        const lines: string[] = [];
        for (const a of atts as any[]) {
          try {
            const { data: signed } = await context.supabase.storage
              .from("trip-attachments")
              .createSignedUrl(a.file_path, 600);
            if (!signed?.signedUrl) continue;
            const res = await fetch(signed.signedUrl);
            if (!res.ok) continue;
            const buf = await res.arrayBuffer();
            const base64 = Buffer.from(buf).toString("base64");
            const mime = a.mime_type || res.headers.get("content-type") || "application/octet-stream";
            attachedFiles.push({ base64, mime, name: a.name });
            lines.push(`- "${a.name}"${a.category ? ` [${a.category}]` : ""} → atividade [id:${a.activity_id}]`);
          } catch {
            /* ignora anexo com falha */
          }
        }
        if (lines.length) {
          attachmentsIndex = `\n\nANEXOS DAS ATIVIDADES (arquivos enviados junto nesta requisição — leia cada um e COMPLETE a atividade correspondente pelo [id:...] indicado, preenchendo horário, local, título correto, tipo, descrição, duração e custo):\n${lines.join("\n")}`;
        }
      }
    }

    // A biblioteca é o "acervo de memória" do assistente. Antes de compor, se o
    // destino do lead for conhecido e ainda não houver fotos suficientes dele na
    // biblioteca, buscamos fotos reais em fontes abertas e as armazenamos para
    // reuso futuro em outros roteiros.
    let libraryMemoryNote = "";
    if (leadDestination) {
      try {
        const { data: member } = await context.supabase
          .from("agency_members")
          .select("agency_id,id")
          .eq("user_id", context.userId)
          .maybeSingle();
        if (member?.agency_id) {
          const { data: destImgs } = await (context.supabase as any)
            .from("crm_library_items")
            .select("title")
            .eq("agency_id", member.agency_id)
            .eq("type", "image")
            .ilike("location", `%${leadDestination}%`);
          const existingTitles = (destImgs as { title: string }[] | null)?.map((d) => d.title) ?? [];
          if (existingTitles.length < 3) {
            const first = leadDestination.split(",")[0].trim();
            const { ensureDestinationImages } = await import("./library-memory.server");
            const added = await ensureDestinationImages({
              supabase: context.supabase as any,
              agencyId: member.agency_id,
              memberId: member.id ?? null,
              destination: leadDestination,
              queries: [
                leadDestination,
                `${leadDestination} landmark`,
                `${leadDestination} tourist attraction`,
                first,
              ].filter((v, i, a) => !!v && a.indexOf(v) === i),
              existingTitles,
              maxToAdd: 4,
            });
            if (added.length) {
              libraryMemoryNote = `\n\nNOVAS IMAGENS ADICIONADAS AO ACERVO DA BIBLIOTECA (fotos reais de ${leadDestination}, agora disponíveis para reuso): ${added
                .map((a) => a.title)
                .join("; ")}. Você pode sugerir usá-las nas dicas/atividades do destino.`;
            }
          }
        }
      } catch {
        /* falha ao enriquecer a biblioteca não deve bloquear o planejamento */
      }
    }

    let library = "";
    {
      const { data: libItems } = await (context.supabase as any)
        .from("crm_library_items")
        .select("type,title,location,description,content,price,days,tags")
        .order("created_at", { ascending: false })
        .limit(80);
      if (libItems && libItems.length) {
        const typeLabel: Record<string, string> = {
          experience: "Experiência",
          package: "Pacote",
          image: "Imagem",
          itinerary: "Roteiro modelo",
        };
        const ctxLower = (data.context || "").toLowerCase();
        const destLower = leadDestination.toLowerCase();
        // Prioriza itens do destino do lead; mantém os demais como conhecimento geral.
        const ranked = (libItems as any[]).slice().sort((a, b) => {
          const am = destLower && `${a.location ?? ""} ${a.title ?? ""}`.toLowerCase().includes(destLower) ? 1 : 0;
          const bm = destLower && `${b.location ?? ""} ${b.title ?? ""}`.toLowerCase().includes(destLower) ? 1 : 0;
          return bm - am;
        });
        const parts = ranked.map((l) => {
          const used = l.title && ctxLower.includes(String(l.title).toLowerCase()) ? " (JÁ NO ROTEIRO — não repetir)" : "";
          const head = `- [${typeLabel[l.type] || l.type}] ${l.title}${l.location ? ` (${l.location})` : ""}${l.type === "package" && l.price ? ` — ${l.price}${l.days ? `/${l.days}d` : ""}` : ""}${used}`;
          const tags = Array.isArray(l.tags) && l.tags.length ? ` [tags: ${l.tags.join(", ")}]` : "";
          const body = [l.description, l.content].filter(Boolean).join(" ").slice(0, 600);
          return `${head}${tags}${body ? `\n    ${body}` : ""}`;
        });
        library = `\n\nBIBLIOTECA DA AGÊNCIA — ACERVO DE MEMÓRIA (experiências, pacotes, imagens e roteiros modelo reutilizáveis). Priorize itens relacionados ao destino do lead e NÃO repita itens já marcados como "(JÁ NO ROTEIRO)":\n${parts.join("\n")}${libraryMemoryNote}`;
      } else {
        library = libraryMemoryNote;
      }
    }


    const prompt = `${PLANNER_PROMPT}\n\nCONTEXTO DO ROTEIRO:\n${data.context}${leadKnowledge}${pastItineraries}${leadDocuments}${attachmentsIndex}${library}\n\nMENSAGEM DO CONSULTOR:\n${data.message || "(sem mensagem — use os documentos enviados)"}`;



    const { askWithFiles } = await import("./ai.server");
    const text = await askWithFiles(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: Math.max(cfg.max_tokens ?? 0, 4096),
      },
      prompt,
      [...data.files, ...attachedFiles],
    );
    return parsePlannerJson(text);
  });
