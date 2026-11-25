import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AddressBook,
  AirplaneTilt,
  CalendarBlank,
  House,
  Images,
  MagnifyingGlass,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { BrandLogo } from "@/components/BrandLogo";
import { Avatar } from "@/components/ds";

/**
 * Peças de moldura da página /conheca: o navegador e o celular onde aparecem
 * os "prints" do sistema, a escala que encaixa a tela no espaço disponível e a
 * animação de entrada das seções.
 */

// ── Escala ────────────────────────────────────────────────────────────
// A tela é desenhada no tamanho real (como no app) e reduzida para caber.
// Em espaço estreito usa uma largura menor, para o texto não ficar minúsculo.
export function Escala({
  altura,
  largura = 1120,
  larguraCompacta = 760,
  children,
}: {
  altura: number;
  largura?: number;
  larguraCompacta?: number;
  children: (compacta: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState<{ w: number; s: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const cw = el.clientWidth;
      const w = cw >= 640 ? largura : larguraCompacta;
      setMedida({ w, s: cw / w });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [largura, larguraCompacta]);

  const w = medida?.w ?? largura;
  const s = medida?.s ?? 1;
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{ height: medida ? altura * s : altura * 0.6 }}
    >
      {medida && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: w, height: altura, transform: `scale(${s})` }}
        >
          {children(w < 900)}
        </div>
      )}
    </div>
  );
}

// ── Navegador ─────────────────────────────────────────────────────────
export function Navegador({
  endereco,
  children,
  className = "",
}: {
  endereco: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[18px] border border-white/10 bg-[#1b1714] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.65)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 truncate rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/60">
          <span className="truncate">{endereco}</span>
        </div>
        <span className="w-[54px]" />
      </div>
      {children}
    </div>
  );
}

// ── Celular ───────────────────────────────────────────────────────────
export function Celular({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-[300px] rounded-[46px] border border-white/15 bg-[#0d0b0a] p-[10px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.7)] ${className}`}
    >
      <div className="absolute left-1/2 top-[18px] z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-black" />
      <div className="h-[600px] overflow-hidden rounded-[36px]">{children}</div>
    </div>
  );
}

// ── Casca do app dentro do print ─────────────────────────────────────
export type TelaId = "hoje" | "viagens" | "viajantes" | "agenda" | "biblioteca" | "financeiro";
const MENU: { id: TelaId; label: string; icon: Icon }[] = [
  { id: "hoje", label: "Hoje", icon: House },
  { id: "viagens", label: "Viagens", icon: AirplaneTilt },
  { id: "viajantes", label: "Viajantes", icon: AddressBook },
  { id: "agenda", label: "Agenda", icon: CalendarBlank },
  { id: "biblioteca", label: "Biblioteca", icon: Images },
  { id: "financeiro", label: "Financeiro", icon: Wallet },
];

export function CascaApp({
  ativa,
  onNavegar,
  compacta,
  children,
}: {
  ativa: TelaId;
  onNavegar?: (t: TelaId) => void;
  compacta: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="flex h-full bg-background text-foreground"
      style={{ fontSize: 15, lineHeight: 1.5 }}
    >
      {!compacta && (
        <aside className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-border bg-sidebar px-3.5 py-6">
          <div className="flex items-center gap-2.5 px-2 pb-5">
            <BrandLogo heightClass="h-8" nameClass="text-[14px]" />
          </div>
          <span className="ds-grp">Trabalho</span>
          {MENU.map((m) => (
            <button
              key={m.id}
              type="button"
              className="ds-nav"
              aria-current={ativa === m.id ? "page" : undefined}
              onClick={() => onNavegar?.(m.id)}
              tabIndex={onNavegar ? 0 : -1}
            >
              <m.icon weight={ativa === m.id ? "fill" : "regular"} aria-hidden />
              {m.label}
              {m.id === "viagens" && <span className="ds-cnt ds-acc">3</span>}
            </button>
          ))}
          <div className="ds-foot">
            <div className="ds-me">
              <Avatar name="Carla Mendes" size="sm" />
              <div>
                <b>Carla Mendes</b>
                <span>Administrador</span>
              </div>
            </div>
          </div>
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 px-8 pt-5">
          <div className="ds-search" style={{ maxWidth: 420, flex: 1 }}>
            <MagnifyingGlass aria-hidden />
            <span className="text-[14px] text-muted-foreground">
              Buscar viajante, viagem ou roteiro
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-8 pb-8 pt-6">{children}</div>
      </div>
    </div>
  );
}

// ── Entrada suave ao rolar ───────────────────────────────────────────
export function Surge({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisivel(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
