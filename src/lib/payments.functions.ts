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
    const key = `agency_cfg:${agencyId}:payments`;
    const { data: row } = await (context.supabase as any)
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const data = row?.value;
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

    const key = `agency_cfg:${agencyId}:payments`;
    const { error } = await (context.supabase as any)
      .from("system_settings")
      .upsert({ key, value: row, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const chargeSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerCpfCnpj: z.string().min(1),
  billingType: z.enum(["BOLETO", "PIX", "CREDIT_CARD"]).default("PIX"),
  value: z.number().positive(),
  dueDate: z.string(), // YYYY-MM-DD
  description: z.string().optional(),
});

/** Cria uma cobrança no Asaas usando as credenciais da própria agência (admin). */
export const createAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => chargeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const agencyId = await resolveAgencyId(context.supabase, context.userId);
    if (!agencyId) throw new Error("Agência não encontrada para o usuário.");

    const { data: cfg } = await (context.supabase as any)
      .from("agency_payment_settings")
      .select("asaas_api_key, asaas_environment, is_active")
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (!cfg?.is_active || !cfg?.asaas_api_key) {
      throw new Error("Pagamentos não configurados para esta agência.");
    }

    const base =
      cfg.asaas_environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";
    const headers = {
      "Content-Type": "application/json",
      access_token: cfg.asaas_api_key as string,
    };

    // 1) Garante o cliente no Asaas
    const custRes = await fetch(`${base}/customers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: data.customerName,
        email: data.customerEmail,
        cpfCnpj: data.customerCpfCnpj,
      }),
    });
    const customer = await custRes.json();
    if (!custRes.ok) {
      throw new Error(customer?.errors?.[0]?.description ?? "Falha ao criar cliente no Asaas.");
    }

    // 2) Cria a cobrança
    const payRes = await fetch(`${base}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customer.id,
        billingType: data.billingType,
        value: data.value,
        dueDate: data.dueDate,
        description: data.description,
      }),
    });
    const payment = await payRes.json();
    if (!payRes.ok) {
      throw new Error(payment?.errors?.[0]?.description ?? "Falha ao criar cobrança no Asaas.");
    }

    return {
      ok: true as const,
      id: payment.id as string,
      status: payment.status as string,
      invoiceUrl: payment.invoiceUrl as string | undefined,
    };
  });
