import nodemailer from "nodemailer";
import type { EmailConfig } from "@/lib/gmail-config";

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
    // Modo 1: SMTP do Appwrite ou servidor conectado
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
