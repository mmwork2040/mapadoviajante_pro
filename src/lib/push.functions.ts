import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth falhou (${res.status})`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/** Indica se a service account do Firebase está configurada no servidor. */
export const getPushStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT) }));

/** Registra/atualiza o device token de push do usuário logado em system_settings. */
export const saveDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(10),
        deviceId: z.string().min(6).max(64),
        label: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: member } = await context.supabase
      .from("agency_members")
      .select("agency_id, name, email")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { error } = await context.supabase.from("system_settings").upsert(
      {
        key: `push_token:${context.userId}:${data.deviceId}`,
        value: {
          token: data.token,
          userId: context.userId,
          deviceId: data.deviceId,
          label: data.label ?? null,
          agencyId: member?.agency_id ?? null,
          name: member?.name ?? null,
          email: member?.email ?? null,
          updatedAt: new Date().toISOString(),
        } as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface DeviceTokenEntry {
  userId: string;
  name: string | null;
  email: string | null;
  token: string;
  updatedAt: string | null;
  isSelf: boolean;
}

/** Lista os device tokens salvos dos membros da agência do usuário (admin). */
export const listDeviceTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeviceTokenEntry[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return [];

    const { data: me } = await context.supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const agencyId = me?.agency_id ?? null;

    const { data, error } = await context.supabase
      .from("system_settings")
      .select("key, value, updated_at")
      .like("key", "push_token:%");
    if (error) throw new Error(error.message);

    return (data ?? [])
      .map((row) => {
        const v = (row.value ?? {}) as {
          token?: string;
          userId?: string;
          agencyId?: string | null;
          name?: string | null;
          email?: string | null;
        };
        return {
          userId: v.userId ?? row.key.replace("push_token:", ""),
          name: v.name ?? null,
          email: v.email ?? null,
          token: v.token ?? "",
          agencyId: v.agencyId ?? null,
          updatedAt: row.updated_at as string | null,
        };
      })
      .filter((e) => e.token && (agencyId === null || e.agencyId === agencyId))
      .map(({ agencyId: _a, ...e }) => ({ ...e, isSelf: e.userId === context.userId }));
  });

/** Envia uma notificação push de teste para um token de dispositivo via FCM HTTP v1. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(10),
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return { ok: false, message: "Service account do Firebase não configurada." };
    let sa: ServiceAccount;
    try {
      sa = JSON.parse(raw) as ServiceAccount;
    } catch {
      return { ok: false, message: "Service account inválida (JSON malformado)." };
    }
    if (!sa.private_key || !sa.client_email || !sa.project_id) {
      return {
        ok: false,
        message:
          "Service account incompleta: verifique os campos private_key, client_email e project_id.",
      };
    }
    // Normaliza quebras de linha escapadas (\\n) do private_key colado como texto.
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    try {
      const accessToken = await getAccessToken(sa);
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: data.token,
              notification: { title: data.title, body: data.body },
            },
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("FCM send failed", res.status, text);
        return { ok: false, message: `Falha ao enviar (status ${res.status}).` };
      }
      return { ok: true, message: "Notificação enviada." };
    } catch (err) {
      console.error("FCM error", err);
      return { ok: false, message: `Erro: ${err instanceof Error ? err.message : "desconhecido"}` };
    }
  });
