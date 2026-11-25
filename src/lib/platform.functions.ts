import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Funções da plataforma (super admin) e do consumo de IA da agência.

export type AgencyAiUsageRow = {
  agencyId: string;
  name: string;
  totalTokens: number;
  requests: number;
  limit: number; // 0 = sem limite
  customLimit: boolean;
};

/** Consumo de IA da agência do usuário no mês (para o admin da agência). */
export const getMyAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMembership } = await import("@/lib/server/authz");
    const { platformAi } = await import("@/lib/server/ai-settings");
    const { readUsage, agencyLimit, currentMonth } = await import("@/lib/server/ai-usage");
    const m = await getMembership(context);
    const platform = platformAi();
    const usage = await readUsage(m.agencyId);
    return {
      platform: !!platform,
      model: platform?.model ?? null,
      month: currentMonth(),
      totalTokens: usage.totalTokens,
      requests: usage.requests,
      limit: platform ? await agencyLimit(m.agencyId) : 0,
    };
  });

/** Visão geral do consumo de IA de todas as agências (super admin). */
export const getAiUsageOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireSuperAdmin } = await import("@/lib/server/authz");
    requireSuperAdmin(context);
    const { getServerBridge } = await import("@/integrations/appwrite/server");
    const { readQuotaConfig, currentMonth, parseUsage } = await import("@/lib/server/ai-usage");
    const { platformAi } = await import("@/lib/server/ai-settings");
    const db = getServerBridge();
    const month = currentMonth();

    const [{ data: agencies, error: agErr }, { data: usageRows }, quota] = await Promise.all([
      db.from("agencies").select("id, name").order("name", { ascending: true }),
      db.from("system_settings").select("key, value").like("key", `ai_usage:%:${month}`),
      readQuotaConfig(),
    ]);
    if (agErr) throw new Error("Não foi possível carregar as agências.");

    const usageByAgency = new Map<string, ReturnType<typeof parseUsage>>();
    for (const row of (usageRows as { key: string; value: unknown }[] | null) ?? []) {
      const agencyId = row.key.split(":")[1];
      if (agencyId) usageByAgency.set(agencyId, parseUsage(row.value));
    }

    const rows: AgencyAiUsageRow[] = ((agencies as { id: string; name?: string }[] | null) ?? []).map((a) => {
      const u = usageByAgency.get(a.id);
      const custom = a.id in quota.agencies;
      return {
        agencyId: a.id,
        name: a.name || "Agência sem nome",
        totalTokens: u?.totalTokens ?? 0,
        requests: u?.requests ?? 0,
        limit: custom ? quota.agencies[a.id] : quota.defaultMonthlyTokens,
        customLimit: custom,
      };
    });
    rows.sort((a, b) => b.totalTokens - a.totalTokens);

    const platform = platformAi();
    return {
      month,
      platform: !!platform,
      model: platform?.model ?? null,
      defaultMonthlyTokens: quota.defaultMonthlyTokens,
      rows,
    };
  });

/** Altera o limite padrão ou o limite de uma agência (super admin). */
export const saveAiQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        defaultMonthlyTokens: z.number().int().min(0).max(10_000_000_000).optional(),
        agencyId: z.string().min(1).max(64).optional(),
        // número = limite próprio; null = volta a usar o padrão
        agencyLimit: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireSuperAdmin } = await import("@/lib/server/authz");
    requireSuperAdmin(context);
    const { readQuotaConfig, writeQuotaConfig } = await import("@/lib/server/ai-usage");
    const cfg = await readQuotaConfig();
    if (typeof data.defaultMonthlyTokens === "number") cfg.defaultMonthlyTokens = data.defaultMonthlyTokens;
    if (data.agencyId && data.agencyLimit !== undefined) {
      if (data.agencyLimit === null) delete cfg.agencies[data.agencyId];
      else cfg.agencies[data.agencyId] = data.agencyLimit;
    }
    await writeQuotaConfig(cfg);
    return { ok: true };
  });
