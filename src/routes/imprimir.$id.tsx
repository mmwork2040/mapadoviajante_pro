import { useEffect, useRef } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, List } from "lucide-react";
import { fetchItineraryById } from "@/lib/services";
import { useResolvedImageUrl } from "@/hooks/useResolvedImageUrl";
import { ItineraryDocument } from "@/components/ItineraryDocument";

export const Route = createFileRoute("/imprimir/$id")({ ssr: false, component: PrintItinerary });

function PrintItinerary() {
  const { id } = useParams({ from: "/imprimir/$id" });
  const {
    data: it,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["itinerary", id],
    queryFn: () => fetchItineraryById(id),
    retry: false,
  });
  const { url: coverUrl } = useResolvedImageUrl(it?.cover_image);
  const printed = useRef(false);

  useEffect(() => {
    if (!it || printed.current) return;
    printed.current = true;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.querySelectorAll(".osv-print-view img")).map((img) => {
          if ((img as HTMLImageElement).complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
            setTimeout(resolve, 4000);
          });
        }),
      );
      if (!cancelled) window.print();
    })();
    return () => {
      cancelled = true;
    };
  }, [it]);

  if (isLoading) return <div className="osv-share-state">Preparando o roteiro…</div>;
  if (isError || !it)
    return <div className="osv-share-state">Não foi possível carregar este roteiro.</div>;

  return (
    <div className="osv-share-view osv-print-view">
      <header className="osv-share-toolbar">
        <a href="#sumario" className="osv-share-brand">
          <img src="/osv-logo-preto.png" alt="O Segredo do Viajante" />
          <span>Prévia para PDF</span>
        </a>
        <nav aria-label="Ações do roteiro">
          <a href="#sumario">
            <List size={17} /> <span>Sumário</span>
          </a>
          <button type="button" className="osv-share-print" onClick={() => window.print()}>
            <Download size={17} /> <span>Salvar PDF</span>
          </button>
        </nav>
      </header>
      <main>
        <ItineraryDocument it={it} coverUrl={coverUrl} />
      </main>
    </div>
  );
}
