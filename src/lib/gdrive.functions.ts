import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada.");
  if (!connKey) throw new Error("Conector do Google Drive não conectado.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

// Tipos de arquivo que a IA consegue interpretar (imagens e PDF diretamente,
// e documentos nativos do Google que exportamos como PDF).
const GOOGLE_EXPORTABLE = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.spreadsheet",
]);

// Planilhas (Google Sheets ou arquivos enviados) são lidas por completo —
// todas as abas, colunas e linhas — e convertidas em texto para a IA.
const SPREADSHEET_MIMES = new Set([
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

function isSpreadsheet(mime: string): boolean {
  return SPREADSHEET_MIMES.has(mime);
}

// Planilhas com múltiplas abas (Google Sheets, xlsx, xls). CSV tem uma só aba.
export function isMultiSheet(mime: string): boolean {
  return isSpreadsheet(mime) && mime !== "text/csv";
}

// Baixa o binário de uma planilha do Drive (Google Sheets vira xlsx).
async function downloadSpreadsheetBuffer(fileId: string, mime: string): Promise<Buffer> {
  const isGoogleSheet = mime === "application/vnd.google-apps.spreadsheet";
  const url = isGoogleSheet
    ? `${GATEWAY}/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    : `${GATEWAY}/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: gatewayHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao baixar planilha do Drive [${res.status}]: ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Lista os nomes das abas de uma planilha do Drive, para o usuário escolher. */
export const listDriveSheetNames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ fileId: z.string().min(1), mimeType: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ sheets: string[] }> => {
    if (!isMultiSheet(data.mimeType)) return { sheets: [] };
    const buf = await downloadSpreadsheetBuffer(data.fileId, data.mimeType);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer", bookSheets: true });
    return { sheets: wb.SheetNames };
  });

// Documentos do Word enviados ao Drive (.docx) — lidos como texto.
const WORD_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function isWord(mime: string): boolean {
  return WORD_MIMES.has(mime);
}

function isSupported(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime.startsWith("image/") ||
    GOOGLE_EXPORTABLE.has(mime) ||
    isSpreadsheet(mime) ||
    isWord(mime)
  );

}


/** Verifica se o conector do Google Drive está conectado e acessível. */
export const checkDriveConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ connected: boolean }> => {
    try {
      const res = await fetch(`${GATEWAY}/files?pageSize=1&fields=files(id)`, {
        headers: gatewayHeaders(),
      });
      return { connected: res.ok };
    } catch {
      return { connected: false };
    }
  });

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

/** Lista arquivos suportados da pasta configurada (ou de todo o Drive). */
export const listDriveFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        folderId: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ files: DriveFile[] }> => {
    const clauses = ["trashed=false"];
    if (data.folderId?.trim()) clauses.push(`'${data.folderId.trim()}' in parents`);
    if (data.search?.trim()) {
      const safe = data.search.trim().replace(/'/g, "\\'");
      clauses.push(`name contains '${safe}'`);
    }
    const q = encodeURIComponent(clauses.join(" and "));
    const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime)");
    const url = `${GATEWAY}/files?q=${q}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc`;
    const res = await fetch(url, { headers: gatewayHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Falha ao listar arquivos do Drive [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { files?: DriveFile[] };
    const files = (json.files || []).filter((f) => isSupported(f.mimeType));
    return { files };
  });

export type DriveContent =
  | { kind: "file"; base64: string; mime: string; name: string }
  | { kind: "text"; text: string; name: string };

// Converte um workbook (xlsx/xls) em texto varrendo TODAS as abas, colunas e
// linhas — para a IA garimpar qualquer informação útil ao roteiro.
async function workbookToText(buf: Buffer, name: string, sheets?: string[]): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const wanted = sheets?.length ? new Set(sheets) : null;
  const parts: string[] = [`Arquivo: ${name}`];
  for (const sheetName of wb.SheetNames) {
    if (wanted && !wanted.has(sheetName)) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) parts.push(`\n### Aba: ${sheetName}\n${csv}`);
  }
  return parts.join("\n");
}

// Extrai o texto de um .docx (Word) descompactando o pacote e limpando o XML.
async function docxToText(buf: Buffer, name: string): Promise<string> {
  const { unzipSync } = await import("fflate");
  const files = unzipSync(new Uint8Array(buf));
  const xml = files["word/document.xml"];
  if (!xml) return `Arquivo: ${name}`;
  const raw = new TextDecoder().decode(xml);
  const text = raw
    .replace(/<w:p[ >]/g, "\n")
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `Arquivo: ${name}\n${text}`;
}


/**
 * Baixa o conteúdo de um arquivo do Drive. Planilhas (Google Sheets, xlsx, xls,
 * csv) são lidas por completo e devolvidas como texto (todas as abas/linhas).
 * Documentos/apresentações nativas do Google viram PDF; PDFs e imagens vão como
 * base64. Tudo alimenta o mesmo pipeline de "Documento (IA)".
 */
export const fetchDriveFileContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fileId: z.string().min(1),
        mimeType: z.string().min(1),
        name: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DriveContent> => {
    if (!isSupported(data.mimeType)) {
      throw new Error("Tipo de arquivo não suportado para leitura pela IA.");
    }
    const baseName = data.name || "documento";

    // Planilhas → texto completo (todas as abas/colunas/linhas).
    if (isSpreadsheet(data.mimeType)) {
      const isGoogleSheet = data.mimeType === "application/vnd.google-apps.spreadsheet";
      const url = isGoogleSheet
        ? `${GATEWAY}/files/${data.fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
        : `${GATEWAY}/files/${data.fileId}?alt=media`;
      const res = await fetch(url, { headers: gatewayHeaders() });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Falha ao baixar planilha do Drive [${res.status}]: ${body}`);
      }
      if (data.mimeType === "text/csv") {
        const text = await res.text();
        return { kind: "text", text: `Arquivo: ${baseName}\n${text}`, name: baseName };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const text = await workbookToText(buf, baseName);
      return { kind: "text", text, name: baseName };
    }

    // Word (.docx) → texto extraído.
    if (isWord(data.mimeType)) {
      const res = await fetch(`${GATEWAY}/files/${data.fileId}?alt=media`, {
        headers: gatewayHeaders(),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Falha ao baixar documento do Drive [${res.status}]: ${body}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const text = await docxToText(buf, baseName);
      return { kind: "text", text, name: baseName };
    }


    // Docs/apresentações nativas → PDF; PDF/imagem → download direto.
    const isGoogleNative = GOOGLE_EXPORTABLE.has(data.mimeType);
    const outMime = isGoogleNative ? "application/pdf" : data.mimeType;
    const url = isGoogleNative
      ? `${GATEWAY}/files/${data.fileId}/export?mimeType=application/pdf`
      : `${GATEWAY}/files/${data.fileId}?alt=media`;
    const res = await fetch(url, { headers: gatewayHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Falha ao baixar arquivo do Drive [${res.status}]: ${body}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const name = baseName + (isGoogleNative ? ".pdf" : "");
    return { kind: "file", base64, mime: outMime, name };
  });

