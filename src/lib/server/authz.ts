// Autorização das server functions. O middleware `requireSupabaseAuth` só
// garante que há um usuário logado; estas funções conferem agência e papel.

export type AuthedContext = {
  supabase: any;
  userId: string;
  userEmail?: string;
};

export type Membership = {
  agencyId: string;
  memberId: string;
  role: string;
  isSuperAdmin: boolean;
};

const ADMIN_ROLES = new Set(['admin', 'owner']);

const DEFAULT_SUPER_ADMINS = ['celiogomesalves@gmail.com', 'lukasgabriel1036@gmail.com'];

/** Super admins vêm de SUPER_ADMIN_EMAILS (separados por vírgula) no servidor. */
export function superAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS;
  const list = raw ? raw.split(',') : DEFAULT_SUPER_ADMINS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isSuperAdmin(ctx: AuthedContext): boolean {
  const email = (ctx.userEmail || '').trim().toLowerCase();
  return !!email && superAdminEmails().includes(email);
}

const MEMBER_FIELDS = 'id, agency_id, role, is_active, user_id, email, created_at';

/**
 * Agência ativa do usuário. Procura pelo `user_id`; se não achar, aceita uma
 * linha com o mesmo e-mail que ainda não foi vinculada a nenhuma conta
 * (contas migradas e convites). Lança erro se não houver agência ativa.
 */
export async function getMembership(ctx: AuthedContext): Promise<Membership> {
  const db = ctx.supabase;
  const { data: byUser, error } = await db
    .from('agency_members')
    .select(MEMBER_FIELDS)
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) {
    console.error('[authz] falha ao buscar agência:', error);
    throw new Error('Não foi possível verificar sua agência. Tente novamente.');
  }

  let row = byUser?.[0];
  if (!row && ctx.userEmail) {
    const { data: byEmail } = await db
      .from('agency_members')
      .select(MEMBER_FIELDS)
      .eq('email', ctx.userEmail.trim().toLowerCase())
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(5);
    row = (byEmail || []).find((m: any) => !m.user_id);
  }

  if (!row?.agency_id) throw new Error('Sem agência ativa.');
  return {
    agencyId: row.agency_id,
    memberId: row.id,
    role: row.role || '',
    isSuperAdmin: isSuperAdmin(ctx),
  };
}

/** Exige admin (ou dono) da agência do usuário. Super admin também passa. */
export async function requireAdmin(ctx: AuthedContext): Promise<Membership> {
  const m = await getMembership(ctx);
  if (!ADMIN_ROLES.has(m.role) && !m.isSuperAdmin) throw new Error('Sem permissão.');
  return m;
}

/** Exige super admin da plataforma. */
export function requireSuperAdmin(ctx: AuthedContext): void {
  if (!isSuperAdmin(ctx)) throw new Error('Sem permissão.');
}
