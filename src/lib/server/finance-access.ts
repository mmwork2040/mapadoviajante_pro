// Acesso ao financeiro conferido no servidor: o cargo do usuário contra a
// configuração "Permissões de acesso" da Administração. Só para código de servidor.
import { getMembership } from "@/lib/server/authz";
import {
  CONFIGURABLE_ROLES,
  type AccessPermissions,
  type FinanceAccess,
} from "@/lib/finance.functions";

type Ctx = { userId: string; userEmail?: string; membership?: unknown };

export function normalizePermissions(raw: unknown): AccessPermissions {
  const finance = (raw as { finance?: { view?: unknown; edit?: unknown } } | null)?.finance ?? {};
  const pick = (v: unknown) =>
    Array.isArray(v) ? v.filter((r): r is string => CONFIGURABLE_ROLES.includes(r as never)) : [];
  return { finance: { view: pick(finance.view), edit: pick(finance.edit) } };
}

/** Acesso do usuário ao financeiro. O admin da agência sempre tem acesso total. */
export async function resolveFinanceAccess(
  ctx: Ctx,
): Promise<FinanceAccess & { agencyId: string; memberId: string }> {
  const m = await getMembership(ctx as never);
  if (m.role === "admin" || m.role === "owner" || m.isSuperAdmin) {
    return { canView: true, canEdit: true, agencyId: m.agencyId, memberId: m.memberId };
  }
  const { readAgencyConfigServer } = await import("@/lib/settings.functions");
  const perms = normalizePermissions(await readAgencyConfigServer(m.agencyId, "permissions"));
  const canEdit = perms.finance.edit.includes(m.role);
  const canView = canEdit || perms.finance.view.includes(m.role);
  return { canView, canEdit, agencyId: m.agencyId, memberId: m.memberId };
}

export async function requireFinance(ctx: Ctx, need: "view" | "edit") {
  const access = await resolveFinanceAccess(ctx);
  if (need === "view" ? !access.canView : !access.canEdit) {
    throw new Error("Sem permissão para o financeiro.");
  }
  return access;
}
