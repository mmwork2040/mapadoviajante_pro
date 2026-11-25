// Acesso do usuário ao financeiro. Só para uso no servidor.
import { getMembership } from "@/lib/server/authz";
import { normalizePermissions, type FinanceAccess } from "@/lib/finance.functions";
import { readAgencyConfigServer } from "@/lib/settings.functions";

type Ctx = { userId: string; userEmail?: string; membership?: unknown };

export async function resolveFinanceAccess(
  ctx: Ctx,
): Promise<FinanceAccess & { agencyId: string; memberId: string }> {
  const m = await getMembership(ctx as never);
  if (m.role === "admin" || m.role === "owner" || m.isSuperAdmin) {
    return { canView: true, canEdit: true, agencyId: m.agencyId, memberId: m.memberId };
  }
  const perms = normalizePermissions(await readAgencyConfigServer(m.agencyId, "permissions"));
  const canEdit = perms.finance.edit.includes(m.role);
  const canView = canEdit || perms.finance.view.includes(m.role);
  return { canView, canEdit, agencyId: m.agencyId, memberId: m.memberId };
}
