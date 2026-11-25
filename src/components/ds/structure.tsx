// Design system · estrutura da tela.
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { ArrowDown, ArrowUp, WarningCircle } from "@phosphor-icons/react";
import { Button, cx } from "./base";

/** Título da tela: nome, resumo e a ação principal à direita. */
export function PageTitle({ title, eyebrow, summary, actions }: { title: ReactNode; eyebrow?: ReactNode; summary?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ds-ph">
      <div>
        {eyebrow && <span className="ds-mono">{eyebrow}</span>}
        <h1 className="ds-h1">{title}</h1>
        {summary && <p>{summary}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Cabeçalho de seção: o título, o fio que corre até a ação, e a ação. */
export function SectionHeader({ title, note, children, wrap }: { title: ReactNode; note?: ReactNode; children?: ReactNode; wrap?: boolean }) {
  return (
    <div className={cx("ds-sec-h", wrap && "ds-wrap")}>
      <div>
        <h2 className="ds-h2">{title}</h2>
        {note && <span className="ds-muted">{note}</span>}
      </div>
      {children}
    </div>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ds-card", className)} {...rest} />;
}

/** Destaque: só a borda na cor principal. Um por tela. */
export function HighlightCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ds-card ds-lv3", className)} {...rest} />;
}

/** Vidro: só sobre foto ou conteúdo. */
export function Glass({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ds-glass", className)} {...rest} />;
}

export function IconBox({ children, accent, className }: { children: ReactNode; accent?: boolean; className?: string }) {
  return <span className={cx("ds-ibox", accent && "ds-acc", className)}>{children}</span>;
}

/** Primeira dobra: foto com véu, título à esquerda e card flutuante à direita. */
export function PhotoHero({ image, alt = "", children, aside, minHeight }: { image?: string | null; alt?: string; children: ReactNode; aside?: ReactNode; minHeight?: number }) {
  return (
    <section className="ds-phero" style={minHeight ? ({ minHeight } as CSSProperties) : undefined}>
      {image && <img src={image} alt={alt} />}
      <div className="ds-phero-shade" />
      <div className="ds-phero-in">
        <div>{children}</div>
        {aside && <div className="ds-float">{aside}</div>}
      </div>
    </section>
  );
}

export type KpiItem = {
  label: string;
  /** Valor já formatado. Sem dado, use "A definir" ou "—": nunca um número inventado. */
  value: ReactNode;
  delta?: { text: string; direction?: "up" | "down" | "flat" };
};

/** Números em destaque: rótulo, valor e variação. */
export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="ds-kpis">
      {items.map((k) => (
        <div className="ds-kpi" key={k.label}>
          <span className="ds-mono">{k.label}</span>
          <b>{k.value}</b>
          {k.delta && (
            <span className={cx("ds-delta", k.delta.direction === "up" && "ds-up", k.delta.direction === "down" && "ds-down")}>
              {k.delta.direction === "up" && <ArrowUp weight="bold" aria-hidden />}
              {k.delta.direction === "down" && <ArrowDown weight="bold" aria-hidden />}
              {k.delta.text}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Espaço vazio. O tracejado só aparece aqui. */
export function Empty({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ds-empty">
      <b>{title}</b>
      {children}
      {action}
    </div>
  );
}

/** Erro ao carregar: diz o que houve e oferece tentar de novo. */
export function ErrorBox({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="ds-errbox" role="alert">
      <WarningCircle weight="fill" aria-hidden />
      <div>{children}</div>
      {onRetry && <Button onClick={onRetry}>Tentar de novo</Button>}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 16, radius }: { width?: number | string; height?: number | string; radius?: number | string }) {
  return <div className="ds-skel" style={{ width, height, borderRadius: radius }} aria-hidden />;
}
