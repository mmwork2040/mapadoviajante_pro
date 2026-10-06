import { useState } from "react";
import { Download, Eye, X } from "lucide-react";
import type { Itinerary } from "@/lib/types";
import { ItineraryDocument } from "@/components/ItineraryDocument";

export function RoteiroPdfExport({ it, coverUrl }: { it: Itinerary; coverUrl: string | null }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        <Eye className="h-4 w-4" /> Visualizar
      </button>
      <a
        href={`/imprimir/${encodeURIComponent(it.id)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Download className="h-4 w-4" /> PDF
      </a>
      {previewOpen && (
        <div
          className="osv-trip-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Prévia do roteiro"
        >
          <div className="osv-trip-preview-bar">
            <strong>Prévia do roteiro</strong>
            <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Fechar prévia">
              <X size={20} />
            </button>
          </div>
          <div className="osv-trip-preview-content">
            <ItineraryDocument it={it} coverUrl={coverUrl} />
          </div>
        </div>
      )}
    </>
  );
}
