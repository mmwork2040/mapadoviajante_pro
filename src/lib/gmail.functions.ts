import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

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

/** Verifica se a conexão Gmail está disponível e retorna o e-mail conectado. */
export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAIL_API_KEY;
    const connected = Boolean(lovableKey && connKey);
    if (!connected) return { connected: false, email: null as string | null };
    try {
      const res = await fetch(`${GATEWAY_URL}/users/me/profile`, {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey as string,
        },
      });
      if (!res.ok) return { connected: true, email: null as string | null };
      const data = (await res.json()) as { emailAddress?: string };
      return { connected: true, email: data.emailAddress ?? null };
    } catch {
      return { connected: true, email: null as string | null };
    }
  });


/** Envia um e-mail via Gmail API (conta única do connector). */
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
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !connKey) {
      return { ok: false, message: "Gmail não está conectado." };
    }
    try {
      const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodeRawEmail(data.to, data.subject, data.body) }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Gmail send failed", res.status, text);
        return { ok: false, message: `Falha ao enviar (status ${res.status}).` };
      }
      return { ok: true, message: "E-mail enviado com sucesso." };
    } catch (err) {
      console.error("Gmail send error", err);
      return { ok: false, message: "Erro de conexão ao enviar o e-mail." };
    }
  });
