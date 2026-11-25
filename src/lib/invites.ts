import { db } from "@/integrations/appwrite/db";
import { getInviteInfoFn } from "@/lib/invites.functions";

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

const INVALID: InviteInfo = { valid: false, email: null, name: null, agency_name: null };

type MemberRow = {
  id: string;
  agency_id: string;
  name: string;
  email?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  invite_token?: string | null;
  user_id?: string | null;
};

const sameEmail = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Lê os dados de um convite a partir do token (não exige login). */
export async function getInviteInfo(token: string): Promise<InviteInfo> {
  if (!token) return INVALID;
  try {
    return await getInviteInfoFn({ data: { token } });
  } catch {
    return INVALID;
  }
}

async function currentUser(): Promise<{ id: string; email: string } | null> {
  const { data } = await db.auth.getUser();
  const user = data?.user as { id?: string; email?: string } | null;
  return user?.id ? { id: user.id, email: (user.email || "").trim().toLowerCase() } : null;
}

/** Convites ainda não aceitos enviados para este e-mail. */
async function pendingRowsFor(email: string): Promise<MemberRow[]> {
  if (!email) return [];
  const { data, error } = await db.from("agency_members").select("*").eq("email", email);
  if (error) throw new Error("Não foi possível conferir os convites.");
  return ((data as MemberRow[] | null) || []).filter((m) => m.status === "pending" && !m.user_id);
}

/**
 * Aceita o convite. Com o token do link, vale só se o e-mail da conta for o do
 * convite. Sem token, aceita o convite pendente do e-mail de quem está logado.
 */
export async function acceptInvite(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await currentUser();
    if (!user) return { ok: false, error: "Entre na sua conta para aceitar o convite." };

    let row: MemberRow | undefined;
    if (token) {
      const { data, error } = await db.from("agency_members").select("*").eq("invite_token", token).limit(1);
      if (error) return { ok: false, error: "Não foi possível conferir o convite. Tente novamente." };
      row = (data as MemberRow[] | null)?.[0];
      if (!row) return { ok: false, error: "Este convite não existe ou já foi utilizado." };
      if (row.email && !sameEmail(row.email, user.email)) {
        return { ok: false, error: "Este convite foi enviado para outro e-mail." };
      }
    } else {
      row = (await pendingRowsFor(user.email))[0];
      if (!row) return { ok: false, error: "Nenhum convite pendente para o seu e-mail." };
    }

    const { error } = await db
      .from("agency_members")
      .update({ user_id: user.id, status: "active", is_active: true, invite_token: null })
      .eq("id", row.id);
    if (error) return { ok: false, error: "Não foi possível aceitar o convite." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao aceitar o convite." };
  }
}

/**
 * Convite pendente para o e-mail do usuário logado (se houver). Lança erro se a
 * consulta falhar, para ninguém confundir "não consegui conferir" com "não há".
 */
export async function getMyPendingInvite(): Promise<PendingInvite | null> {
  const user = await currentUser();
  if (!user) return null;
  const row = (await pendingRowsFor(user.email))[0];
  if (!row) return null;
  const { data: agency } = await db.from("agencies").select("name").eq("id", row.agency_id).maybeSingle();
  return {
    id: row.id,
    agency_id: row.agency_id,
    name: row.name,
    email: row.email || user.email,
    agency_name: (agency as { name?: string } | null)?.name ?? null,
  };
}
