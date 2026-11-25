import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  /** Mantido por compatibilidade; a identidade OSV usa títulos sem ícone. */
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Abas logo abaixo do título (ex.: fases de Viagens). */
  tabs?: ReactNode;
};

export function PageHeader({ title, subtitle, actions, tabs }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-3xl leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </div>
  );
}
