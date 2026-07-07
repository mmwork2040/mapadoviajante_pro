import { supabase } from "@/integrations/supabase/client";

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
