// Server-only helpers that talk to external LLM providers.
// Supported providers: "openai", "anthropic", "google".
import type { ExtractedDocData } from "@/lib/types";

type ProviderConfig = {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt?: string | null;
  maxTokens?: number | null;
};

const EXTRACTION_PROMPT = `Você é um assistente que lê documentos de viagem (passagens aéreas, reservas de hotel, transfers, vouchers).
Extraia as informações relevantes e responda APENAS com um JSON válido, sem texto extra, no formato:
{
  "type": "voo|hotel|transfer|passeio|outro",
  "title": "título curto do item",
  "date": "AAAA-MM-DD ou vazio",
  "time": "HH:MM ou vazio",
  "location": "local/aeroporto/cidade ou vazio",
  "flight_number": "número do voo ou vazio",
  "hotel_name": "nome do hotel ou vazio",
  "room": "tipo/numero do quarto ou vazio",
  "provider": "companhia/fornecedor ou vazio",
  "code": "localizador/código da reserva ou vazio",
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
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Não foi possível interpretar o documento.");
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
