// Autorização das server functions. O middleware `requireSupabaseAuth` garante
// que há um usuário logado e já descobre a agência dele; estas funções
// conferem agência e papel antes de ações restritas.
import { getServerBridge } from '@/integrations/appwrite/server';

export type Membership = {
  agencyId: string;
  memberId: string;
  role: string;
  isSuperAdmin: boolean;
  /** Liberação da agência suspensa (Hotmart ou super admin). */
  suspended: boolean;
};

export type AuthedContext = {
  userId: string;
  userEmail?: string;
  membership?: Membership | null;
};

const ADMIN_ROLES = new Set(['admin', 'owner']);

const DEFAULT_SUPER_ADMINS = ['celiogomesalves@gmail.com', 'lukasgabriel1036@gmail.com'];

/** Super admins vêm de SUPER_ADMIN_EMAILS (separados por vírgula) no servidor. */
export function superAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS;
  const list = raw ? raw.split(',') : DEFAULT_SUPER_ADMINS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isSuperAdmin(ctx: { userEmail?: string }): boolean {
  const email = (ctx.userEmail || '').trim().toLowerCase();
  return !!email && superAdminEmails().includes(email);
}

const MEMBER_FIELDS = 'id, agency_id, role, is_active, user_id, email, created_at';

/**
 * Agência ativa do usuário, ou null. Procura pelo `user_id`; se não achar,
 * aceita uma linha com o mesmo e-mail que ainda não foi vinculada a nenhuma
 * conta (contas migradas e convites). Usa o cliente sem escopo de agência,
 * porque é justamente aqui que a agência é descoberta.
 */
export async function findMembership(user: { userId: string; userEmail?: string }): Promise<Membership | null> {
  const db = getServerBridge();
  const { data: byUser, error } = await db
    .from('agency_members')
    .select(MEMBER_FIELDS)
    .eq('user_id', user.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) {
    console.error('[authz] falha ao buscar agência:', error);
    throw new Error('Não foi possível verificar sua agência. Tente novamente.');
  }

  let row = (byUser as any[] | null)?.[0];
  if (!row && user.userEmail) {
    const { data: byEmail } = await db
      .from('agency_members')
      .select(MEMBER_FIELDS)
      .eq('email', user.userEmail.trim().toLowerCase())
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(5);
    row = ((byEmail as any[] | null) || []).find((m) => !m.user_id);
  }

  if (!row?.agency_id) return null;
  const { isAgencySuspended } = await import('@/lib/server/access');
  return {
    agencyId: row.agency_id,
    memberId: row.id,
    role: row.role || '',
    isSuperAdmin: isSuperAdmin(user),
    suspended: await isAgencySuspended(row.agency_id),
  };
}

/** Agência ativa do usuário. Lança erro se não houver. */
export async function getMembership(ctx: AuthedContext): Promise<Membership> {
  const m = ctx.membership !== undefined ? ctx.membership : await findMembership(ctx);
  if (!m) throw new Error('Sem agência ativa.');
  if (m.suspended && !m.isSuperAdmin) throw new Error('O acesso da agência está suspenso.');
  return m;
}

/** Exige admin (ou dono) da agência do usuário. Super admin também passa. */
export async function requireAdmin(ctx: AuthedContext): Promise<Membership> {
  const m = await getMembership(ctx);
  if (!ADMIN_ROLES.has(m.role) && !m.isSuperAdmin) throw new Error('Sem permissão.');
  return m;
}

/** Exige super admin da plataforma. */
export function requireSuperAdmin(ctx: { userEmail?: string }): void {
  if (!isSuperAdmin(ctx)) throw new Error('Sem permissão.');
}
