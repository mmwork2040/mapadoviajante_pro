import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Financeiro da agência. Tudo passa pelo servidor, que confere o cargo do
// usuário contra a configuração "Permissões de acesso" da Administração.
// O admin da agência sempre tem acesso total.

/** Cargos que o admin pode liberar para o financeiro. */
export const CONFIGURABLE_ROLES = ["gerente", "consultor"] as const;

export type AccessPermissions = {
  finance: { view: string[]; edit: string[] };
};

export const DEFAULT_ACCESS_PERMISSIONS: AccessPermissions = {
  finance: { view: [], edit: [] },
};

export type FinanceAccess = { canView: boolean; canEdit: boolean };

type Ctx = { userId: string; userEmail?: string; membership?: unknown };

function normalizePermissions(raw: unknown): AccessPermissions {
  const finance = (raw as { finance?: { view?: unknown; edit?: unknown } } | null)?.finance ?? {};
  const pick = (v: unknown) =>
    Array.isArray(v) ? v.filter((r): r is string => CONFIGURABLE_ROLES.includes(r as never)) : [];
  return { finance: { view: pick(finance.view), edit: pick(finance.edit) } };
}

/** Acesso do usuário ao financeiro. Só para uso no servidor. */
export async function resolveFinanceAccess(ctx: Ctx): Promise<FinanceAccess & { agencyId: string; memberId: string }> {
  const { getMembership } = await import("@/lib/server/authz");
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

async function requireFinance(ctx: Ctx, need: "view" | "edit") {
  const access = await resolveFinanceAccess(ctx);
  if (need === "view" ? !access.canView : !access.canEdit) {
    throw new Error("Sem permissão para o financeiro.");
  }
  return access;
}

/** O que o usuário logado pode fazer no financeiro (para esconder telas e botões). */
export const getFinanceAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceAccess> => {
    try {
      const { canView, canEdit } = await resolveFinanceAccess(context);
      return { canView, canEdit };
    } catch {
      return { canView: false, canEdit: false };
    }
  });

const filtersSchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  status: z.string().max(30).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lead_id: z.string().max(64).optional(),
});

/** Lista as transações da agência. Exige permissão de ver o financeiro. */
export const listTransactionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => filtersSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await requireFinance(context, "view");
    let query = context.supabase
      .from("crm_transactions")
      .select("*, lead:crm_leads!crm_transactions_lead_id_fkey(name)")
      .order("transaction_date", { ascending: false });
    if (data.type) query = query.eq("type", data.type);
    if (data.status) query = query.eq("status", data.status);
    if (data.lead_id) query = query.eq("lead_id", data.lead_id);
    if (data.from) query = query.gte("transaction_date", data.from);
    if (data.to) query = query.lte("transaction_date", data.to);
    const { data: rows, error } = await query;
    if (error) {
      console.error("listTransactionsFn:", error);
      throw new Error("Não foi possível carregar as transações.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows ?? []) as any[];
  });

/** Registra uma transação. Exige permissão de editar o financeiro. */
export const createTransactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        type: z.enum(["income", "expense"]),
        amount: z.number().finite().nonnegative().max(1_000_000_000),
        description: z.string().max(500).nullable().optional(),
        category: z.string().max(60).nullable().optional(),
        transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.string().max(30).optional(),
        lead_id: z.string().max(64).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const access = await requireFinance(context, "edit");
    const { data: row, error } = await context.supabase
      .from("crm_transactions")
      .insert({
        lead_id: data.lead_id || null,
        type: data.type,
        amount: data.amount,
        description: data.description || null,
        category: data.category || null,
        transaction_date: data.transaction_date,
        status: data.status || "pending",
        created_by: access.memberId,
      })
      .select()
      .single();
    if (error || !row) {
      console.error("createTransactionFn:", error);
      throw new Error("Não foi possível registrar a transação.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return row as any;
  });

/** Lê a configuração de permissões de acesso (qualquer membro). */
export const getAccessPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessPermissions> => {
    const { getMembership } = await import("@/lib/server/authz");
    const m = await getMembership(context);
    const { readAgencyConfigServer } = await import("@/lib/settings.functions");
    return normalizePermissions(await readAgencyConfigServer(m.agencyId, "permissions"));
  });

/** Salva a configuração de permissões de acesso. Só admin. */
export const saveAccessPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        finance: z.object({
          view: z.array(z.enum(CONFIGURABLE_ROLES)).max(10),
          edit: z.array(z.enum(CONFIGURABLE_ROLES)).max(10),
        }),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/server/authz");
    const m = await requireAdmin(context);
    // Quem pode editar também pode ver.
    const view = Array.from(new Set([...data.finance.view, ...data.finance.edit]));
    const { writeAgencyConfigServer } = await import("@/lib/settings.functions");
    await writeAgencyConfigServer(m.agencyId, "permissions", { finance: { view, edit: data.finance.edit } });
    return { ok: true };
  });
