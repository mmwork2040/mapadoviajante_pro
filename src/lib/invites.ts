import { supabase } from "@/integrations/supabase/client";

export interface InviteInfo {
  valid: boolean;
  email: string | null;
  name: string | null;
  agency_name: string | null;
}

export interface PendingInvite {
  id: string;
  agency_id: string;
  name: string;
  email: string;
  agency_name: string | null;
}

/** Lê os dados de um convite a partir do token (não exige login). */
export async function getInviteInfo(token: string): Promise<InviteInfo> {
  try {
    const { data, error } = await (supabase.rpc as never as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)("get_invite_info", { _token: token });
    if (error || !data) return { valid: false, email: null, name: null, agency_name: null };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { valid: false, email: null, name: null, agency_name: null };
    return {
      valid: true,
      email: (row as InviteInfo).email,
      name: (row as InviteInfo).name,
      agency_name: (row as InviteInfo).agency_name,
    };
  } catch {
    return { valid: false, email: null, name: null, agency_name: null };
  }
}

/** Aceita o convite (usuário autenticado, e-mail precisa coincidir). */
export async function acceptInvite(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await (supabase.rpc as never as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message?: string } | null }>)("accept_agency_invite", { _token: token });
    if (error) return { ok: false, error: error.message ?? "Não foi possível aceitar o convite." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao aceitar o convite." };
  }
}

/** Convite pendente para o e-mail do usuário logado (se houver). */
export async function getMyPendingInvite(): Promise<PendingInvite | null> {
  try {
    const { data, error } = await (supabase.rpc as never as (
      fn: string,
    ) => Promise<{ data: unknown; error: unknown }>)("my_pending_invite");
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as PendingInvite) ?? null;
  } catch {
    return null;
  }
}
