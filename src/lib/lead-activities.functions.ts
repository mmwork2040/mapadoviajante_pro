import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclui uma atividade de lead. A tabela `crm_lead_activities` não possui
 * política de DELETE via Data API, então validamos o acesso pela política de
 * SELECT (que já restringe à agência do usuário) e executamos a remoção com o
 * cliente admin no servidor.
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_lead_activities").delete().eq("id", data.id);
    if (error) throw new Error("Falha ao excluir a atividade.");
    return { ok: true };
  });
