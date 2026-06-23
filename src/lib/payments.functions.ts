import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Configuração de pagamentos (Asaas) por agência.
// A chave de API NUNCA é devolvida ao cliente — apenas o indicador `hasApiKey`.
// Leitura/escrita restritas a administradores da própria agência (RLS).

export interface AgencyPaymentConfig {
  isActive: boolean;
  environment: "sandbox" | "production";
  hasApiKey: boolean;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  trialDays: number;
  gracePeriodDays: number;
  firstLayerRate: number | null;
  secondLayerRate: number | null;
  webhookToken: string | null;
}

export const DEFAULT_PAYMENT_CONFIG: AgencyPaymentConfig = {
  isActive: false,
  environment: "sandbox",
  hasApiKey: false,
  monthlyPrice: null,
  yearlyPrice: null,
  trialDays: 0,
  gracePeriodDays: 0,
  firstLayerRate: null,
  secondLayerRate: null,
  webhookToken: null,
};

async function resolveAgencyId(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data?.agency_id as string | undefined) ?? null;
}

/** Lê a configuração de pagamentos da agência do usuário (admin). */
export const getAgencyPaymentConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgencyPaymentConfig> => {
    const agencyId = await resolveAgencyId(context.supabase, context.userId);
    if (!agencyId) return DEFAULT_PAYMENT_CONFIG;
    const { data } = await (context.supabase as any)
      .from("agency_payment_settings")
      .select(
        "is_active, asaas_environment, asaas_api_key, asaas_webhook_token, monthly_price, yearly_price, trial_days, grace_period_days, first_layer_rate, second_layer_rate",
      )
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (!data) return DEFAULT_PAYMENT_CONFIG;
    return {
      isActive: !!data.is_active,
      environment: (data.asaas_environment as "sandbox" | "production") ?? "sandbox",
      hasApiKey: !!data.asaas_api_key,
      monthlyPrice: data.monthly_price ?? null,
      yearlyPrice: data.yearly_price ?? null,
      trialDays: data.trial_days ?? 0,
      gracePeriodDays: data.grace_period_days ?? 0,
      firstLayerRate: data.first_layer_rate ?? null,
      secondLayerRate: data.second_layer_rate ?? null,
      webhookToken: (data.asaas_webhook_token as string | null) ?? null,
    };
  });

const saveSchema = z.object({
  isActive: z.boolean(),
  environment: z.enum(["sandbox", "production"]),
  // string vazia = manter a chave atual; valor = nova chave
  apiKey: z.string().optional(),
  monthlyPrice: z.number().nullable(),
  yearlyPrice: z.number().nullable(),
  trialDays: z.number().int().min(0),
  gracePeriodDays: z.number().int().min(0),
  firstLayerRate: z.number().nullable(),
  secondLayerRate: z.number().nullable(),
});

/** Salva a configuração de pagamentos da agência do usuário (admin). */
export const saveAgencyPaymentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const agencyId = await resolveAgencyId(context.supabase, context.userId);
    if (!agencyId) throw new Error("Agência não encontrada para o usuário.");

    const row: Record<string, unknown> = {
      agency_id: agencyId,
      is_active: data.isActive,
      asaas_environment: data.environment,
      monthly_price: data.monthlyPrice,
      yearly_price: data.yearlyPrice,
      trial_days: data.trialDays,
      grace_period_days: data.gracePeriodDays,
      first_layer_rate: data.firstLayerRate,
      second_layer_rate: data.secondLayerRate,
      updated_at: new Date().toISOString(),
    };
    // Só sobrescreve a chave quando uma nova for informada.
    if (data.apiKey && data.apiKey.trim()) {
      row.asaas_api_key = data.apiKey.trim();
    }

    const { error } = await context.supabase
      .from("agency_payment_settings")
      .upsert(row, { onConflict: "agency_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
