// Design system · sobreposições. Usam o Dialog do Radix: prendem o foco,
// fecham com Esc e com clique no véu, e travam a rolagem da página.
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { IconBox } from "./structure";
import { cx } from "./base";

type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título lido pelo leitor de tela e mostrado no topo. */
  title: ReactNode;
  /** Rótulo acima do título (ex.: "Viagem · fase comercial"). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

function Header({ title, eyebrow, description }: Pick<OverlayProps, "title" | "eyebrow" | "description">) {
  return (
    <div className="ds-over-h">
      <div>
        {eyebrow && <span className="ds-mono">{eyebrow}</span>}
        <Dialog.Title className="ds-h2">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="ds-muted">{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{typeof title === "string" ? title : "Janela"}</Dialog.Description>
        )}
      </div>
      <Dialog.Close className="ds-mini" aria-label="Fechar" title="Fechar">
        <X aria-hidden />
      </Dialog.Close>
    </div>
  );
}

/** Painel lateral de 580 px, usado pelas fichas. */
export function SidePanel({ open, onOpenChange, title, eyebrow, description, children, footer }: OverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ds-veu" />
        <Dialog.Content className="ds-painel">
          <Header title={title} eyebrow={eyebrow} description={description} />
          {children}
          {footer && <div className="ds-over-f">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Janela dos formulários curtos. No celular ocupa a tela cheia. */
export function Janela({ open, onOpenChange, title, eyebrow, description, children, footer }: OverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ds-veu" />
        <Dialog.Content className="ds-janela">
          <Header title={title} eyebrow={eyebrow} description={description} />
          {children}
          {footer && <div className="ds-over-f">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type SheetItem = { id: string; icon: ReactNode; title: string; hint?: string; onSelect: () => void };

/** Folha de escolha rápida em vidro (menu Criar, menu Mais). */
export function ActionSheet({ open, onOpenChange, title, items, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: SheetItem[];
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ds-veu" style={{ background: "var(--scrim)" }} />
        <Dialog.Content className={cx("ds-sheet ds-glass", className)}>
          <div className="ds-over-h" style={{ padding: "4px 12px 8px", alignItems: "center" }}>
            <div>
              <Dialog.Title className="ds-h2">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            </div>
            <Dialog.Close className="ds-mini" aria-label="Fechar" title="Fechar">
              <X aria-hidden />
            </Dialog.Close>
          </div>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className="ds-sheet-item"
              onClick={() => {
                onOpenChange(false);
                it.onSelect();
              }}
            >
              <IconBox>{it.icon}</IconBox>
              <div>
                <b>{it.title}</b>
                {it.hint && <span>{it.hint}</span>}
              </div>
            </button>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
