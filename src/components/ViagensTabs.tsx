import { Link } from "@tanstack/react-router";
import { AirplaneTilt, Kanban } from "@phosphor-icons/react";

/** Viagens é uma área só, com duas fases: comercial (/leads) e preparação e viagem (/roteiros). */
export function ViagensTabs({ ativo, comercial, preparacao }: { ativo: "comercial" | "preparacao"; comercial?: number; preparacao?: number }) {
  const tabs = [
    { to: "/leads", id: "comercial", label: "Comercial", icon: Kanban, n: comercial },
    { to: "/roteiros", id: "preparacao", label: "Preparação e viagem", icon: AirplaneTilt, n: preparacao },
  ] as const;
  return (
    <nav className="ds-tabs" aria-label="Fases da viagem" style={{ marginTop: -8 }}>
      {tabs.map(({ to, id, label, icon: Icon, n }) => (
        <Link key={id} to={to} role="tab" aria-selected={id === ativo} aria-current={id === ativo ? "page" : undefined}>
          <Icon aria-hidden />
          {label}
          {n !== undefined && <span className="ds-muted">· {n}</span>}
        </Link>
      ))}
    </nav>
  );
}
