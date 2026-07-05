import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenKey = `push_token:${context.userId}:${data.deviceId}`;
    const { data: existingRows } = await supabaseAdmin
      .from("system_settings")
      .select("key, value")
      .like("key", "push_token:%");
    const staleKeys = (existingRows ?? [])
      .filter((row) => {
        const value = (row.value ?? {}) as { token?: string; userId?: string; deviceId?: string };
        return (
          row.key === `push_token:${context.userId}` ||
          (value.token === data.token && row.key !== tokenKey) ||
          (value.userId === context.userId && value.deviceId === data.deviceId && row.key !== tokenKey)
        );
      })
      .map((row) => row.key);
    if (staleKeys.length > 0) {
      await supabaseAdmin.from("system_settings").delete().in("key", staleKeys);
    }

    const { error } = await supabaseAdmin.from("system_settings").upsert(
      {
        key: tokenKey,
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
  deviceId: string;
  name: string | null;
  email: string | null;
  label: string | null;
  token: string;
  updatedAt: string | null;
  isSelf: boolean;
}

export interface PushDeliveryStatus {
  traceId: string;
  status: "pending" | "accepted" | "received" | "failed" | "not_found";
  message: string;
  sentAt: string | null;
  receivedAt: string | null;
  deviceState: string | null;
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
          label?: string | null;
          deviceId?: string | null;
        };
        const [, keyUserId, keyDeviceId] = row.key.split(":");
        return {
          userId: v.userId ?? keyUserId,
          deviceId: v.deviceId ?? keyDeviceId ?? "",
          name: v.name ?? null,
          email: v.email ?? null,
          label: v.label ?? null,
          token: v.token ?? "",
          agencyId: v.agencyId ?? null,
          updatedAt: row.updated_at as string | null,
        };
      })
      .filter((e) => e.token && e.deviceId && (agencyId === null || e.agencyId === agencyId))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .map(({ agencyId: _a, ...e }) => ({ ...e, isSelf: e.userId === context.userId }));
  });

/** Envia uma notificação push de teste para um token de dispositivo via FCM HTTP v1. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(10),
        deviceId: z.string().min(6).max(64).optional(),
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; message: string; traceId?: string }> => {
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
    const traceId = crypto.randomUUID();
    const ackSecret = randomSecret();
    const sentAt = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deliveryKey = `push_delivery:${traceId}`;

    await supabaseAdmin.from("system_settings").upsert(
      {
        key: deliveryKey,
        value: {
          traceId,
          ackSecret,
          status: "pending",
          deviceId: data.deviceId ?? null,
          tokenPrefix: data.token.slice(0, 18),
          sentAt,
          receivedAt: null,
          deviceState: null,
          message: "Envio iniciado.",
        } as never,
        updated_at: sentAt,
      },
      { onConflict: "key" },
    );

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
              data: {
                title: data.title,
                body: data.body,
                traceId,
                ackSecret,
                url: "/",
              },
              notification: { title: data.title, body: data.body },
              webpush: {
                notification: {
                  title: data.title,
                  body: data.body,
                  icon: "/pwa-icon.png",
                  badge: "/pwa-icon.png",
                  data: { traceId, ackSecret, url: "/" },
                  requireInteraction: false,
                },
              },
            },
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("FCM send failed", res.status, text);
        await supabaseAdmin
          .from("system_settings")
          .update({
            value: {
              traceId,
              ackSecret,
              status: "failed",
              deviceId: data.deviceId ?? null,
              tokenPrefix: data.token.slice(0, 18),
              sentAt,
              receivedAt: null,
              deviceState: null,
              message: `FCM recusou o envio (status ${res.status}).`,
            } as never,
            updated_at: new Date().toISOString(),
          })
          .eq("key", deliveryKey);
        return { ok: false, message: `FCM recusou o envio (status ${res.status}).`, traceId };
      }
      await supabaseAdmin
        .from("system_settings")
        .update({
          value: {
            traceId,
            ackSecret,
            status: "accepted",
            deviceId: data.deviceId ?? null,
            tokenPrefix: data.token.slice(0, 18),
            sentAt,
            receivedAt: null,
            deviceState: null,
            message: "FCM aceitou o envio; aguardando confirmação do dispositivo.",
          } as never,
          updated_at: new Date().toISOString(),
        })
        .eq("key", deliveryKey);
      return {
        ok: true,
        message: "FCM aceitou o envio; aguardando confirmação do dispositivo.",
        traceId,
      };
    } catch (err) {
      console.error("FCM error", err);
      await supabaseAdmin
        .from("system_settings")
        .update({
          value: {
            traceId,
            ackSecret,
            status: "failed",
            deviceId: data.deviceId ?? null,
            tokenPrefix: data.token.slice(0, 18),
            sentAt,
            receivedAt: null,
            deviceState: null,
            message: `Erro: ${err instanceof Error ? err.message : "desconhecido"}`,
          } as never,
          updated_at: new Date().toISOString(),
        })
        .eq("key", deliveryKey);
      return { ok: false, message: `Erro: ${err instanceof Error ? err.message : "desconhecido"}`, traceId };
    }
  });

/** Consulta se o dispositivo confirmou recebimento de um teste de push. */
export const getPushDeliveryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ traceId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PushDeliveryStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", `push_delivery:${data.traceId}`)
      .maybeSingle();
    if (!row?.value) {
      return {
        traceId: data.traceId,
        status: "not_found",
        message: "Status não encontrado.",
        sentAt: null,
        receivedAt: null,
        deviceState: null,
      };
    }
    const v = row.value as {
      traceId?: string;
      status?: PushDeliveryStatus["status"];
      message?: string;
      sentAt?: string | null;
      receivedAt?: string | null;
      deviceState?: string | null;
    };
    return {
      traceId: data.traceId,
      status: v.status ?? "pending",
      message: v.message ?? "Aguardando confirmação do dispositivo.",
      sentAt: v.sentAt ?? null,
      receivedAt: v.receivedAt ?? null,
      deviceState: v.deviceState ?? null,
    };
  });
