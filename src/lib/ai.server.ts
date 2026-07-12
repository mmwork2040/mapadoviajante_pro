// Server-only helpers that talk to external LLM providers.
// Supported providers: "openai", "anthropic", "google".
import type { ExtractedDocData, HotelOption } from "@/lib/types";

type ProviderConfig = {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt?: string | null;
  maxTokens?: number | null;
};

const EXTRACTION_PROMPT = `Você é um assistente que lê documentos de viagem: ingressos de parques/atrações, passeios, passagens aéreas, reservas de hotel, transfers e vouchers.
SEMPRE identifique e extraia obrigatoriamente: o TIPO da atividade, o DIA (data) e o HORÁRIO. Se houver horário de início e fim, use o horário de início em "time".
PRIORIDADE MÁXIMA — DATAS DE UTILIZAÇÃO: em cartões de embarque, passagens, bilhetes, tickets, vouchers e ingressos, SEMPRE extraia a DATA de utilização (não só o horário). Reconheça datas em qualquer formato (DD/MM/AAAA, DD/MM/AA, DD-MMM, "10 JUL", "10 de julho", ao lado de "DATE", "DATA", "EMBARQUE", "BOARDING", "VALID") e converta para AAAA-MM-DD. NUNCA deixe "date" vazio se houver qualquer indício de data no documento, mas NUNCA invente uma data quando o documento mostrar apenas horários. Em cartões/passagens de ida e volta, NÃO reaproveite a mesma data para os dois trechos: cada trecho precisa da sua própria data visível; se a data da volta não estiver visível, deixe a volta com "date" vazio em vez de copiar a data da ida.
Extraia as informações relevantes e responda APENAS com um JSON válido, sem texto extra, no formato:
{
  "type": "voo|hotel|transfer|passeio|ingresso|outro",
  "title": "título curto do item (ex: Ingresso Disney Magic Kingdom)",
  "date": "AAAA-MM-DD ou vazio",
  "time": "HH:MM ou vazio",
  "duration": "duração estimada (ex: 2h) ou vazio",
  "location": "cidade/local/aeroporto/atração ou vazio",
  "city": "cidade principal do item ou vazio",
  "transport": "meio de transporte (existente ou sugerido) ou vazio",
  "time_suggested": true se o horário foi sugerido pela IA, false se veio do documento,
  "flight_number": "número do voo ou vazio",
  "hotel_name": "nome do hotel ou vazio",
  "room": "tipo/numero do quarto ou vazio",
  "provider": "companhia/fornecedor ou vazio",
  "code": "localizador/código da reserva ou vazio",
  "cost": valor total como número (sem moeda) ou 0,
  "people": quantidade de pessoas como número inteiro ou 0,
  "description": "resumo das informações encontradas"
}`;

async function callOpenAI(cfg: ProviderConfig, content: unknown): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxTokens || 1024,
      messages: [
        ...(cfg.systemPrompt ? [{ role: "system", content: cfg.systemPrompt }] : []),
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(cfg: ProviderConfig, content: unknown): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxTokens || 1024,
      ...(cfg.systemPrompt ? { system: cfg.systemPrompt } : {}),
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
}

async function callGoogle(cfg: ProviderConfig, parts: unknown[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(cfg.systemPrompt
        ? { systemInstruction: { parts: [{ text: cfg.systemPrompt }] } }
        : {}),
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: cfg.maxTokens || 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

export async function testConnection(cfg: ProviderConfig): Promise<{ ok: boolean; message: string }> {
  const prompt = "Responda apenas com a palavra: OK";
  try {
    let text = "";
    if (cfg.provider === "openai") text = await callOpenAI(cfg, prompt);
    else if (cfg.provider === "anthropic") text = await callAnthropic(cfg, prompt);
    else if (cfg.provider === "google") text = await callGoogle(cfg, [{ text: prompt }]);
    else throw new Error("Provedor não suportado.");
    if (!text.trim()) throw new Error("Resposta vazia do provedor.");
    return { ok: true, message: text.trim().slice(0, 80) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Falha na conexão." };
  }
}

function parseJsonLoose(text: string): ExtractedDocData {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("Não foi possível interpretar o documento.");
  // Walk from the first "{" and match braces to find the end of the first object,
  // ignoring braces inside strings. This avoids trailing text/extra objects.
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error("Não foi possível interpretar o documento.");
  return JSON.parse(cleaned.slice(start, end + 1)) as ExtractedDocData;
}


export async function extractDocument(
  cfg: ProviderConfig,
  fileBase64: string,
  mime: string,
): Promise<ExtractedDocData> {
  const isImage = mime.startsWith("image/");
  const dataUrl = `data:${mime};base64,${fileBase64}`;
  let text = "";

  if (cfg.provider === "openai") {
    const filePart = isImage
      ? { type: "image_url", image_url: { url: dataUrl } }
      : { type: "file", file: { filename: "documento.pdf", file_data: dataUrl } };
    text = await callOpenAI(cfg, [{ type: "text", text: EXTRACTION_PROMPT }, filePart]);
  } else if (cfg.provider === "anthropic") {
    const filePart = isImage
      ? { type: "image", source: { type: "base64", media_type: mime, data: fileBase64 } }
      : { type: "document", source: { type: "base64", media_type: mime, data: fileBase64 } };
    text = await callAnthropic(cfg, [{ type: "text", text: EXTRACTION_PROMPT }, filePart]);
  } else if (cfg.provider === "google") {
    text = await callGoogle(cfg, [
      { text: EXTRACTION_PROMPT },
      { inline_data: { mime_type: mime, data: fileBase64 } },
    ]);
  } else {
    throw new Error("Provedor não suportado.");
  }

  return parseJsonLoose(text);
}

const MULTI_EXTRACTION_PROMPT = `Você é um assistente especialista que analisa MINUCIOSAMENTE qualquer documento relacionado a uma viagem: ingressos, passagens aéreas/rodoviárias, tickets, e-tickets, vouchers, reservas de hotel/pousada, transfers, passeios/tours, aluguel de carro, restaurantes/reservas gastronômicas, seguros de viagem, roteiros descritivos, propostas, comprovantes e confirmações.
O objetivo é ALIMENTAR OU COMPLEMENTAR o roteiro do cliente: identifique pontos-chave (passagens, hospedagens, restaurantes, passeios, transportes) e monte itens que possam ser distribuídos nos dias corretos.
Identifique TODAS as atividades/itens presentes no documento, inclusive quando descritos em texto corrido. Para cada um, extraia obrigatoriamente o TIPO, a DATA e o HORÁRIO quando existirem. Se houver horário de início e fim, use o de início em "time".
PRIORIDADE MÁXIMA — DATAS DE UTILIZAÇÃO: em cartões de embarque, passagens, bilhetes, tickets, vouchers, ingressos ou similares, SEMPRE identifique e extraia as DATAS de utilização, não apenas os horários. Procure a data em qualquer formato (DD/MM/AAAA, DD/MM/AA, DD-MMM, "10 JUL", "10 de julho", datas ao lado de "DATE", "DATA", "EMBARQUE", "BOARDING", "VALID", "VÁLIDO", etc.) e converta para AAAA-MM-DD. Se o ano não constar, assuma o ano da viagem pelo contexto. NUNCA deixe "date" vazio quando houver qualquer indício de data no documento, mas NUNCA invente uma data quando o documento mostrar apenas horários. Em cartões/passagens de ida e volta, NÃO reaproveite a mesma data para os dois trechos: cada trecho precisa da sua própria data visível; se a data da volta não estiver visível, deixe a volta com "date" vazio em vez de copiar a data da ida. Nunca coloque itens de ida e volta em um único dia se as datas forem ausentes ou conflitantes; retorne a data vazia para o trecho incerto para o app bloquear a importação até o período ser informado.
Regras importantes de análise:
- Cartão de embarque / passagens / voos: crie um item para a IDA e outro para a VOLTA (quando houver), CADA UM com sua PRÓPRIA data e horário. Se o cartão cobrir ida e volta, os dois itens devem ter datas diferentes. Inclua escalas relevantes no "description".
- Ingressos/tickets/vouchers: use a data de utilização/validade em "date".
- Restaurantes/refeições: crie um item do tipo "restaurante" com a data/horário da reserva (quando houver) e o nome do local em "location".
- Passeios/tours/transportes: registre data, horário, ponto de encontro/local e fornecedor quando disponíveis.
- Hospedagem: use a data de check-in em "date" e registre check-in/check-out no "description".
- Seguros: use a data de início da cobertura em "date" e o período no "description".
- CIDADES/LOCAIS: sempre identifique a cidade (e país/região quando houver) de cada item e registre em "location". Se um item pertencer a uma cidade citada em outra parte do documento, associe-o a ela.
- ATIVIDADES: capture TODAS as atividades, passeios, experiências, refeições e visitas mencionadas, mesmo em texto corrido, criando um item para cada uma.
- MEIOS DE TRANSPORTE: para cada atividade/deslocamento, identifique o meio de transporte (a pé, carro, transfer, ônibus, metrô, trem, avião, barco, etc.) e registre em "transport". Se o documento sugerir ou implicar o transporte, indique-o como sugestão.
- HORÁRIOS: use os horários existentes no documento em "time". Quando não houver horário mas a sequência lógica do dia permitir estimar, preencha "time" com um horário SUGERIDO coerente e marque "time_suggested": true. Se o horário for explícito no documento, use "time_suggested": false.
- Seja minucioso: não invente dados factuais (datas, códigos, valores); deixe vazio o que não constar. Apenas horários e transporte podem ser SUGERIDOS quando marcados como tal.
Responda APENAS com um ARRAY JSON válido (sem texto extra), onde cada elemento tem o formato:
{
  "type": "voo|hotel|transfer|passeio|restaurante|ingresso|seguro|aluguel|outro",
  "title": "título curto do item",
  "date": "AAAA-MM-DD ou vazio",
  "time": "HH:MM ou vazio",
  "duration": "duração estimada ou vazio",
  "location": "cidade/local/aeroporto/atração ou vazio",
  "city": "cidade principal do item ou vazio",
  "transport": "meio de transporte (existente ou sugerido) ou vazio",
  "time_suggested": true se o horário foi sugerido pela IA, false se veio do documento,
  "flight_number": "número do voo ou vazio",
  "hotel_name": "nome do hotel ou vazio",
  "room": "tipo/numero do quarto ou vazio",
  "provider": "companhia/fornecedor ou vazio",
  "code": "localizador/código da reserva ou vazio",
  "cost": valor total como número (sem moeda) ou 0,
  "people": quantidade de pessoas como número inteiro ou 0,
  "description": "resumo das informações encontradas, incluindo cidade, atividade e transporte"
}
Se houver apenas um item, retorne um array com um único elemento. Nunca retorne texto fora do array JSON.`;

// Contexto do roteiro já existente para evitar conflitos e duplicidades.
const EXISTING_CONTEXT_PROMPT = (ctx: string) =>
  `\n\nCONTEXTO DO ROTEIRO JÁ MONTADO (dias e itens já adicionados). Use-o para evitar conflitos de datas/horários e NÃO repetir itens que já existem. Se um item do documento já estiver presente no roteiro (mesmo voo, mesma reserva, mesmo ingresso, mesma data/horário), NÃO o inclua novamente na resposta:\n${ctx}`;

function parseJsonArrayLoose(text: string): ExtractedDocData[] {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(arr)) return arr as ExtractedDocData[];
    } catch {
      // fall through to single-object parsing
    }
  }
  // Fallback: try to parse a single object.
  return [parseJsonLoose(cleaned)];
}

export async function extractDocumentActivities(
  cfg: ProviderConfig,
  fileBase64: string,
  mime: string,
  existingContext?: string,
): Promise<ExtractedDocData[]> {
  const isImage = mime.startsWith("image/");
  const dataUrl = `data:${mime};base64,${fileBase64}`;
  const prompt =
    MULTI_EXTRACTION_PROMPT +
    (existingContext && existingContext.trim() ? EXISTING_CONTEXT_PROMPT(existingContext.trim()) : "");
  // Documentos com muitos itens (planilhas exportadas, PDFs longos) precisam de
  // espaço de saída suficiente para não truncar o array JSON de atividades.
  const bigCfg = { ...cfg, maxTokens: Math.max(cfg.maxTokens || 0, 8192) };
  let text = "";

  if (cfg.provider === "openai") {
    const filePart = isImage
      ? { type: "image_url", image_url: { url: dataUrl } }
      : { type: "file", file: { filename: "documento.pdf", file_data: dataUrl } };
    text = await callOpenAI(bigCfg, [{ type: "text", text: prompt }, filePart]);
  } else if (cfg.provider === "anthropic") {
    const filePart = isImage
      ? { type: "image", source: { type: "base64", media_type: mime, data: fileBase64 } }
      : { type: "document", source: { type: "base64", media_type: mime, data: fileBase64 } };
    text = await callAnthropic(bigCfg, [{ type: "text", text: prompt }, filePart]);
  } else if (cfg.provider === "google") {
    text = await callGoogle(bigCfg, [
      { text: prompt },
      { inline_data: { mime_type: mime, data: fileBase64 } },
    ]);
  } else {
    throw new Error("Provedor não suportado.");
  }


  return parseJsonArrayLoose(text).filter((x) => x && (x.title || x.hotel_name || x.flight_number || x.description));
}

// Variante para conteúdo textual (ex.: planilhas do Drive convertidas em texto,
// varrendo todas as abas/colunas/linhas). Reaproveita o mesmo prompt de extração.
export async function extractActivitiesFromText(
  cfg: ProviderConfig,
  documentText: string,
  existingContext?: string,
): Promise<ExtractedDocData[]> {
  const prompt =
    MULTI_EXTRACTION_PROMPT +
    (existingContext && existingContext.trim() ? EXISTING_CONTEXT_PROMPT(existingContext.trim()) : "") +
    `\n\nCONTEÚDO DO DOCUMENTO (texto extraído; planilhas incluem todas as abas, colunas e linhas — analise tudo em busca de informações úteis ao roteiro):\n${documentText.slice(0, 120000)}`;
  // Planilhas grandes geram muitos itens; garanta espaço de saída suficiente
  // para não truncar o array JSON (senão parece que "não leu tudo").
  const bigCfg = { ...cfg, maxTokens: Math.max(cfg.maxTokens || 0, 8192) };
  let text = "";
  if (cfg.provider === "openai") text = await callOpenAI(bigCfg, prompt);
  else if (cfg.provider === "anthropic") text = await callAnthropic(bigCfg, prompt);
  else if (cfg.provider === "google") text = await callGoogle(bigCfg, [{ text: prompt }]);
  else throw new Error("Provedor não suportado.");
  return parseJsonArrayLoose(text).filter((x) => x && (x.title || x.hotel_name || x.flight_number || x.description));
}




type InputFile = { base64: string; mime: string; name?: string };

// Envia um prompt de texto + vários arquivos (imagens/PDFs) ao provedor e retorna o texto.
export async function askWithFiles(
  cfg: ProviderConfig,
  prompt: string,
  files: InputFile[],
): Promise<string> {
  let text = "";

  if (cfg.provider === "openai") {
    const parts: unknown[] = [{ type: "text", text: prompt }];
    for (const f of files) {
      const dataUrl = `data:${f.mime};base64,${f.base64}`;
      parts.push(
        f.mime.startsWith("image/")
          ? { type: "image_url", image_url: { url: dataUrl } }
          : { type: "file", file: { filename: f.name || "documento.pdf", file_data: dataUrl } },
      );
    }
    text = await callOpenAI(cfg, parts);
  } else if (cfg.provider === "anthropic") {
    const parts: unknown[] = [{ type: "text", text: prompt }];
    for (const f of files) {
      parts.push(
        f.mime.startsWith("image/")
          ? { type: "image", source: { type: "base64", media_type: f.mime, data: f.base64 } }
          : { type: "document", source: { type: "base64", media_type: f.mime, data: f.base64 } },
      );
    }
    text = await callAnthropic(cfg, parts);
  } else if (cfg.provider === "google") {
    const parts: unknown[] = [{ text: prompt }];
    for (const f of files) {
      parts.push({ inline_data: { mime_type: f.mime, data: f.base64 } });
    }
    text = await callGoogle(cfg, parts);
  } else {
    throw new Error("Provedor não suportado.");
  }

  if (!text.trim()) throw new Error("Resposta vazia do provedor.");
  return text.trim();
}

export async function askCopilot(cfg: ProviderConfig, prompt: string): Promise<string> {
  let text = "";
  if (cfg.provider === "openai") text = await callOpenAI(cfg, prompt);
  else if (cfg.provider === "anthropic") text = await callAnthropic(cfg, prompt);
  else if (cfg.provider === "google") text = await callGoogle(cfg, [{ text: prompt }]);
  else throw new Error("Provedor não suportado.");
  if (!text.trim()) throw new Error("Resposta vazia do provedor.");
  return text.trim();
}

export type ParsedPeriod = {
  valid: boolean;
  start_date: string;
  end_date: string;
  message: string;
};

// Interpreta um período de viagem informado em texto livre e retorna datas.
export async function parseTravelPeriod(
  cfg: ProviderConfig,
  input: string,
): Promise<ParsedPeriod> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Você é um assistente que interpreta períodos de viagem informados em texto livre, em português do Brasil. A data de hoje é ${today}.
Dado o texto do usuário, determine a data inicial e a data final da viagem no formato AAAA-MM-DD.
Regras:
- Interprete expressões como "Jul/2026, 10 dias", "de 10 a 20 de julho de 2026", "próxima semana por 5 noites", "primeira quinzena de dezembro".
- Se só houver mês/ano e uma duração, calcule a data final somando a duração à data inicial.
- Se o texto for ambíguo, contraditório, impossível (ex: data final antes da inicial) ou não representar um período de viagem válido, marque "valid": false e explique brevemente o problema em "message".
- Nunca invente um período quando não houver informação suficiente: marque "valid": false.
Responda APENAS com um JSON válido, sem texto extra:
{
  "valid": true/false,
  "start_date": "AAAA-MM-DD ou vazio",
  "end_date": "AAAA-MM-DD ou vazio",
  "message": "explicação curta em português (resumo do período interpretado ou o motivo da invalidez)"
}

Texto do usuário: "${input.replace(/"/g, "'")}"`;

  const raw = await askCopilot(cfg, prompt);
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return { valid: false, start_date: "", end_date: "", message: "Não foi possível interpretar o período informado." };
  }
  let parsed: Partial<ParsedPeriod>;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<ParsedPeriod>;
  } catch {
    return { valid: false, start_date: "", end_date: "", message: "Não foi possível interpretar o período informado." };
  }
  const s = typeof parsed.start_date === "string" ? parsed.start_date : "";
  const e = typeof parsed.end_date === "string" ? parsed.end_date : "";
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  let valid = parsed.valid === true && isDate(s) && isDate(e);
  if (valid && new Date(e).getTime() < new Date(s).getTime()) valid = false;
  return {
    valid,
    start_date: valid ? s : "",
    end_date: valid ? e : "",
    message:
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : valid
          ? "Período interpretado com sucesso."
          : "O período informado é inválido.",
  };
}

export type CurrencyConversion = {
  ok: boolean;
  brl: number;
  rate: number;
  message: string;
};

// Converte um valor de uma moeda estrangeira para Real (BRL) usando a IA,
// com base na cotação aproximada do dia. Uso informativo.
export async function convertCurrencyToBRL(
  cfg: ProviderConfig,
  amount: number,
  currency: string,
): Promise<CurrencyConversion> {
  const today = new Date().toISOString().slice(0, 10);
  const cur = currency.toUpperCase().trim();
  if (cur === "BRL") {
    return { ok: true, brl: amount, rate: 1, message: "Valor já está em Real." };
  }
  const prompt = `Você é um assistente financeiro. A data de hoje é ${today}.
Converta o valor abaixo para Real brasileiro (BRL) usando a cotação aproximada mais recente que você conhece para a moeda informada.
Valor: ${amount}
Moeda de origem: ${cur}
Responda APENAS com um JSON válido, sem texto extra:
{
  "rate": número (quantos BRL vale 1 unidade da moeda de origem),
  "brl": número (valor convertido em BRL, com 2 casas decimais),
  "message": "observação curta em português citando a cotação usada"
}`;

  const raw = await askCopilot(cfg, prompt);
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return { ok: false, brl: 0, rate: 0, message: "Não foi possível obter a cotação." };
  }
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      rate?: number;
      brl?: number;
      message?: string;
    };
    const rate = typeof parsed.rate === "number" ? parsed.rate : 0;
    let brl = typeof parsed.brl === "number" ? parsed.brl : 0;
    if (!brl && rate) brl = amount * rate;
    if (!brl) return { ok: false, brl: 0, rate: 0, message: "Não foi possível obter a cotação." };
    return {
      ok: true,
      brl: Math.round(brl * 100) / 100,
      rate,
      message:
        typeof parsed.message === "string" && parsed.message.trim()
          ? parsed.message.trim()
          : `Cotação aproximada: 1 ${cur} ≈ ${rate} BRL.`,
    };
  } catch {
    return { ok: false, brl: 0, rate: 0, message: "Não foi possível obter a cotação." };
  }
}




const KNOWLEDGE_PROMPT = `Você recebe um documento (PDF, planilha, imagem ou texto) que servirá como base de conhecimento para uma IA de uma agência de viagens.
Extraia e organize TODO o conteúdo textual relevante (preços, regras, destinos, descrições, tabelas) em texto corrido limpo, em português.
Responda APENAS com o texto extraído, sem comentários adicionais.`;

// Extrai o texto de um documento para usar como base de conhecimento embutida.
export async function extractKnowledgeText(
  cfg: ProviderConfig,
  fileBase64: string,
  mime: string,
): Promise<string> {
  const isImage = mime.startsWith("image/");
  const dataUrl = `data:${mime};base64,${fileBase64}`;
  let text = "";

  if (cfg.provider === "openai") {
    const filePart = isImage
      ? { type: "image_url", image_url: { url: dataUrl } }
      : { type: "file", file: { filename: "documento", file_data: dataUrl } };
    text = await callOpenAI({ ...cfg, maxTokens: 4096 }, [{ type: "text", text: KNOWLEDGE_PROMPT }, filePart]);
  } else if (cfg.provider === "anthropic") {
    const filePart = isImage
      ? { type: "image", source: { type: "base64", media_type: mime, data: fileBase64 } }
      : { type: "document", source: { type: "base64", media_type: mime, data: fileBase64 } };
    text = await callAnthropic({ ...cfg, maxTokens: 4096 }, [{ type: "text", text: KNOWLEDGE_PROMPT }, filePart]);
  } else if (cfg.provider === "google") {
    text = await callGoogle({ ...cfg, maxTokens: 4096 }, [
      { text: KNOWLEDGE_PROMPT },
      { inline_data: { mime_type: mime, data: fileBase64 } },
    ]);
  } else {
    throw new Error("Provedor não suportado.");
  }

  if (!text.trim()) throw new Error("Não foi possível extrair o conteúdo do documento.");
  return text.trim();
}

export type ImageActivityAnalysis = {
  matches: boolean;
  type: string;
  title: string;
  reason: string;
  location: string;
  description: string;
  content: string;
};

// Interpreta uma imagem anexada a um dia do roteiro: identifica o tipo de
// atividade e avalia se ela é coerente com o destino e o roteiro.
export async function analyzeImageForItinerary(
  cfg: ProviderConfig,
  fileBase64: string,
  mime: string,
  ctx: { destination?: string; itineraryTitle?: string; activityTitle?: string; existingContext?: string },
): Promise<ImageActivityAnalysis> {
  const prompt = `Você analisa uma IMAGEM que um agente de viagens quer anexar a um dia de um roteiro, SEMPRE com foco no DESTINO do lead.
Faça uma análise PROFUNDA: a imagem pode mostrar um ponto turístico, atração, paisagem, hotel, restaurante, meio de transporte, mapa, ingresso, folheto ou informação útil da viagem. Identifique com precisão o que ela representa e a que local/atração se refere.
Use seu conhecimento geográfico e turístico para identificar a atração com PRECISÃO e ATENÇÃO a semelhanças. Muitos monumentos são visualmente parecidos mas ficam em cidades diferentes — analise detalhes arquitetônicos, fachadas, torres, entorno e placas para distinguir o local exato (ex.: a Catedral de Amiens e a Catedral de Reims lembram a Notre-Dame de Paris, mas são de OUTRAS cidades). Só marque "matches": true quando tiver identificado que a atração realmente pertence ao destino do lead (cidade, região ou país). Reconheça atrações famosas do destino mesmo sem legenda.
Marque "matches": false apenas quando a imagem claramente NÃO tiver relação com o destino: for de outro destino distinto, um print aleatório, meme, documento pessoal irrelevante ou conteúdo sem qualquer ligação turística com o destino. Não recuse imagens de atrações legítimas do destino só por falta de legenda.
Destino: ${ctx.destination || "—"}
Roteiro: ${ctx.itineraryTitle || "—"}
Atividade do dia: ${ctx.activityTitle || "—"}
${ctx.existingContext ? `Contexto do roteiro:\n${ctx.existingContext}` : ""}
Responda APENAS com um JSON válido, sem texto extra:
{
  "matches": true/false,
  "type": "passeio|hotel|restaurante|voo|transfer|ingresso|paisagem|outro",
  "title": "título curto do que a imagem mostra",
  "location": "local/cidade/atração/destino que a imagem representa ou vazio",
  "description": "descrição curta (1-2 frases) do que a imagem mostra",
  "content": "texto detalhado para a base de conhecimento da IA: contexto, dicas e informações úteis sobre o ponto turístico/atração/serviço mostrado, sempre ligado ao destino",
  "reason": "explicação curta em português do porquê a imagem se relaciona (ou não) com o destino"
}`;

  const isImage = mime.startsWith("image/");
  if (!isImage) throw new Error("O arquivo enviado não é uma imagem.");
  const dataUrl = `data:${mime};base64,${fileBase64}`;
  let text = "";

  if (cfg.provider === "openai") {
    text = await callOpenAI(cfg, [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: dataUrl } },
    ]);
  } else if (cfg.provider === "anthropic") {
    text = await callAnthropic(cfg, [
      { type: "text", text: prompt },
      { type: "image", source: { type: "base64", media_type: mime, data: fileBase64 } },
    ]);
  } else if (cfg.provider === "google") {
    text = await callGoogle(cfg, [
      { text: prompt },
      { inline_data: { mime_type: mime, data: fileBase64 } },
    ]);
  } else {
    throw new Error("Provedor não suportado.");
  }

  const empty: ImageActivityAnalysis = {
    matches: false,
    type: "outro",
    title: "",
    reason: "Não foi possível interpretar a imagem.",
    location: "",
    description: "",
    content: "",
  };
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return empty;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<ImageActivityAnalysis>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      matches: parsed.matches === true,
      type: str(parsed.type) || "outro",
      title: str(parsed.title),
      reason: str(parsed.reason),
      location: str(parsed.location),
      description: str(parsed.description),
      content: str(parsed.content),
    };
  } catch {
    return empty;
  }
}

