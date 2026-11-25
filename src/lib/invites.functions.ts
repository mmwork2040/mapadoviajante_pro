import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// email.server imported dynamically
import { DEFAULT_CONFIG, type EmailConfig } from "@/lib/gmail-config";

const MEMBER_COLORS = ["#ff7a1a", "#2563eb", "#16a34a", "#db2777", "#9333ea", "#0891b2"];

/** Verifica se o envio de e-mails está configurado e ativo. */
export const getEmailConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMembership } = await import("@/lib/server/authz");
    const { agencyId } = await getMembership(context);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("key", `agency_cfg:${agencyId}:gmail`)
        .maybeSingle();

      if (!row?.value) return { configured: false };
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      const isOk = parsed.enabled && (
        (parsed.provider === "gmail" && parsed.gmailUser && parsed.gmailAppPassword) ||
        (parsed.provider === "appwrite" && (parsed.appwriteApiKey || parsed.appwriteSmtpUser))
      );
      return { configured: Boolean(isOk) };
    } catch {
      return { configured: false };
    }
  });

const ROLES = ["admin", "gerente", "consultor"] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inviteHtml(opts: { name: string; agency: string; inviter: string; link: string }) {
  const name = escapeHtml(opts.name);
  const agency = escapeHtml(opts.agency);
  const inviter = escapeHtml(opts.inviter);
  const link = escapeHtml(opts.link);
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#ff7a1a;padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">${agency}</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 14px;font-size:16px;">Olá, <strong>${name}</strong>!</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${inviter}</strong> convidou você para participar da equipe da agência
          <strong>${agency}</strong> no Mapa do Viajante PRO.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">
          Para começar a usar o sistema, aceite o convite clicando no botão abaixo.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;background:#ff7a1a;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:12px;font-size:15px;">
            Aceitar convite
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
          Se o botão não funcionar, copie e cole este endereço no navegador:<br/>
          <span style="color:#ff7a1a;word-break:break-all;">${link}</span>
        </p>
        <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">
          Você só terá acesso ao sistema após aceitar este convite.
        </p>
      </div>
    </div>
  </div></body></html>`;
}

/** Envia um convite por e-mail para um novo membro da agência. */
export const sendTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        // "agent" era o valor padrão antigo; vira consultor.
        role: z
          .string()
          .trim()
          .transform((r) => (r === "agent" || !r ? "consultor" : r))
          .pipe(z.enum(ROLES))
          .default("consultor"),
        appUrl: z.string().url().max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const email = data.email.toLowerCase();

    // Só admin convida, e sempre para a própria agência.
    const { requireAdmin } = await import("@/lib/server/authz");
    const { agencyId: activeAgencyId } = await requireAdmin(context);

    // Já é membro ativo?
    const { data: existing } = await supabase
      .from("agency_members")
      .select("id, is_active")
      .eq("agency_id", activeAgencyId)
      .eq("email", email)
      .maybeSingle();

    if (existing && (existing as { is_active?: boolean }).is_active) {
      return { ok: false, message: "Este e-mail já faz parte da equipe." };
    }

    const token =
      (globalThis.crypto as Crypto)?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];

    let memberId = existing?.id as string | undefined;
    if (memberId) {
      const { error } = await supabase
        .from("agency_members")
        .update({
          name: data.name,
          role: data.role,
          status: "pending",
          is_active: false,
          invite_token: token,
        } as never)
        .eq("id", memberId);
      if (error) return { ok: false, message: "Não foi possível atualizar o convite." };
    } else {
      const { data: created, error } = await supabase
        .from("agency_members")
        .insert({
          agency_id: activeAgencyId,
          name: data.name,
          email,
          role: data.role,
          avatar_color: color,
          status: "pending",
          is_active: false,
          invite_token: token,
        } as never)
        .select("id")
        .single();
      if (error || !created) {
        console.error("sendTeamInvite insert:", error);
        return { ok: false, message: "Não foi possível criar o convite." };
      }
      memberId = (created as { id: string }).id;
    }

    // Nome da agência e de quem convidou
    const { data: agency } = await supabase
      .from("agencies")
      .select("name")
      .eq("id", activeAgencyId)
      .maybeSingle();

    const { data: me } = await supabase
      .from("agency_members")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();

    // APP_URL no servidor tem prioridade sobre o endereço enviado pelo navegador.
    const baseUrl = (process.env.APP_URL || data.appUrl).replace(/\/$/, "");
    const link = `${baseUrl}/aceitar-convite?token=${encodeURIComponent(token)}`;

    // Carrega configuração de e-mail da agência
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", `agency_cfg:${activeAgencyId}:gmail`)
      .maybeSingle();

    let emailConfig: EmailConfig = DEFAULT_CONFIG;
    if (row?.value) {
      try {
        emailConfig = { ...DEFAULT_CONFIG, ...(typeof row.value === "string" ? JSON.parse(row.value) : row.value) };
      } catch {}
    }

    if (!emailConfig.enabled) {
      return {
        ok: true,
        emailSent: false,
        inviteUrl: link,
        message: "Convite registrado! O serviço de e-mail está desabilitado na Administração. Compartilhe o link do convite manualmente.",
      };
    }

    const subject = `Convite para a equipe ${(agency as { name?: string })?.name ?? "da agência"}`;
    const html = inviteHtml({
      name: data.name,
      agency: (agency as { name?: string })?.name ?? "sua agência",
      inviter: (me as { name?: string })?.name ?? "A equipe",
      link,
    });

    const { sendEmailWithConfig } = await import("./email.server");
    const sendRes = await sendEmailWithConfig(emailConfig, {
      to: email,
      subject,
      body: `Você foi convidado para participar da equipe. Acesse: ${link}`,
      html,
    });

    if (sendRes.ok) {
      return { ok: true, emailSent: true, message: "Convite enviado com sucesso por e-mail!" };
    } else {
      return {
        ok: true,
        emailSent: false,
        inviteUrl: link,
        message: `Convite criado, mas falhou o envio do e-mail (${sendRes.message}). Você pode copiar o link do convite.`,
      };
    }
  });
