// Design system · peças de base. Classes em src/styles/ds.css.
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, CircleNotch, WarningCircle } from "@phosphor-icons/react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

// ── Botão ──────────────────────────────────────────────────────────
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: a ação do bloco (um por bloco). outline: ações de apoio. link: ação discreta no texto. */
  variant?: "primary" | "outline" | "link";
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", loading = false, block = false, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx("ds-btn", variant === "primary" && "ds-p", variant === "outline" && "ds-s", variant === "link" && "ds-lk", block && "ds-block", className)}
      {...rest}
    >
      {loading ? <CircleNotch className="ds-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/** Classes de botão para usar em <Link> ou <a>. */
export function buttonClass(variant: "primary" | "outline" | "link" = "outline", extra?: string) {
  return cx("ds-btn", variant === "primary" && "ds-p", variant === "outline" && "ds-s", variant === "link" && "ds-lk", extra);
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** Obrigatório: ícone sozinho sempre tem nome. */
  label: string;
  /** Ponto de novidade (sino). */
  dot?: boolean;
};

/** Botão redondo de 44 px da barra de topo. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, dot, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={cx("ds-ib", className)} {...rest}>
      {children}
      {dot && <span className="ds-dot" />}
    </button>
  );
});

type MiniProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; done?: boolean };

/** Ação pequena na linha (36 px; 44 px no celular). */
export const Mini = forwardRef<HTMLButtonElement, MiniProps>(function Mini(
  { label, done, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={cx("ds-mini", done && "ds-done", className)} {...rest}>
      {children}
    </button>
  );
});

// ── Chip ───────────────────────────────────────────────────────────
export type ChipTone = "neutral" | "ok" | "now" | "warn" | "bad" | "info";
const TONE: Record<ChipTone, string | false> = { neutral: false, ok: "ds-ok", now: "ds-now", warn: "ds-warn", bad: "ds-bad", info: "ds-info" };

/** Etiqueta de estado. Verde é concluído; vermelho é atraso ou erro, sempre com ícone e texto. */
export function Chip({ tone = "neutral", icon, children, className }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx("ds-chip", TONE[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Chip de filtro: liga e desliga. */
export function FilterChip({ pressed, onPressedChange, icon, children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <button type="button" className="ds-chip" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

// ── Seletor segmentado ─────────────────────────────────────────────
export type SegOption<T extends string> = { value: T; label: string; icon?: ReactNode; count?: number };

export function Seg<T extends string>({ value, onChange, options, label, className }: {
  value: T;
  onChange: (value: T) => void;
  options: SegOption<T>[];
  /** Nome do grupo para leitor de tela. */
  label: string;
  className?: string;
}) {
  return (
    <div className={cx("ds-seg", className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.label} onClick={() => onChange(o.value)}>
          {o.icon}
          <span>{o.label}</span>
          {o.count !== undefined && <span className="ds-num">· {o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Abas (sublinhado com luz) ──────────────────────────────────────
export type TabOption<T extends string> = { value: T; label: string; icon?: ReactNode; count?: number };

export function Tabs<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (value: T) => void;
  options: TabOption<T>[];
  label: string;
}) {
  return (
    <div className="ds-tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
          {o.count !== undefined && <span className="ds-muted">· {o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Campo: rótulo sempre visível, campo em pílula ──────────────────
type FieldShell = { label: string; hint?: string; error?: string; className?: string };

function FieldWrap({ id, label, hint, error, className, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cx("ds-fld", className)}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="ds-fld-err" id={`${id}-msg`} role="alert">
          <WarningCircle size={14} weight="fill" aria-hidden /> {error}
        </span>
      ) : hint ? (
        <span className="ds-fld-hint" id={`${id}-msg`}>{hint}</span>
      ) : null}
    </div>
  );
}

export const Field = forwardRef<HTMLInputElement, FieldShell & InputHTMLAttributes<HTMLInputElement>>(function Field(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} hint={hint} error={error} className={className}>
      <input ref={ref} id={fid} aria-invalid={error ? true : undefined} aria-describedby={hint || error ? `${fid}-msg` : undefined} {...rest} />
    </FieldWrap>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, FieldShell & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, hint, error, className, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} hint={hint} error={error} className={className}>
      <select ref={ref} id={fid} aria-invalid={error ? true : undefined} aria-describedby={hint || error ? `${fid}-msg` : undefined} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
});

/** Texto longo: raio 18, não é pílula. */
export const TextField = forwardRef<HTMLTextAreaElement, FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextField(
  { label, hint, error, className, id, rows = 3, ...rest },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldWrap id={fid} label={label} hint={hint} error={error} className={className}>
      <textarea ref={ref} id={fid} rows={rows} aria-invalid={error ? true : undefined} aria-describedby={hint || error ? `${fid}-msg` : undefined} {...rest} />
    </FieldWrap>
  );
});

/** Caixa de busca em pílula. */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon: ReactNode; label: string; trailing?: ReactNode; wrapClassName?: string }>(
  function SearchInput({ icon, label, trailing, wrapClassName, ...rest }, ref) {
    return (
      <label className={cx("ds-search", wrapClassName)}>
        {icon}
        <input ref={ref} aria-label={label} {...rest} />
        {trailing}
      </label>
    );
  },
);

// ── Interruptor, marcador de concluir, avatar, progresso ───────────
export function Switch({ checked, onCheckedChange, label, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="ds-sw" onClick={() => onCheckedChange(!checked)}>
      <i />
    </button>
  );
}

/** Círculo de concluir. */
export function Tick({ checked, onCheckedChange, label, disabled }: { checked: boolean; onCheckedChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} className="ds-tick" onClick={() => onCheckedChange?.(!checked)}>
      <Check weight="bold" aria-hidden />
    </button>
  );
}

export function initialsOf(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function Avatar({ name, color, size = "md", className }: { name?: string | null; color?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={cx("ds-av", size === "sm" && "ds-sm", size === "lg" && "ds-lg", className)} style={color ? { background: color } : undefined} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

/** Barra fina. Em andamento emite luz; concluída fica verde, sem luz. */
export function Progress({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx("ds-bar", pct >= 100 && "ds-ok")} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
