import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Leitura dos PDFs da biblioteca para a IA.
//
// Quando alguém envia um PDF (roteiro modelo, documento geral ou anexo de um
// item), o arquivo só ficava guardado: a IA via o título e mais nada. Esta
// função baixa o arquivo direto do Appwrite pelo servidor (sem passar o PDF
// pelo navegador nem pelo limite de envio da Vercel), tira o texto e grava no
// campo `content` do registro. É esse campo que a IA lê ao montar roteiros.

const BUCKET = "trip-attachments";

// Tamanho máximo de `content` em cada coleção do Appwrite (com folga).
const CONTENT_LIMIT = {
  library: 95_000,
  document: 400_000,
} as const;

// Abaixo disso o PDF é tratado como imagem escaneada (sem camada de texto).
const MIN_TEXT_CHARS = 200;

// Limite para mandar um PDF escaneado à IA (os provedores aceitam até ~32 MB).
const AI_FALLBACK_MAX_BYTES = 20 * 1024 * 1024;

// Marca o começo do texto lido do arquivo, para que uma nova leitura troque o
// bloco antigo em vez de duplicá-lo e o texto escrito à mão seja preservado.
const MARKER = "[Texto lido do arquivo";

type IndexInput = { source: "library" | "document"; id: string };

export type IndexResult = {
  ok: boolean;
  /** Quantos caracteres de texto foram guardados para a IA. */
  chars: number;
  pages: number;
  method: "text" | "ai" | "none";
  message: string;
};

function isPdf(name: string | null | undefined, mime: string | null | undefined, bytes: Uint8Array): boolean {
  if (mime === "application/pdf" || /\.pdf$/i.test(name || "")) return true;
  // Assinatura "%PDF" no começo do arquivo.
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function cleanPageText(text: string): string {
  return text
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function downloadFile(fileId: string): Promise<Uint8Array> {
  const { appwriteServerConfig } = await import("@/integrations/appwrite/server");
  const cfg = appwriteServerConfig();
  if (!cfg.key) throw new Error("O servidor está sem a chave do Appwrite para ler o arquivo.");
  const res = await fetch(
    `${cfg.endpoint}/storage/buckets/${BUCKET}/files/${encodeURIComponent(fileId)}/download`,
    { headers: { "X-Appwrite-Project": cfg.project, "X-Appwrite-Key": cfg.key } },
  );
  if (!res.ok) throw new Error(`Não foi possível baixar o arquivo (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

async function pdfToText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // O pdf.js pode reaproveitar o buffer; passa uma cópia.
  const pdf = await getDocumentProxy(bytes.slice());
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[])
    .map((t, i) => {
      const clean = cleanPageText(t);
      return clean ? `[Página ${i + 1}]\n${clean}` : "";
    })
    .filter(Boolean);
  return { text: pages.join("\n\n"), pages: totalPages };
}

// PDF escaneado: pede à IA da agência para ler o arquivo, se estiver ligada.
async function aiFallback(context: any, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > AI_FALLBACK_MAX_BYTES) return "";
  try {
    const { loadAiSettings } = await import("@/lib/server/ai-settings");
    const { data: cfg } = await loadAiSettings(context);
    const ks = (cfg?.knowledge_sources as { status?: string } | null) ?? null;
    if (!cfg?.api_key_encrypted || ks?.status !== "connected") return "";
    const { extractKnowledgeText } = await import("./ai.server");
    return await extractKnowledgeText(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: cfg.max_tokens,
      } as any,
      Buffer.from(bytes).toString("base64"),
      "application/pdf",
    );
  } catch (err) {
    console.error("[biblioteca] leitura do PDF pela IA falhou:", err);
    return "";
  }
}

/** Junta o texto escrito à mão (se houver) com o bloco lido do arquivo. */
function mergeContent(existing: string | null | undefined, fileName: string, text: string, limit: number): string {
  const manual = (existing || "").split(MARKER)[0].trim();
  const header = `${MARKER} "${fileName}"]`;
  const room = limit - manual.length - header.length - 4;
  if (room <= 0) return manual.slice(0, limit);
  const body = text.length > room ? `${text.slice(0, room - 40)}\n[… texto cortado por tamanho]` : text;
  return manual ? `${manual}\n\n${header}\n${body}` : `${header}\n${body}`;
}

/**
 * Lê o PDF de um item da biblioteca (`library`) ou de um documento geral
 * (`document`) e guarda o texto no campo `content`, que a IA consulta.
 */
export const indexLibraryFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: IndexInput) => {
    if (d?.source !== "library" && d?.source !== "document") throw new Error("Origem inválida.");
    if (!d.id || typeof d.id !== "string") throw new Error("Arquivo inválido.");
    return { source: d.source, id: d.id };
  })
  .handler(async ({ data, context }): Promise<IndexResult> => {
    const { getMembership } = await import("@/lib/server/authz");
    await getMembership(context);

    // `context.supabase` só enxerga a agência do usuário: um id de outra
    // agência simplesmente não é encontrado.
    const table = data.source === "library" ? "crm_library_items" : "crm_lead_documents";
    const { data: row, error } = await (context.supabase as any)
      .from(table)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Arquivo não encontrado na biblioteca.");

    const fileId: string | null = data.source === "library" ? row.file_url : row.file_path;
    const fileName: string = (data.source === "library" ? row.file_name || row.title : row.name) || "arquivo.pdf";
    const none = (message: string): IndexResult => ({ ok: false, chars: 0, pages: 0, method: "none", message });

    // Caminhos com "/" são do armazenamento antigo (Supabase) e não existem mais.
    if (!fileId || fileId.includes("/")) return none("Este item não tem um arquivo para ler.");

    const bytes = await downloadFile(fileId);
    if (!isPdf(fileName, row.mime_type, bytes)) return none("O arquivo não é um PDF.");

    let pages = 0;
    let text = "";
    let method: IndexResult["method"] = "text";
    try {
      const out = await pdfToText(bytes);
      pages = out.pages;
      text = out.text;
    } catch (err) {
      console.error("[biblioteca] não foi possível ler o PDF:", err);
    }

    // Conta só letras e números, para não confundir marcas de página com texto.
    if (text.replace(/\[Página \d+\]|[^\p{L}\p{N}]/gu, "").length < MIN_TEXT_CHARS) {
      const viaAi = (await aiFallback(context, bytes)).trim();
      if (!viaAi) {
        return none(
          "O PDF parece ser uma imagem escaneada e não tem texto para ler. Ligue a IA na Administração ou envie uma versão com texto.",
        );
      }
      text = viaAi;
      method = "ai";
    }

    const content = mergeContent(row.content, fileName, text, CONTENT_LIMIT[data.source]);
    const { error: upErr } = await (context.supabase as any)
      .from(table)
      .update({ content })
      .eq("id", data.id);
    if (upErr) {
      console.error("[biblioteca] não foi possível salvar o texto do PDF:", upErr);
      throw new Error("Não foi possível salvar o texto do PDF.");
    }

    const chars = content.length;
    return {
      ok: true,
      chars,
      pages,
      method,
      message:
        method === "ai"
          ? "PDF escaneado lido pela IA e guardado na biblioteca."
          : `PDF lido${pages ? ` (${pages} páginas)` : ""} e guardado para a IA consultar.`,
    };
  });
