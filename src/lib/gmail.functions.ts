import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CONFIG, type EmailConfig } from "@/lib/gmail-config";

async function resolveAgencyEmailConfig(supabase: any, userId: string): Promise<EmailConfig> {
  let agencyId: string | null = null;
  try {
    const { data: member } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    agencyId = member?.agency_id || null;
  } catch {}

  if (!agencyId) {
    agencyId = "2a0f9141-3246-4c0f-b064-2bf4cb718adc";
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", `agency_cfg:${agencyId}:gmail`)
      .maybeSingle();

    if (!row || !row.value) return DEFAULT_CONFIG;
    const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Verifica o status da conexão de e-mail (Gmail ou Appwrite). */
export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ connected: boolean; provider?: string; email: string | null }> => {
    const config = await resolveAgencyEmailConfig(context.supabase, context.userId);
    if (!config.enabled) {
      return { connected: false, email: null };
    }
    if (config.provider === "gmail") {
      const ok = Boolean(config.gmailUser && config.gmailAppPassword);
      return { connected: ok, provider: "gmail", email: config.gmailUser || null };
    }
    if (config.provider === "appwrite") {
      const ok = Boolean(
        (config.appwriteSenderEmail && config.appwriteApiKey) ||
        (config.appwriteSmtpHost && config.appwriteSmtpUser)
      );
      return {
        connected: ok,
        provider: "appwrite",
        email: config.appwriteSenderEmail || config.appwriteSmtpUser || null,
      };
    }
    return { connected: false, email: null };
  });

/** Envia um e-mail de teste ou notificação usando o provedor ativo (Gmail ou Appwrite). */
export const sendGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        to: z.string().email(),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(20000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const config = await resolveAgencyEmailConfig(context.supabase, context.userId);
    const { sendEmailWithConfig } = await import("./email.server");
    return sendEmailWithConfig(config, { to: data.to, subject: data.subject, body: data.body });
  });
