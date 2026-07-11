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

function isSupported(mime: string): boolean {
  return (
    mime === "application/pdf" ||
    mime.startsWith("image/") ||
    GOOGLE_EXPORTABLE.has(mime) ||
    isSpreadsheet(mime)
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

/**
 * Baixa o conteúdo de um arquivo do Drive e devolve como base64 + mime, pronto
 * para o mesmo pipeline de "Documento (IA)". Documentos nativos do Google são
 * exportados como PDF.
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
  .handler(
    async ({ data }): Promise<{ base64: string; mime: string; name: string }> => {
      if (!isSupported(data.mimeType)) {
        throw new Error("Tipo de arquivo não suportado para leitura pela IA.");
      }
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
      const name = (data.name || "documento") + (isGoogleNative ? ".pdf" : "");
      return { base64, mime: outMime, name };
    },
  );
