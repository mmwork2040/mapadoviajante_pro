// Design system · dados: seletor de visualização, jornada, funil, histórico,
// tabela ordenável e gráficos simples.
import { useMemo, useState, type ReactNode } from "react";
import { CaretDown, CaretUp, CaretUpDown, Check, WarningCircle, CheckCircle } from "@phosphor-icons/react";
import { IconBox } from "./structure";
import { cx } from "./base";

// ── Seletor de visualização ────────────────────────────────────────
export type ViewOption<T extends string> = { value: T; label: string; icon: ReactNode };

/** Fica no fim da barra de filtros: ícone e nome (só ícone no celular). */
export function ViewSwitcher<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: ViewOption<T>[] }) {
  return (
    <div className="ds-seg ds-vistas" role="group" aria-label="Visualização">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.label} aria-label={o.label} onClick={() => onChange(o.value)}>
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Jornada ────────────────────────────────────────────────────────
export type JourneyStep = { title: string; note?: string; state: "done" | "current" | "todo" };

/** As etapas da jornada comercial: Proposta, Contrato, Pagamento, Roteiro e guia. */
export function JourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="ds-jornada">
      {steps.map((s, i) => (
        <li key={s.title} className={cx(s.state === "done" && "ds-ok", s.state === "current" && "ds-now")} aria-current={s.state === "current" ? "step" : undefined}>
          <span className="ds-jornada-n">{s.state === "done" ? <Check weight="bold" aria-label="Concluída" /> : i + 1}</span>
          <div>
            <b>{s.title}</b>
            {s.note && <small>{s.note}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Funil ──────────────────────────────────────────────────────────
export type FunnelRow = { id: string; label: string; count: number; note?: string; muted?: boolean };

export function Funnel({ rows, onSelect }: { rows: FunnelRow[]; onSelect?: (id: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="ds-funnel">
      {rows.map((r) => {
        const body = (
          <>
            <span>
              {r.label}
              {r.note && <small>{r.note}</small>}
            </span>
            <span className="ds-t" aria-hidden>
              <i className={r.muted ? "ds-mute" : undefined} style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <b>{r.count}</b>
          </>
        );
        return onSelect ? (
          <button key={r.id} type="button" onClick={() => onSelect(r.id)}>
            {body}
          </button>
        ) : (
          <div key={r.id}>{body}</div>
        );
      })}
    </div>
  );
}

// ── Histórico ──────────────────────────────────────────────────────
export type HistoryEntry = { id: string; icon: ReactNode; text: ReactNode; meta?: ReactNode; bad?: boolean };

export function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <ul className="ds-hist">
      {entries.map((e) => (
        <li key={e.id} className={e.bad ? "ds-bad" : undefined}>
          <IconBox>{e.icon}</IconBox>
          <div>
            <span>{e.text}</span>
            {e.meta && <small>{e.meta}</small>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Tabela ordenável, que vira lista no celular ────────────────────
export type Column<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Valor usado para ordenar. Sem ele, a coluna não ordena. */
  sortValue?: (row: Row) => string | number | null | undefined;
  numeric?: boolean;
};

export function DataTable<Row>({ columns, rows, rowKey, onRowClick, initialSort, caption }: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  initialSort?: { id: string; dir: "asc" | "desc" };
  /** Descrição da tabela para leitor de tela. */
  caption: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const dir = sort!.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // sem valor vai para o fim
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), "pt-BR", { numeric: true }) * dir;
    });
  }, [rows, columns, sort]);

  return (
    <table className="ds-tbl ds-rows">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => {
            const active = sort?.id === c.id;
            return (
              <th key={c.id} className={c.numeric ? "ds-num" : undefined} aria-sort={c.sortValue ? (active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none") : undefined}>
                {c.sortValue ? (
                  <button type="button" onClick={() => setSort(active && sort!.dir === "asc" ? { id: c.id, dir: "desc" } : { id: c.id, dir: "asc" })}>
                    {c.header}
                    {active ? sort!.dir === "asc" ? <CaretUp weight="bold" aria-hidden /> : <CaretDown weight="bold" aria-hidden /> : <CaretUpDown aria-hidden />}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr
            key={rowKey(row)}
            data-click={onRowClick ? "" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row); } : undefined}
          >
            {columns.map((c) => (
              <td key={c.id} data-label={c.header} className={c.numeric ? "ds-num" : undefined}>
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Gráficos ───────────────────────────────────────────────────────
export type Bar = { label: string; value: number; display?: string; muted?: boolean };

/** Colunas: no máximo 24 px de largura, ponta arredondada e base reta. */
export function ColumnChart({ bars, label }: { bars: Bar[]; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${b.display ?? b.value}`).join(", ")}`}>
      <div className="ds-cols">
        {bars.map((b) => (
          <div className="ds-c" key={b.label} title={`${b.label}: ${b.display ?? b.value}`}>
            <span>{b.display ?? b.value}</span>
            <i className={b.muted ? "ds-mute" : undefined} style={{ height: `${(b.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="ds-cols-x" aria-hidden>
        {bars.map((b) => (
          <span key={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontais ordenadas: uma cor, valor na ponta. */
export function HBars({ bars, label }: { bars: Bar[]; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="ds-hbars" role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${b.display ?? b.value}`).join(", ")}`}>
      {bars.map((b) => (
        <div key={b.label} style={{ display: "contents" }}>
          <span className="ds-n">{b.label}</span>
          <span className="ds-t">
            <i className={b.muted ? "ds-mute" : undefined} style={{ width: `${(b.value / max) * 100}%` }} />
          </span>
          <span className="ds-v">{b.display ?? b.value}</span>
        </div>
      ))}
    </div>
  );
}

const SERIES = ["ds-k1", "ds-k2", "ds-k3", "ds-k4", "ds-k0"];

/** Barra segmentada: um todo em partes. Da quinta parte em diante entra em "Outros". */
export function SegBar({ parts, label }: { parts: { label: string; value: number; display?: string }[]; label: string }) {
  const shown = parts.length > 5 ? [...parts.slice(0, 4), { label: "Outros", value: parts.slice(4).reduce((s, p) => s + p.value, 0) }] : parts;
  const total = shown.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="ds-viz" role="img" aria-label={`${label}: ${shown.map((p) => `${p.label} ${p.display ?? p.value}`).join(", ")}`}>
      <div className="ds-segbar">
        {shown.map((p, i) => (
          <i key={p.label} className={SERIES[Math.min(i, 4)]} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.display ?? p.value}`} />
        ))}
      </div>
      <div className="ds-legend" aria-hidden>
        {shown.map((p, i) => (
          <span key={p.label}>
            <i className={SERIES[Math.min(i, 4)]} />
            {p.label} <b>{p.display ?? p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Medidor: uma razão contra um limite, com o estado escrito. */
export function Meter({ label, value, max, display, state = "neutral", status }: {
  label: string;
  value: number;
  max: number;
  display: string;
  state?: "neutral" | "ok" | "warn" | "bad";
  status?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx("ds-meter", state === "ok" && "ds-ok", state === "warn" && "ds-warn", state === "bad" && "ds-bad")} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={display}>
      <span>{label}</span>
      <span className="ds-v">{display}</span>
      <span className="ds-t">
        <i style={{ width: `${pct}%` }} />
      </span>
      {status && (
        <span className="ds-st">
          {state === "ok" ? <CheckCircle weight="fill" aria-hidden /> : state === "neutral" ? null : <WarningCircle weight="fill" aria-hidden />}
          {status}
        </span>
      )}
    </div>
  );
}
