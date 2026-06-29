import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Configurações por agência são armazenadas na tabela global `system_settings`
// usando uma chave composta. Assim ficam persistidas no banco e disponíveis em
// qualquer dispositivo/ambiente (não apenas no navegador onde foram salvas).
// O payload trafega como string JSON para manter a serialização simples.

const SCOPES = ["webhook", "notifications", "gmail", "form", "n8n"] as const;
type Scope = (typeof SCOPES)[number];

function isScope(v: string): v is Scope {
  return (SCOPES as readonly string[]).includes(v);
}

function settingsKey(agencyId: string, scope: Scope) {
  return `agency_cfg:${agencyId}:${scope}`;
}

async function resolveAgency(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ agencyId: string } | null> {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data?.agency_id) return null;
  return { agencyId: data.agency_id as string };
}

/** Lê a configuração de uma seção da Administração para a agência do usuário. */
export const getAgencyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ scope: z.string().refine(isScope, "scope inválido") }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ value: string | null }> => {
    const member = await resolveAgency(context.supabase, context.userId);
    if (!member) return { value: null };
    const { data: row } = await context.supabase
      .from("system_settings")
      .select("value")
      .eq("key", settingsKey(member.agencyId, data.scope as Scope))
      .maybeSingle();
    if (row?.value == null) return { value: null };
    return { value: JSON.stringify(row.value) };
  });

/** Salva a configuração de uma seção da Administração para a agência do usuário. */
export const saveAgencyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        scope: z.string().refine(isScope, "scope inválido"),
        value: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const member = await resolveAgency(context.supabase, context.userId);
    if (!member) throw new Error("Agência não encontrada para o usuário.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.value);
    } catch {
      throw new Error("Configuração inválida.");
    }
    const { error } = await context.supabase.from("system_settings").upsert(
      {
        key: settingsKey(member.agencyId, data.scope as Scope),
        value: parsed as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
