import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AddressBook, AirplaneTilt, MagnifyingGlass } from "@phosphor-icons/react";
import { fetchClients, fetchLeads } from "@/lib/services";
import { IconBox } from "@/components/ds";

type Hit =
  | { kind: "viagem"; id: string; title: string; sub: string }
  | { kind: "viajante"; id: string; title: string; sub: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca global da barra de topo: viajante ou viagem. Atalho Ctrl K (ou ⌘ K). */
export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Só busca quando a pessoa começa a usar; reaproveita o que as telas já carregaram.
  const enabled = open || term.length > 0;
  const leadsQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}), enabled });
  const clientsQ = useQuery({ queryKey: ["clients", ""], queryFn: () => fetchClients(), enabled, staleTime: 60_000 });

  const hits = useMemo<Hit[]>(() => {
    const q = norm(term.trim());
    if (q.length < 2) return [];
    const trips: Hit[] = (leadsQ.data ?? [])
      .filter((l) => norm(`${l.name} ${l.destination ?? ""} ${l.email ?? ""}`).includes(q))
      .slice(0, 5)
      .map((l) => ({ kind: "viagem", id: l.id, title: l.destination || "Destino a definir", sub: l.name }));
    const people: Hit[] = (clientsQ.data ?? [])
      .filter((c) => norm(`${c.name} ${c.email ?? ""} ${c.phone ?? ""}`).includes(q))
      .slice(0, 5)
      .map((c) => ({ kind: "viajante", id: c.id, title: c.name, sub: c.email || c.phone || "Viajante" }));
    return [...trips, ...people];
  }, [term, leadsQ.data, clientsQ.data]);

  useEffect(() => setActive(0), [term]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setTerm("");
    inputRef.current?.blur();
    if (hit.kind === "viagem") navigate({ to: "/leads", search: { lead: hit.id } });
    else navigate({ to: "/clientes/$id", params: { id: hit.id } });
  }

  const loading = enabled && (leadsQ.isLoading || clientsQ.isLoading);
  const failed = leadsQ.isError && clientsQ.isError;
  const showPop = open && term.trim().length >= 2;
  const firstPerson = hits.findIndex((h) => h.kind === "viajante");

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, maxWidth: 460, minWidth: 0 }}>
      <label className="ds-search" style={{ width: "100%", maxWidth: "none" }}>
        <MagnifyingGlass aria-hidden />
        <input
          ref={inputRef}
          value={term}
          role="combobox"
          aria-label="Buscar viajante ou viagem"
          aria-expanded={showPop}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPop && hits[active] ? `${listId}-${active}` : undefined}
          placeholder="Buscar viajante ou viagem"
          autoComplete="off"
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            }
          }}
        />
        <kbd className="ds-kbd ds-hide-m">Ctrl K</kbd>
      </label>

      {showPop && (
        <div className="ds-pop" id={listId} role="listbox" aria-label="Resultados da busca">
          {hits.length === 0 ? (
            <p className="ds-muted" style={{ margin: 0, padding: "14px 10px" }}>
              {loading ? "Buscando…" : failed ? "Não foi possível buscar agora. Tente de novo." : `Nada encontrado para “${term.trim()}”.`}
            </p>
          ) : (
            hits.map((h, i) => (
              <div key={`${h.kind}-${h.id}`}>
                {i === 0 && h.kind === "viagem" && <div className="ds-mono">Viagens</div>}
                {i === firstPerson && <div className="ds-mono">Viajantes</div>}
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="ds-pop-item"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                >
                  <IconBox>{h.kind === "viagem" ? <AirplaneTilt size={18} aria-hidden /> : <AddressBook size={18} aria-hidden />}</IconBox>
                  <div>
                    <b>{h.title}</b>
                    <small>{h.sub}</small>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
