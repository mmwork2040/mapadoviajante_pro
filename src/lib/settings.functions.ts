import { supabase } from "@/integrations/supabase/client";
import { getAgencyId, loadAgencyContext } from "@/lib/services";

// Configurações por agência são armazenadas na tabela global `system_settings`
// usando uma chave composta `agency_cfg:{agencyId}:{scope}` no Appwrite.

const SCOPES = ["webhook", "notifications", "gmail", "form", "n8n", "gdrive", "payments"] as const;
type Scope = (typeof SCOPES)[number];

function settingsKey(agencyId: string, scope: string) {
  return `agency_cfg:${agencyId}:${scope}`;
}

async function resolveAgencyId(): Promise<string | null> {
  const direct = getAgencyId();
  if (direct) return direct;
  const member = await loadAgencyContext();
  return member?.agency_id ?? null;
}

/** Lê a configuração de uma seção da Administração para a agência do usuário. */
export async function getAgencyConfig(opts: { data: { scope: string } }): Promise<{ value: string | null }> {
  try {
    const agencyId = await resolveAgencyId();
    if (!agencyId) return { value: null };

    const key = settingsKey(agencyId, opts.data.scope);
    const { data: row } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (!row || row.value == null) return { value: null };
    return { value: typeof row.value === "string" ? row.value : JSON.stringify(row.value) };
  } catch (err) {
    console.error("getAgencyConfig error:", err);
    return { value: null };
  }
}

/** Lê apenas a configuração pública de push para qualquer membro ativo da agência. */
export async function getPublicNotificationConfig(): Promise<{ value: string | null }> {
  return getAgencyConfig({ data: { scope: "notifications" } });
}

/** Salva a configuração de uma seção da Administração para a agência do usuário. */
export async function saveAgencyConfig(opts: { data: { scope: string; value: string } }): Promise<{ ok: true }> {
  const agencyId = await resolveAgencyId();
  if (!agencyId) throw new Error("Agência não encontrada para o usuário.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(opts.data.value);
  } catch {
    parsed = opts.data.value;
  }

  const key = settingsKey(agencyId, opts.data.scope);
  const { error } = await supabase.from("system_settings").upsert(
    {
      key,
      value: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) throw new Error(error.message);
  return { ok: true };
}
