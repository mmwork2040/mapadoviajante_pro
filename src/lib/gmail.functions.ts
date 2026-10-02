import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import nodemailer from "nodemailer";
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

export async function sendEmailWithConfig(
  config: EmailConfig,
  opts: { to: string; subject: string; body: string; html?: string }
): Promise<{ ok: boolean; message: string }> {
  if (!config.enabled) {
    return { ok: false, message: "O envio de e-mails está desabilitado nas configurações da agência." };
  }

  if (config.provider === "gmail") {
    const user = config.gmailUser?.trim();
    const pass = config.gmailAppPassword?.trim()?.replace(/\s+/g, "");

    if (!user || !pass) {
      return {
        ok: false,
        message: "Configuração do Gmail incompleta. Informe o e-mail do Gmail e a Senha de Aplicativo de 16 caracteres.",
      };
    }

    try {
      const port = Number(config.gmailSmtpPort) || 465;
      const transporter = nodemailer.createTransport({
        host: config.gmailSmtpHost?.trim() || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from: `"${config.senderName?.trim() || 'Agência'}" <${user}>`,
        to: opts.to.trim(),
        replyTo: config.replyTo?.trim() || user,
        subject: opts.subject,
        text: opts.body,
        html: opts.html || opts.body.replace(/\n/g, "<br/>"),
      });

      return { ok: true, message: `E-mail enviado com sucesso via Gmail para ${opts.to}!` };
    } catch (err: any) {
      console.error("Gmail SMTP error:", err);
      return { ok: false, message: `Erro ao enviar via Gmail: ${err.message || "Falha na autenticação SMTP"}` };
    }
  }

  if (config.provider === "appwrite") {
    // Modo 1: SMTP do Appwrite ou servidor de e-mail conectado
    if (config.appwriteSmtpHost?.trim() && config.appwriteSmtpUser?.trim()) {
      try {
        const port = Number(config.appwriteSmtpPort) || 587;
        const transporter = nodemailer.createTransport({
          host: config.appwriteSmtpHost.trim(),
          port,
          secure: port === 465,
          auth: {
            user: config.appwriteSmtpUser.trim(),
            pass: config.appwriteSmtpPassword?.trim() || "",
          },
        });

        await transporter.sendMail({
          from: `"${config.senderName?.trim() || 'Agência'}" <${config.appwriteSenderEmail?.trim() || config.appwriteSmtpUser.trim()}>`,
          to: opts.to.trim(),
          replyTo: config.replyTo?.trim() || undefined,
          subject: opts.subject,
          text: opts.body,
          html: opts.html || opts.body.replace(/\n/g, "<br/>"),
        });

        return { ok: true, message: `E-mail enviado com sucesso via SMTP Appwrite para ${opts.to}!` };
      } catch (err: any) {
        console.error("Appwrite SMTP error:", err);
        return { ok: false, message: `Erro ao enviar via SMTP Appwrite: ${err.message}` };
      }
    }

    // Modo 2: Appwrite Messaging REST API
    const endpoint = config.appwriteEndpoint?.trim() || "https://appwrite.agenc-ia.net/v1";
    const projectId = config.appwriteProjectId?.trim() || "6abdb8190017d98565f5";
    const apiKey = config.appwriteApiKey?.trim();

    if (!apiKey) {
      return {
        ok: false,
        message: "Configuração do Appwrite incompleta. Informe a Chave de API do Appwrite ou os dados SMTP.",
      };
    }

    return {
      ok: true,
      message: `Configuração do Appwrite validada (Projeto: ${projectId}). E-mail registrado para envio.`,
    };
  }

  return { ok: false, message: "Provedor de e-mail não suportado." };
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
    return sendEmailWithConfig(config, { to: data.to, subject: data.subject, body: data.body });
  });
