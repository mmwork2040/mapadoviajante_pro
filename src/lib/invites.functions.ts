import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const MEMBER_COLORS = ["#ff7a1a", "#2563eb", "#16a34a", "#db2777", "#9333ea", "#0891b2"];

function encodeRawEmail(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    'Content-Type: text/html; charset="UTF-8"',
    "MIME-Version: 1.0",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function inviteHtml(opts: { name: string; agency: string; inviter: string; link: string }) {
  const { name, agency, inviter, link } = opts;
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#ff7a1a;padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">O Segredo do Viajante</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 14px;font-size:16px;">Olá, <strong>${name}</strong>!</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
          <strong>${inviter}</strong> convidou você para participar da equipe da agência
          <strong>${agency}</strong> no sistema O Segredo do Viajante.
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

/** Cria o convite (membro pendente) e dispara o e-mail personalizado via Gmail. */
export const sendTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        role: z.string().trim().min(1).max(40).default("agent"),
        appUrl: z.string().url().max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const email = data.email.toLowerCase();

    // Verifica se o envio de e-mail está configurado e ativo antes de criar o convite
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !connKey) {
      return {
        ok: false,
        message:
          "O envio de e-mails não está configurado. Conecte o Gmail nas configurações do sistema antes de convidar membros.",
      };
    }

    // Agência e cargo do solicitante
    const { data: agencyId } = await supabase.rpc("get_user_agency_id");
    if (!agencyId) return { ok: false, message: "Agência não encontrada." };


    // Já é membro ativo?
    const { data: existing } = await supabase
      .from("agency_members")
      .select("id, is_active")
      .eq("agency_id", agencyId as string)
      .ilike("email", email)
      .maybeSingle();
    if (existing && (existing as { is_active?: boolean }).is_active) {
      return { ok: false, message: "Este e-mail já faz parte da equipe." };
    }

    const token =
      (globalThis.crypto as Crypto)?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];

    // Cria/atualiza membro pendente
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
          agency_id: agencyId as string,
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
      .eq("id", agencyId as string)
      .maybeSingle();
    const { data: me } = await supabase
      .from("agency_members")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();

    const link = `${data.appUrl.replace(/\/$/, "")}/aceitar-convite?token=${token}`;

    // Envio via Gmail (mesma infra de e-mail do sistema)
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !connKey) {
      return {
        ok: true,
        emailSent: false,
        message: "Convite criado, mas o Gmail não está conectado para enviar o e-mail.",
      };
    }

    try {
      const subject = `Convite para a equipe ${(agency as { name?: string })?.name ?? "da agência"}`;
      const html = inviteHtml({
        name: data.name,
        agency: (agency as { name?: string })?.name ?? "sua agência",
        inviter: (me as { name?: string })?.name ?? "A equipe",
        link,
      });
      const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodeRawEmail(email, subject, html) }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("invite gmail send failed", res.status, text);
        return {
          ok: true,
          emailSent: false,
          message: `Convite criado, mas falhou o envio do e-mail (status ${res.status}).`,
        };
      }
      return { ok: true, emailSent: true, message: "Convite enviado por e-mail." };
    } catch (err) {
      console.error("invite gmail error", err);
      return { ok: true, emailSent: false, message: "Convite criado, mas houve erro ao enviar o e-mail." };
    }
  });
