import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclui uma atividade de lead. A tabela `crm_lead_activities` não possui
 * política de DELETE via Data API, então validamos o acesso pela política de
 * SELECT (que já restringe à agência do usuário) e executamos a remoção com um
 * cliente de serviço no servidor.
 */
export const deleteLeadActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Confirma que a atividade é visível para o usuário (mesma agência via RLS).
    const { data: row, error: selErr } = await context.supabase
      .from("crm_lead_activities")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error("Falha ao verificar a atividade.");
    if (!row) throw new Error("Atividade não encontrada.");

    const url = process.env.SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.N8N_SUPABASE_SERVICE_KEY?.trim();
    if (!url || !serviceKey) {
      throw new Error("Configuração de servidor ausente para exclusão.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const isNewKey =
      serviceKey.startsWith("sb_publishable_") || serviceKey.startsWith("sb_secret_");
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (isNewKey && headers.get("Authorization") === `Bearer ${serviceKey}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", serviceKey);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { error } = await admin.from("crm_lead_activities").delete().eq("id", data.id);
    if (error) throw new Error(`Falha ao excluir a atividade: ${error.message}`);
    return { ok: true };
  });
