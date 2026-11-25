import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { googleAccessToken, parseServiceAccount } from "@/lib/server/google-auth";

// API do Google Drive, direto no Google. O acesso é de uma conta de serviço
// (JSON em GOOGLE_DRIVE_SERVICE_ACCOUNT, só no servidor). A agência compartilha
// a pasta do Drive com o e-mail dessa conta, como leitor.
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

let cachedToken: { token: string; at: number } | null = null;

async function driveHeaders(): Promise<Record<string, string>> {
  const sa = parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT);
  if (!sa) throw new Error("Google Drive não está conectado. Peça ao administrador para configurar a integração.");
  // O token vale 1 hora; reaproveita por 50 minutos.
  if (!cachedToken || Date.now() - cachedToken.at > 50 * 60 * 1000) {
    cachedToken = { token: await googleAccessToken(sa, DRIVE_SCOPE), at: Date.now() };
  }
  return { Authorization: `Bearer ${cachedToken.token}` };
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
    ? `${DRIVE_API}/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    : `${DRIVE_API}/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: await driveHeaders() });
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

/**
 * Devolve uma prévia curta do conteúdo de cada aba selecionada de uma planilha
 * do Drive (primeiras linhas de cada aba), para o usuário conferir antes de
 * iniciar a extração completa pela IA.
 */
export const previewDriveSheets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fileId: z.string().min(1),
        mimeType: z.string().min(1),
        sheets: z.array(z.string()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ previews: { sheet: string; preview: string }[] }> => {
    if (!isMultiSheet(data.mimeType)) return { previews: [] };
    const buf = await downloadSpreadsheetBuffer(data.fileId, data.mimeType);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const wanted = data.sheets?.length ? new Set(data.sheets) : null;
    const previews: { sheet: string; preview: string }[] = [];
    for (const sheetName of wb.SheetNames) {
      if (wanted && !wanted.has(sheetName)) continue;
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
      const snippet = rows
        .slice(0, 6)
        .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")).join(" | ") : ""))
        .filter((line) => line.trim())
        .join("\n");
      previews.push({
        sheet: sheetName,
        preview: snippet || "(aba vazia)",
      });
    }
    return { previews };
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


/** Verifica se o Google Drive está conectado e acessível. */
export const checkDriveConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ connected: boolean }> => {
    try {
      const res = await fetch(`${DRIVE_API}/files?pageSize=1&fields=files(id)`, {
        headers: await driveHeaders(),
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
    const url = `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=100&orderBy=modifiedTime desc`;
    const res = await fetch(url, { headers: await driveHeaders() });
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
        sheets: z.array(z.string()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<DriveContent> => {
    if (!isSupported(data.mimeType)) {
      throw new Error("Tipo de arquivo não suportado para leitura pela IA.");
    }
    const baseName = data.name || "documento";

    // Planilhas → texto (todas as abas, ou apenas as selecionadas pelo usuário).
    if (isSpreadsheet(data.mimeType)) {
      if (data.mimeType === "text/csv") {
        const res = await fetch(`${DRIVE_API}/files/${data.fileId}?alt=media`, {
          headers: await driveHeaders(),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Falha ao baixar planilha do Drive [${res.status}]: ${body}`);
        }
        const text = await res.text();
        return { kind: "text", text: `Arquivo: ${baseName}\n${text}`, name: baseName };
      }
      const buf = await downloadSpreadsheetBuffer(data.fileId, data.mimeType);
      const text = await workbookToText(buf, baseName, data.sheets);
      return { kind: "text", text, name: baseName };
    }

    // Word (.docx) → texto extraído.
    if (isWord(data.mimeType)) {
      const res = await fetch(`${DRIVE_API}/files/${data.fileId}?alt=media`, {
        headers: await driveHeaders(),
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
      ? `${DRIVE_API}/files/${data.fileId}/export?mimeType=application/pdf`
      : `${DRIVE_API}/files/${data.fileId}?alt=media`;
    const res = await fetch(url, { headers: await driveHeaders() });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Falha ao baixar arquivo do Drive [${res.status}]: ${body}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const name = baseName + (isGoogleNative ? ".pdf" : "");
    return { kind: "file", base64, mime: outMime, name };
  });

