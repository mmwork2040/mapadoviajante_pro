// Convites para a equipe. Tudo passa pelo servidor: quem ainda não está no time
// da agência não consegue ler a linha do convite diretamente.
import { garantirAcesso, infoDoConvite } from "@/lib/access.functions";

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
    return await infoDoConvite({ data: { token } });
  } catch {
    return { valid: false, email: null, name: null, agency_name: null };
  }
}

/** Aceita o convite do link (usuário logado; o e-mail precisa ser o do convite). */
export async function acceptInvite(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await garantirAcesso({ data: { token } });
    if (res.member) return { ok: true };
    return { ok: false, error: "Este convite não é para o e-mail desta conta, ou já foi usado." };
  } catch {
    return { ok: false, error: "Erro ao aceitar o convite." };
  }
}
