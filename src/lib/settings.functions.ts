import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Configurações por agência ficam na coleção global `system_settings`, com a
// chave `agency_cfg:{agencyId}:{scope}`. Leitura e escrita passam pelo
// servidor: a agência vem da sessão (nunca do navegador) e senhas não voltam.

const SCOPES = ["webhook", "notifications", "gmail", "form", "n8n", "gdrive", "payments", "permissions"] as const;
type Scope = (typeof SCOPES)[number];

/**
 * Campos que nunca saem do servidor. Ao salvar, valor vazio nesses campos
 * significa "manter o que já está salvo".
 */
const HIDDEN_FIELDS: Partial<Record<Scope, string[]>> = {
  gmail: ["gmailAppPassword", "appwriteApiKey", "appwriteSmtpPassword"],
};

/** Campos que só o admin vê (ele precisa copiá-los para o n8n/webhook). */
const ADMIN_ONLY_FIELDS: Partial<Record<Scope, string[]>> = {
  webhook: ["secret"],
  n8n: ["secret"],
};

function settingsKey(agencyId: string, scope: string) {
  return `agency_cfg:${agencyId}:${scope}`;
}

function parseValue(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const v = JSON.parse(String(raw));
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

async function readScope(agencyId: string, scope: Scope) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", settingsKey(agencyId, scope))
    .maybeSingle();
  if (error) {
    console.error("readScope:", error);
    throw new Error("Não foi possível carregar a configuração.");
  }
  return parseValue(row?.value);
}

/** Lê a configuração completa de uma seção. Só para uso no servidor. */
export async function readAgencyConfigServer(agencyId: string, scope: Scope) {
  return readScope(agencyId, scope);
}

/** Grava a configuração completa de uma seção. Só para uso no servidor, depois de conferir o papel. */
export async function writeAgencyConfigServer(agencyId: string, scope: Scope, value: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("system_settings").upsert(
    { key: settingsKey(agencyId, scope), value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) {
    console.error("writeAgencyConfigServer:", error);
    throw new Error("Não foi possível salvar a configuração.");
  }
}

const scopeInput = z.object({ scope: z.enum(SCOPES) });

/** Lê a configuração de uma seção da Administração para a agência do usuário. */
export const getAgencyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scopeInput.parse(data))
  .handler(async ({ data, context }): Promise<{ value: string | null }> => {
    const { getMembership } = await import("@/lib/server/authz");
    const m = await getMembership(context);
    const value = await readScope(m.agencyId, data.scope);
    if (!value) return { value: null };

    const isAdmin = m.role === "admin" || m.role === "owner" || m.isSuperAdmin;
    const hide = [
      ...(HIDDEN_FIELDS[data.scope] ?? []),
      ...(isAdmin ? [] : ADMIN_ONLY_FIELDS[data.scope] ?? []),
    ];
    const safe: Record<string, unknown> = { ...value };
    for (const field of hide) {
      if (field in safe) {
        safe[`has_${field}`] = Boolean(safe[field]);
        safe[field] = "";
      }
    }
    return { value: JSON.stringify(safe) };
  });

/** Configuração de push, que qualquer membro ativo da agência pode ler. */
export async function getPublicNotificationConfig(): Promise<{ value: string | null }> {
  return getAgencyConfig({ data: { scope: "notifications" } });
}

/** Salva a configuração de uma seção da Administração. Só admin. */
export const saveAgencyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ scope: z.enum(SCOPES), value: z.string().max(100_000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireAdmin } = await import("@/lib/server/authz");
    const m = await requireAdmin(context);

    const incoming = parseValue(data.value);
    if (!incoming) throw new Error("Configuração inválida.");

    // Campos de senha vazios mantêm o valor salvo; marcadores has_* são descartados.
    const current = (await readScope(m.agencyId, data.scope)) ?? {};
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (k.startsWith("has_")) continue;
      next[k] = v;
    }
    const protectedFields = [
      ...(HIDDEN_FIELDS[data.scope] ?? []),
      ...(ADMIN_ONLY_FIELDS[data.scope] ?? []),
    ];
    for (const field of protectedFields) {
      if (!next[field] && current[field]) next[field] = current[field];
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_settings").upsert(
      {
        key: settingsKey(m.agencyId, data.scope),
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) {
      console.error("saveAgencyConfig:", error);
      throw new Error("Não foi possível salvar a configuração.");
    }
    return { ok: true };
  });

/** Dispara um evento para o webhook configurado da agência (no servidor). */
export const dispatchWebhookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ event: z.string().min(1).max(60), payload: z.unknown() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getMembership } = await import("@/lib/server/authz");
    const m = await getMembership(context);
    const cfg = await readScope(m.agencyId, "webhook");
    if (!cfg?.enabled || typeof cfg.url !== "string" || !cfg.url) return { ok: false };
    const events = Array.isArray(cfg.events) ? (cfg.events as string[]) : [];
    if (!events.includes(data.event)) return { ok: false };
    return postWebhook(cfg.url, typeof cfg.secret === "string" ? cfg.secret : "", {
      event: data.event,
      agency_id: m.agencyId,
      timestamp: new Date().toISOString(),
      data: data.payload,
    });
  });

/** Envia um evento de teste. Só admin. Segredo vazio = usa o já salvo. */
export const sendTestWebhookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ url: z.string().trim().url().max(500), secret: z.string().max(500).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/server/authz");
    const m = await requireAdmin(context);
    let secret = data.secret || "";
    if (!secret) {
      const cfg = await readScope(m.agencyId, "webhook");
      secret = typeof cfg?.secret === "string" ? cfg.secret : "";
    }
    return postWebhook(data.url, secret, {
      event: "webhook.test",
      agency_id: m.agencyId,
      timestamp: new Date().toISOString(),
      data: { message: "Teste de configuração do webhook." },
    });
  });

async function postWebhook(url: string, secret: string, body: unknown) {
  if (!/^https?:\/\//i.test(url)) return { ok: false, message: "URL do webhook inválida." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return {
      ok: res.ok,
      message: res.ok
        ? `Webhook respondeu com status ${res.status}.`
        : `Falha: o webhook respondeu com status ${res.status}.`,
    };
  } catch (err) {
    console.warn("Falha ao disparar webhook:", err);
    return { ok: false, message: "Não foi possível alcançar a URL do webhook." };
  }
}
