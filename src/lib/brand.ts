// Marca do produto e marca da agência (white-label).
//
// O produto se chama Mapa do Viajante PRO. Cada agência pode trocar a logo e a
// cor principal; o resto da identidade (fontes, tema, formas) é do produto.
// Este arquivo roda no navegador e no servidor: nada de segredo aqui.

export const PRODUCT = {
  name: "Mapa do Viajante PRO",
  shortName: "MapaPRO",
  tagline: "CRM para agências de viagem",
  mark: "/mapapro-mark.svg",
  /** Cor principal padrão do produto. */
  primary: "#f58e26",
} as const;

/** O que a agência configura (guardado em `agency_cfg:{agência}:brand`). */
export interface BrandConfig {
  /** Cor principal, em #rrggbb. Vazio = cor do produto. */
  primary?: string | null;
  /** Arquivo da logo para fundo claro. */
  logoFileId?: string | null;
  /** Arquivo da logo para fundo escuro. Vazio = usa a de fundo claro. */
  logoDarkFileId?: string | null;
}

/** Marca pronta para a tela: nome, cor e endereços das logos. */
export interface Brand {
  agencyId: string;
  name: string;
  primary: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
}

const HEX = /^#[0-9a-f]{6}$/i;
const FILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return HEX.test(v) ? v : null;
}

export function normalizeFileId(value: unknown): string | null {
  return typeof value === "string" && FILE_ID.test(value) ? value : null;
}

/** Mantém só o que é válido numa configuração de marca vinda do banco ou da tela. */
export function sanitizeBrandConfig(raw: unknown): BrandConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    primary: normalizeHex(r.primary),
    logoFileId: normalizeFileId(r.logoFileId),
    logoDarkFileId: normalizeFileId(r.logoDarkFileId),
  };
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Cor do texto que fica legível sobre a cor principal (escuro ou branco). */
export function readableOn(hex: string): string {
  const l = luminance(hex);
  const withDark = (l + 0.05) / (luminance("#1a0f05") + 0.05);
  const withWhite = 1.05 / (l + 0.05);
  return withDark >= withWhite ? "#1a0f05" : "#ffffff";
}

export function brandLogoUrl(agencyId: string, variant: "light" | "dark", fileId: string): string {
  return `/api/public/brand-logo?agency=${encodeURIComponent(agencyId)}&v=${variant}&f=${encodeURIComponent(fileId)}`;
}

export function toBrand(agencyId: string, name: string, cfg: BrandConfig): Brand {
  const light = cfg.logoFileId ?? null;
  const dark = cfg.logoDarkFileId ?? null;
  return {
    agencyId,
    name,
    primary: cfg.primary ?? null,
    logoUrl: light ? brandLogoUrl(agencyId, "light", light) : dark ? brandLogoUrl(agencyId, "dark", dark) : null,
    logoDarkUrl: dark ? brandLogoUrl(agencyId, "dark", dark) : light ? brandLogoUrl(agencyId, "light", light) : null,
  };
}

/** Variáveis de cor para o documento do roteiro do cliente (página compartilhada e PDF). */
export function docBrandStyle(brand?: Pick<Brand, "primary"> | null): Record<string, string> | undefined {
  const hex = normalizeHex(brand?.primary);
  return hex ? { "--doc-brand": hex, "--doc-brand-fg": readableOn(hex) } : undefined;
}

// ── Aplicação na tela ──────────────────────────────────────────────

const CACHE_KEY = "mv-brand";

/** Pinta a cor principal da agência. `null` volta para a cor do produto. */
export function applyBrandColor(primary: string | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  const hex = normalizeHex(primary);
  if (!hex) {
    root.removeProperty("--brand");
    root.removeProperty("--brand-foreground");
    return;
  }
  root.setProperty("--brand", hex);
  root.setProperty("--brand-foreground", readableOn(hex));
}

export function readCachedBrand(agencyId?: string | null): Brand | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as Brand;
    if (!b?.agencyId || (agencyId && b.agencyId !== agencyId)) return null;
    return b;
  } catch {
    return null;
  }
}

export function cacheBrand(brand: Brand | null) {
  try {
    if (brand) localStorage.setItem(CACHE_KEY, JSON.stringify(brand));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* sem armazenamento local: segue sem cache */
  }
}

/** Ao sair da conta: volta a tela para a marca do produto. */
export function clearBrand() {
  cacheBrand(null);
  applyBrandColor(null);
}

/**
 * Roda antes de a tela pintar (em `__root.tsx`): aplica a cor guardada da
 * agência para não piscar a cor do produto a cada carregamento.
 */
export const BRAND_PREPAINT_SCRIPT =
  "try{var b=JSON.parse(localStorage.getItem('mv-brand')||'null');if(b&&/^#[0-9a-f]{6}$/i.test(b.primary||'')){var s=document.documentElement.style,h=b.primary,f=function(i){var v=parseInt(h.substr(i,2),16)/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)},l=0.2126*f(1)+0.7152*f(3)+0.0722*f(5);s.setProperty('--brand',h);s.setProperty('--brand-foreground',(l+0.05)/0.0557>=1.05/(l+0.05)?'#1a0f05':'#ffffff')}}catch(e){}";
