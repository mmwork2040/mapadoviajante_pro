import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_CONFIG, type EmailConfig } from "@/lib/gmail-config";

async function resolveAgencyEmailConfig(agencyId: string): Promise<EmailConfig> {
  const { readAgencyConfigServer } = await import("@/lib/settings.functions");
  const value = await readAgencyConfigServer(agencyId, "gmail");
  return value ? { ...DEFAULT_CONFIG, ...(value as Partial<EmailConfig>) } : DEFAULT_CONFIG;
}

/** Verifica o status da conexão de e-mail (Gmail ou Appwrite). */
export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ connected: boolean; provider?: string; email: string | null }> => {
    const { getMembership } = await import("@/lib/server/authz");
    const m = await getMembership(context);
    const config = await resolveAgencyEmailConfig(m.agencyId);
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
    const { requireAdmin } = await import("@/lib/server/authz");
    const m = await requireAdmin(context);
    const config = await resolveAgencyEmailConfig(m.agencyId);
    if (!config.enabled) return { ok: false, message: "O envio de e-mail está desativado na Administração." };
    const { sendEmailWithConfig } = await import("./email.server");
    return sendEmailWithConfig(config, { to: data.to, subject: data.subject, body: data.body });
  });
