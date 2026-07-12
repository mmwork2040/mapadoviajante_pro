import { useEffect, useState } from "react";
import { ScrollLock } from "@/components/ScrollLock";
import { Download, Loader2, X, FileText } from "lucide-react";
import {
  type LeadDocument,
  getDocumentUrl,
  downloadDocument,
  isImageDoc,
  isPdfDoc,
} from "@/lib/lead-documents";
import { toast } from "sonner";

export function DocumentPreviewModal({
  doc,
  onClose,
}: {
  doc: LeadDocument | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    if (!doc) return;
    setLoading(true);
    (async () => {
      try {
        const signed = await getDocumentUrl(doc.file_path);
        if (!signed) return;
        // Fetch as blob so PDFs/images render reliably inside the modal
        // (avoids cross-origin/content-type issues with signed URLs in iframes).
        const res = await fetch(signed);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch {
        if (active) setUrl(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc]);

  if (!doc) return null;

  const image = isImageDoc(doc);
  const pdf = isPdfDoc(doc);

  async function handleDownload() {
    if (!doc) return;
    setDownloading(true);
    const ok = await downloadDocument(doc);
    setDownloading(false);
    if (!ok) toast.error("Não foi possível baixar o documento.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
        <ScrollLock />
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={doc.name}>
            {doc.name}
          </span>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar
          </button>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-muted/30 p-2">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !url ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar a pré-visualização.</p>
          ) : image ? (
            <img src={url} alt={doc.name} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
          ) : pdf ? (
            <iframe src={url} title={doc.name} className="h-[75vh] w-full rounded-lg bg-white" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Pré-visualização indisponível para este tipo de arquivo.
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                <Download className="h-4 w-4" /> Baixar arquivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
