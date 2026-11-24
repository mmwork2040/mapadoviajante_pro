import { Link } from "@tanstack/react-router";
import { KanbanSquare, Plane } from "lucide-react";

/** Viagens é uma área só, com duas fases: comercial (/leads) e preparação e viagem (/roteiros). */
export function ViagensTabs({ ativo }: { ativo: "comercial" | "preparacao" }) {
  const tabs = [
    { to: "/leads", id: "comercial", label: "Comercial", icon: KanbanSquare },
    { to: "/roteiros", id: "preparacao", label: "Preparação e viagem", icon: Plane },
  ] as const;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Fases da viagem">
      {tabs.map(({ to, id, label, icon: Icon }) => {
        const on = id === ativo;
        return (
          <Link
            key={id}
            to={to}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors ${
              on
                ? "border-primary font-bold text-foreground"
                : "border-transparent font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 ${on ? "text-accent-foreground" : ""}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
