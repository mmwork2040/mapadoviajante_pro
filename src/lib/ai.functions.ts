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
export type PlannerResult = { reply: string; days: PlannedDay[] };

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
2. Datas da viagem (período ou datas de ida/volta)
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

Responda SEMPRE apenas com um JSON válido, sem texto extra, no formato:
{
  "reply": "mensagem amigável em português: dicas, o que montou, o que sugere e/ou o que ainda falta",
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
  };
}

export const itineraryPlanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PlannerInput) => {
    if (!d?.message?.trim() && !(d?.files?.length)) throw new Error("Envie uma mensagem ou um documento.");
    return { message: d.message || "", context: d.context || "", files: d.files || [] };
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

    const prompt = `${PLANNER_PROMPT}\n\nCONTEXTO DO ROTEIRO:\n${data.context}\n\nMENSAGEM DO CONSULTOR:\n${data.message || "(sem mensagem — use os documentos enviados)"}`;

    const { askWithFiles } = await import("./ai.server");
    const text = await askWithFiles(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: Math.max(cfg.max_tokens ?? 0, 4096),
      },
      prompt,
      data.files,
    );
    return parsePlannerJson(text);
  });
