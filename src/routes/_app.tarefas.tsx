import { createFileRoute } from "@tanstack/react-router";
import { AgendaPage } from "@/components/agenda/Agenda";

// A rota continua /tarefas para não quebrar links antigos; a tela é a Agenda.
export const Route = createFileRoute("/_app/tarefas")({
  component: AgendaPage,
});
