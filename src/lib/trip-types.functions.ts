import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Persiste os tipos de viagem personalizados por agência na tabela
// `system_settings`, para que fiquem disponíveis em todos os dispositivos.

function settingsKey(agencyId: string) {
  return `agency_cfg:${agencyId}:trip_types`;
}

async function resolveAgency(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data?.agency_id as string) ?? null;
}

/** Normaliza um valor para comparação (minúsculas, sem acentos, espaços colapsados). */
export function normalizeTripType(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Lê os tipos de viagem personalizados da agência do usuário. */
export const getTripTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ types: string[] }> => {
    const agencyId = await resolveAgency(context.supabase, context.userId);
    if (!agencyId) return { types: [] };
    const { data: row } = await context.supabase
      .from("system_settings")
      .select("value")
      .eq("key", settingsKey(agencyId))
      .maybeSingle();
    const value = (row?.value as { types?: unknown } | null)?.types;
    const types = Array.isArray(value)
      ? value.filter((t): t is string => typeof t === "string")
      : [];
    return { types };
  });

/** Adiciona um novo tipo de viagem (evita duplicados ignorando caixa/acento/espaços). */
export const addTripType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ type: z.string() }).parse(data))
  .handler(async ({ data, context }): Promise<{ types: string[] }> => {
    const agencyId = await resolveAgency(context.supabase, context.userId);
    if (!agencyId) throw new Error("Agência não encontrada para o usuário.");
    const value = data.type.trim().replace(/\s+/g, " ");
    if (!value) throw new Error("Tipo de viagem inválido.");

    const key = settingsKey(agencyId);
    const { data: row } = await context.supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    const existing = (row?.value as { types?: unknown } | null)?.types;
    const current = Array.isArray(existing)
      ? existing.filter((t): t is string => typeof t === "string")
      : [];

    const norm = normalizeTripType(value);
    if (current.some((t) => normalizeTripType(t) === norm)) {
      return { types: current };
    }
    const next = [...current, value];
    const { error } = await context.supabase.from("system_settings").upsert(
      { key, value: { types: next } as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { types: next };
  });
