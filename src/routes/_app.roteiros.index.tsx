import { createFileRoute } from "@tanstack/react-router";
import { PreparacaoPage } from "@/components/viagens/Preparacao";

// Viagens · Preparação e viagem. A rota continua /roteiros para não quebrar links.
export const Route = createFileRoute("/_app/roteiros/")({
  component: PreparacaoPage,
});
