import { supabase } from "@/integrations/supabase/client";

// Personalização visual do PDF de roteiro (marca da agência): logo escolhida da
// biblioteca, textos da página de abertura e cores douradas da paleta.
export interface AgencyBranding {
  /** Caminho/URL da imagem da biblioteca usada como logo (substitui o wordmark). */
  logoPath?: string | null;
  /** Textos da página de abertura/capa. */
  openingTitle?: string;
  openingSubtitle?: string;
  openingFooter?: string;
  /** Cores da paleta do PDF. */
  colorGold?: string;
  colorGoldDark?: string;
}

export const DEFAULT_BRANDING: AgencyBranding = {
  logoPath: null,
  openingTitle: "",
  openingSubtitle: "",
  openingFooter: "",
  colorGold: "#B8965A",
  colorGoldDark: "#A07B3B",
};

/** Carrega a personalização de marca da agência do usuário. */
export async function getAgencyBranding(): Promise<AgencyBranding> {
  const { data: agencyId } = await supabase.rpc("get_user_agency_id");
  if (!agencyId) return { ...DEFAULT_BRANDING };
  const { data } = await supabase
    .from("agencies")
    .select("settings")
    .eq("id", agencyId as string)
    .maybeSingle();
  const branding = (data as { settings?: { branding?: AgencyBranding } } | null)?.settings?.branding;
  return { ...DEFAULT_BRANDING, ...(branding ?? {}) };
}

/** Salva a personalização de marca preservando as demais chaves de settings. */
export async function saveAgencyBranding(
  branding: AgencyBranding,
): Promise<{ ok: boolean; error?: string }> {
  const { data: agencyId } = await supabase.rpc("get_user_agency_id");
  if (!agencyId) return { ok: false, error: "Agência não encontrada." };
  const { data: current } = await supabase
    .from("agencies")
    .select("settings")
    .eq("id", agencyId as string)
    .maybeSingle();
  const settings = {
    ...((current as { settings?: Record<string, unknown> } | null)?.settings ?? {}),
    branding,
  };
  const { error } = await supabase
    .from("agencies")
    .update({ settings } as never)
    .eq("id", agencyId as string);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface AgencyAddress {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
}

export interface AgencyInfo {
  id: string;
  name: string;
  phone: string;
  email: string;
  cnpj: string;
  address: AgencyAddress;
}

const EMPTY_ADDRESS: AgencyAddress = {};

/** Carrega os dados da agência do usuário logado. */
export async function getAgencyInfo(): Promise<AgencyInfo | null> {
  const { data: agencyId } = await supabase.rpc("get_user_agency_id");
  if (!agencyId) return null;
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, phone, email, cnpj, settings")
    .eq("id", agencyId as string)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    cnpj: string | null;
    settings: { address?: AgencyAddress } | null;
  };
  return {
    id: row.id,
    name: row.name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    cnpj: row.cnpj ?? "",
    address: row.settings?.address ?? EMPTY_ADDRESS,
  };
}

/** Salva os dados da agência. */
export async function saveAgencyInfo(info: AgencyInfo): Promise<{ ok: boolean; error?: string }> {
  // Preserva outras chaves existentes em settings
  const { data: current } = await supabase
    .from("agencies")
    .select("settings")
    .eq("id", info.id)
    .maybeSingle();
  const settings = {
    ...((current as { settings?: Record<string, unknown> } | null)?.settings ?? {}),
    address: info.address,
  };
  const { error } = await supabase
    .from("agencies")
    .update({
      name: info.name.trim(),
      phone: info.phone.trim() || null,
      email: info.email.trim() || null,
      cnpj: info.cnpj.trim() || null,
      settings,
    } as never)
    .eq("id", info.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface CepResult {
  street: string;
  district: string;
  city: string;
  state: string;
}

/** Consulta o CEP via ViaCEP. */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
