import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Link2, List } from "lucide-react";
import { toast } from "sonner";
import { fetchPublicItinerary } from "@/lib/services";
import { ItineraryDocument } from "@/components/ItineraryDocument";

export const Route = createFileRoute("/viajante/$id")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: TravelerView,
});

function TravelerView() {
  const { id } = useParams({ from: "/viajante/$id" });
  const { token } = useSearch({ from: "/viajante/$id" });
  const {
    data: it,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["traveler-itinerary", id, token],
    queryFn: () => fetchPublicItinerary(id, token),
    enabled: Boolean(token),
    retry: false,
  });

  if (isLoading && token) return <div className="osv-share-state">Carregando seu roteiro…</div>;
  if (isError)
    return (
      <div className="osv-share-state">
        Não foi possível abrir o roteiro agora. Tente novamente em instantes.
      </div>
    );
  if (!it) return <div className="osv-share-state">Este link de roteiro não está disponível.</div>;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="osv-share-view">
      <header className="osv-share-toolbar">
        <a href="#sumario" className="osv-share-brand">
          <img src="/osv-logo-preto.png" alt="O Segredo do Viajante" />
          <span>Seu roteiro</span>
        </a>
        <nav aria-label="Ações do roteiro">
          <a href="#sumario">
            <List size={17} /> <span>Sumário</span>
          </a>
          <button type="button" onClick={copyLink}>
            <Link2 size={17} /> <span>Copiar link</span>
          </button>
          <button type="button" className="osv-share-print" onClick={() => window.print()}>
            <Download size={17} /> <span>Salvar PDF</span>
          </button>
        </nav>
      </header>
      <main>
        <ItineraryDocument it={it} />
      </main>
    </div>
  );
}
