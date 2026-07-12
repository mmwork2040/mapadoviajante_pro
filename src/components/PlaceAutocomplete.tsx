import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

type Suggestion = { display_name: string; lat: string; lon: string };

export function PlaceAutocomplete({
  value,
  onChange,
  placeholder,
  bias,
  categories,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Cidade/estado para enviesar os resultados (ex: eLocation) */
  bias?: string;
  /** Variações de categoria para ampliar a busca (ex: restaurante, lanchonete, pizzaria) */
  categories?: string[];
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!focused) return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const cats = categories && categories.length ? categories : [null];
        const results = await Promise.all(
          cats.map(async (cat) => {
            const query = [q, cat, bias].filter(Boolean).join(", ");
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=4&accept-language=pt-BR&q=${encodeURIComponent(query)}`,
              { signal: controller.signal, headers: { "Accept": "application/json" } },
            );
            return (await res.json()) as Suggestion[];
          }),
        );
        const seen = new Set<string>();
        const merged: Suggestion[] = [];
        for (const list of results) {
          for (const s of list || []) {
            const key = `${s.lat}-${s.lon}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(s);
          }
        }
        setItems(merged);
        setOpen(merged.length > 0);
        setActive(-1);
      } catch {
        /* aborted or network error */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [value, bias, focused]);

  function pick(s: Suggestion) {
    skipNext.current = true;
    onChange(s.display_name);
    setOpen(false);
    setItems([]);
  }

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (items.length > 0) setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-background px-2 py-1.5 pr-7 text-xs outline-none focus:border-primary"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {items.map((s, i) => (
            <li key={`${s.lat}-${s.lon}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={`flex w-full items-start gap-1.5 px-2.5 py-1.5 text-left text-xs ${
                  i === active ? "bg-muted" : ""
                }`}
              >
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="line-clamp-2">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
